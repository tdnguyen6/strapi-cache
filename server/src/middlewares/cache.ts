import { Context } from 'koa';
import { generateCacheKey } from '../utils/key';
import { CacheService } from '../../src/types/cache.types';
import { loggy } from '../utils/log';
import Stream from 'stream';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';
import { sleep } from '../utils/withTimeout';

const middleware = async (ctx: Context, next: any) => {
  const cacheService = strapi.plugin('strapi-cache').services.service as CacheService;
  const cacheableRoutes = strapi.plugin('strapi-cache').config('cacheableRoutes') as string[];
  const cacheHeaders = strapi.plugin('strapi-cache').config('cacheHeaders') as boolean;
  const cacheAuthorizedRequests = strapi
    .plugin('strapi-cache')
    .config('cacheAuthorizedRequests') as boolean;
  const cacheStore = cacheService.getCacheInstance();
  const { url } = ctx.request;
  const key = generateCacheKey(ctx);
  const cacheControlHeader = ctx.request.headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const routeIsCachable =
    cacheableRoutes.some((route) => url.startsWith(route)) ||
    (cacheableRoutes.length === 0 && url.startsWith('/api'));
  const authorizationHeader = ctx.request.headers['authorization'];

  if (authorizationHeader && !cacheAuthorizedRequests) {
    loggy.info(`Authorized request bypassing cache: ${key}`);
    await next();
    return;
  }

  if (!noCache) {
    let cacheEntry = null;
    let cacheHit = false;
    while (true) {
      const cacheEntry = await cacheStore.get(key);
      if (!cacheEntry) {
        loggy.info(`INIT key: ${key}`);
        await cacheStore.set(key, { init: "" });
        break;
      }
      if (!cacheEntry.init) {
        cacheHit = true;
        break;
      }
      sleep(10);
    }
    if (cacheHit) {
      loggy.info(`HIT with key: ${key}`);
      ctx.status = 200;
      ctx.body = cacheEntry.body;
      if (cacheHeaders) {
        ctx.set(cacheEntry.headers);
        return;
      }
    }
  }

  await next();

  if (
    ctx.method === 'GET' && routeIsCachable &&
    ((ctx.status >= 200 && ctx.status < 300) || ctx.status == 404)
  ) {
    loggy.info(`MISS with key: ${key}`);

    if (ctx.body instanceof Stream) {
      const buf = await streamToBuffer(ctx.body);
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
  }
};

export default middleware;
