import rawBody from 'raw-body';
import { generateGraphqlCacheKey } from '../utils/key';
import Stream, { Readable } from 'stream';
import { loggy } from '../utils/log';
import { CacheService } from '../../src/types/cache.types';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';
import { sleep } from '../utils/withTimeout';

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

  const key = generateGraphqlCacheKey(body);
  // const cacheEntry = await cacheStore.get(key);
  const cacheControlHeader = ctx.request.headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const authorizationHeader = ctx.request.headers['authorization'];
  const statusIsCachable = (ctx.status >= 200 && ctx.status < 300) || ctx.status == 404;
  const routeIsCachable = url.startsWith('/graphql');
  if (authorizationHeader && !cacheAuthorizedRequests) {
    loggy.info(`Authorized request bypassing cache: ${key}`);
    await next();
    return;
  }

  // if (cacheEntry && !noCache) {
  //   loggy.info(`HIT with key: ${key}`);
  //   ctx.status = 200;
  //   ctx.body = cacheEntry.body;
  //   if (cacheHeaders) {
  //     ctx.set(cacheEntry.headers);
  //   }
  //   return;
  // }

  if (!noCache) {
    if (
      ctx.method === 'POST' &&
      statusIsCachable &&
      routeIsCachable
    ) {
      let cacheEntry = null;
      let cacheHit = false;
      for (let i = 0; i < 1000; i++) {
        cacheEntry = await cacheStore.get(key);
        if (!cacheEntry) {
          loggy.info(`GraphQL INIT key: ${key}`);
          await cacheStore.set(key, { init: true });
          break;
        }
        if (!cacheEntry.init) {
          cacheHit = true;
          break;
        }
        await sleep(10);
      }
      if (cacheEntry && cacheHit) {
        loggy.info(`GraphQL HIT with key: ${key}`);
        ctx.status = 200;
        ctx.body = cacheEntry.body;
        if (cacheHeaders) {
          ctx.set(cacheEntry.headers);
        }
        return;
      }
    }
  }

  await next();

  if (
    ctx.method === 'POST' &&
    statusIsCachable &&
    routeIsCachable
  ) {
    loggy.info(`GraphQL MISS with key: ${key}`);
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
