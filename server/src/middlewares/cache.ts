import { Context } from 'koa';
import { generateCacheKey } from '../utils/key';
import { CacheService } from '../../src/types/cache.types';
import { loggy } from '../utils/log';
import Stream from 'stream';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';
import { getCacheEntry, statusIsCachable } from '../utils/cache';

const middleware = async (ctx: Context, next: any) => {
  const cacheService = strapi.plugin('strapi-cache').services.service as CacheService;
  const cacheableRoutes = strapi.plugin('strapi-cache').config('cacheableRoutes') as string[];
  const cacheHeaders = strapi.plugin('strapi-cache').config('cacheHeaders') as boolean;
  const auth = strapi.plugin('strapi-cache').config('auth') as string;
  const cacheAuthorizedRequests = strapi
    .plugin('strapi-cache')
    .config('cacheAuthorizedRequests') as boolean;
  const authorizationHeader = ctx.request.headers['authorization'];
  const cacheStore = cacheService.getCacheInstance();
  const { url } = ctx.request;
  const key = generateCacheKey(ctx);
  const cacheControlHeader = ctx.request.headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const routeIsCachable =
    cacheableRoutes.some((route) => url.startsWith(route)) ||
    (cacheableRoutes.length === 0 && url.startsWith('/api'));
  const initCacheTimeoutInMs = strapi
    .plugin('strapi-cache')
    .config('initCacheTimeoutInMs') as number;

  if (authorizationHeader && !cacheAuthorizedRequests) {
    loggy.info(`Authorized request bypassing cache: ${key}`);
    await next();
    return;
  }

  if (ctx.method === 'GET' && routeIsCachable && !noCache) {
    const providerType = strapi.plugin('strapi-cache').config('provider') || 'memory';
    const cacheEntry = await getCacheEntry(cacheStore, key, initCacheTimeoutInMs);
    if (cacheEntry) {
      loggy.info(`HIT with key: ${key}`);
      ctx.status = 200;
      ctx.body = cacheEntry.body;
      if (cacheHeaders) {
        ctx.set(cacheEntry.headers);
      }
      ctx.set('X-Cache', `Hit from ${providerType}`)
      return;
    }
    loggy.info(`INIT with key: ${key}`);
    await cacheStore.set(key, { init: true });
    try {
      await next();
      if (statusIsCachable(ctx)) {
        loggy.info(`MISS with key: ${key}`);
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
        ctx.set('X-Cache', `Miss from ${providerType}`)
      } else {
        throw new Error("NOT_CACHABLE")
      }
    } catch(e) {
      if (e.message === "NOT_CACHABLE") {
        loggy.info(`${e.message} with key: ${key}`);
      } else {
        loggy.error(`${e} with key: ${key}`);
      }
      cacheStore.del(key);
    }
    return;
  }
  await next();
};

export default middleware;
