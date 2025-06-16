import rawBody from 'raw-body';
import { generateGraphqlCacheKey } from '../utils/key';
import Stream, { Readable } from 'stream';
import { loggy } from '../utils/log';
import { CacheService } from '../../src/types/cache.types';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';

const middleware = async (ctx: any, next: any) => {
  const cacheService = strapi.plugin('strapi-cache').services.service as CacheService;
  const cacheHeaders = strapi.plugin('strapi-cache').config('cacheHeaders') as boolean;
  const cacheAuthorizedRequests = strapi
    .plugin('strapi-cache')
    .config('cacheAuthorizedRequests') as boolean;
  const cacheStore = cacheService.getCacheInstance();
  const { url } = ctx.request;

  const originalReq = ctx.req;
  const bodyBuffer = await rawBody(originalReq);
  const body = bodyBuffer.toString();

  const clonedReq = new Readable();
  clonedReq.push(bodyBuffer);
  clonedReq.push(null);

  (clonedReq as any).headers = { ...originalReq.headers };
  (clonedReq as any).method = originalReq.method;
  (clonedReq as any).url = originalReq.url;
  (clonedReq as any).httpVersion = originalReq.httpVersion;
  (clonedReq as any).socket = originalReq.socket;
  (clonedReq as any).connection = originalReq.connection;

  ctx.req = clonedReq;
  ctx.request.req = clonedReq;

  const isIntrospectionQuery = body.includes('IntrospectionQuery');
  if (isIntrospectionQuery) {
    loggy.info('Skipping cache for introspection query');
    await next();
    return;
  }

  const hashCacheKey = strapi.plugin('strapi-cache').config('hashCacheKey');
  const key = generateGraphqlCacheKey(ctx, hashCacheKey);
  const cacheEntry = await cacheStore.get(key);
  const cacheControlHeader = ctx.request.headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const authorizationHeader = ctx.request.headers['authorization'];

  if (authorizationHeader && !cacheAuthorizedRequests) {
    loggy.info(`Authorized request bypassing cache: ${key}`);
    await next();
    return;
  }

  if (cacheEntry && !noCache) {
    loggy.info(`HIT with key: ${key}`);
    ctx.status = 200;
    ctx.body = cacheEntry.body;
    if (cacheHeaders) {
      ctx.set(cacheEntry.headers);
    }
    return;
  }

  await next();

  if (
    ctx.method === 'POST' &&
    ctx.status >= 200 &&
    ctx.status < 300 &&
    url.startsWith('/graphql')
  ) {
    loggy.info(`MISS with key: ${key}`);
    const headers = ctx.request.headers;
    const authorizationHeader = headers['authorization'];
    if (authorizationHeader && !cacheAuthorizedRequests) {
      loggy.info(`Authorized request not caching: ${key}`);
      return;
    }

    if (ctx.body instanceof Stream) {
      const buf = await streamToBuffer(ctx.body);
      const contentEncoding = ctx.response.headers['content-encoding']; // e.g., gzip, br, deflate
      const decompressed = await decompressBuffer(buf, contentEncoding);
      const responseText = decodeBufferToText(decompressed);

      const headersToStore = cacheHeaders ? ctx.response.headers : null;
      await cacheStore.set(key, { body: responseText, headers: headersToStore });
      ctx.body = buf;
    } else {
      const headersToStore = cacheHeaders ? ctx.response.headers : null;
      await cacheStore.set(key, {
        body: ctx.body,
        headers: headersToStore,
      });
    }
  }
};

export default middleware;
