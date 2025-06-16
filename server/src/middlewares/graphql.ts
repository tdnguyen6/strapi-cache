import rawBody from 'raw-body';
import { generateGraphqlCacheKey } from '../utils/key';
import Stream, { Readable } from 'stream';
import { loggy } from '../utils/log';
import { CacheService } from '../../src/types/cache.types';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';
import { getCacheEntry, statusIsCachable } from '../utils/cache';

const middleware = async (ctx: any, next: any) => {
  const cacheService = strapi.plugin('strapi-cache').services.service as CacheService;
  const cacheHeaders = strapi.plugin('strapi-cache').config('cacheHeaders') as boolean;
  const auth = strapi.plugin('strapi-cache').config('auth') as string;
  const cacheAuthorizedRequests = strapi
    .plugin('strapi-cache')
    .config('cacheAuthorizedRequests') as boolean;
  const authorizationHeader = ctx.request.headers['authorization'];
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

  const key = generateGraphqlCacheKey(ctx, body);
  const cacheControlHeader = ctx.request.headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const routeIsCachable = url.startsWith('/graphql');
  const initCacheTimeoutInMs = strapi
    .plugin('strapi-cache')
    .config('initCacheTimeoutInMs') as number;

  if (authorizationHeader && !cacheAuthorizedRequests) {
    loggy.info(`Authorized request bypassing cache: ${key}`);
    await next();
    return;
  }

  if (ctx.method === 'POST' && routeIsCachable && !noCache) {
    const providerType = strapi.plugin('strapi-cache').config('provider') || 'memory';
    const cacheEntry = await getCacheEntry(cacheStore, key, initCacheTimeoutInMs);
    if (cacheEntry) {
      loggy.info(`HIT with key: ${key}`);
      ctx.status = 200;
      ctx.body = cacheEntry.body;
      ctx.set('X-Cache', `Hit from ${providerType}`)
      if (cacheHeaders) {
        ctx.set(cacheEntry.headers);
      }
      return;
    }
    loggy.info(`INIT with key: ${key}`);
    await cacheStore.set(key, { init: true });
    try {
      await next();
    } catch(e) {
      loggy.info(`ERROR ${e} with key: ${key}`);
      cacheStore.del(key);
    }
    if (statusIsCachable(ctx)) {
      loggy.info(`MISS with key: ${key}`);
      ctx.set('X-Cache', `Miss from ${providerType}`)
      if (ctx.body instanceof Stream) {
        const buf = await streamToBuffer(ctx.body as Stream);
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
  }
  await next();
};

export default middleware;
