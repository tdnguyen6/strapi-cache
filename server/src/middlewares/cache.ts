import { Context } from 'koa';
import { generateCacheKey } from '../utils/key';
import { CacheService } from '../../src/types/cache.types';
import { loggy } from '../utils/log';
import Stream from 'stream';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';
import { withTimeout } from 'src/utils/withTimeout';
import { waitCacheInit } from 'src/utils/waitCacheInit';

const middleware = async (ctx: Context, next: any) => {
  const cacheService = strapi.plugin('strapi-cache').services.service as CacheService;
  const cacheableRoutes = strapi.plugin('strapi-cache').config('cacheableRoutes') as string[];
  const cacheHeaders = strapi.plugin('strapi-cache').config('cacheHeaders') as boolean;
  const cacheStore = cacheService.getCacheInstance();
  const { url } = ctx.request;
  const hashCacheKey = strapi.plugin('strapi-cache').config('hashCacheKey');
  const key = generateCacheKey(ctx, hashCacheKey);
  const cacheEntry = await cacheStore.get(key);
  const cacheControlHeader = ctx.request.headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const routeIsCachable =
    cacheableRoutes.some((route) => url.startsWith(route)) ||
    (cacheableRoutes.length === 0 && url.startsWith('/api'));
  const statusIsCachable = () => ((ctx.status >= 200 && ctx.status < 300) || ctx.status === 404);
  const initCacheTimeoutInMs = strapi.plugin('strapi-cache').config('initCacheTimeoutInMs') as number;

  if (ctx.method === 'GET' && routeIsCachable && !noCache) {
    let cacheEntry = await withTimeout(cancelRef => waitCacheInit(cancelRef, cacheStore, key), initCacheTimeoutInMs);
    if (cacheEntry) {
      loggy.info(`HIT with key: ${key}`);
      ctx.status = 200;
      ctx.body = cacheEntry.body;
      if (cacheHeaders) {
        ctx.set(cacheEntry.headers);
      }
      return;
    }
  }

  await next();

  if (ctx.method === 'GET' && routeIsCachable && statusIsCachable()) {
    loggy.info(`MISS with key: ${key}`);

    if (ctx.body instanceof Stream) {
      const buf = await streamToBuffer(ctx.body as Stream);
      const contentEncoding = ctx.response.headers['content-encoding'];
      const decompressed = await decompressBuffer(buf, contentEncoding);
      const responseText = decodeBufferToText(decompressed);

      const headersToStore = cacheHeaders ? ctx.response.headers : null;
      await cacheStore.set(key, { body: responseText, headers: headersToStore });
      ctx.body = buf;
    } else {
      const headersToStore = cacheHeaders ? ctx.response.headers : null;
      await cacheStore.set(key, { body: ctx.body, headers: headersToStore });
    }
  } else {
    cacheStore.del(key);
  }
};

export default middleware;
