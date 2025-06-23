import { Context } from 'koa';
import { generateCacheKey } from '../utils/key';
import { CacheService } from '../../src/types/cache.types';
import { loggy } from '../utils/log';
import Stream from 'stream';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../utils/body';
import { getCacheEntry, statusIsCachable } from '../utils/cache';
import { qsparse } from '../utils/qsparse';

const middleware = async (ctx: Context, next: any) => {
  const { method, url, headers } = ctx.request;
  const { path, query } = qsparse(url);

  const cacheAuthorizedRequests = strapi
    .plugin('strapi-cache')
    .config('cacheAuthorizedRequests') as boolean;
  const authorizationHeader = headers.authorization;
  if (authorizationHeader && !cacheAuthorizedRequests) {
    loggy.info(`Authorized request bypassing cache`);
    await next();
    return;
  }

  const cacheControlHeader = headers['cache-control'];
  const noCache = cacheControlHeader && cacheControlHeader.includes('no-cache');
  const cacheableRoutes = strapi.plugin('strapi-cache').config('cacheableRoutes') as string[];
  const routeIsCachable =
    cacheableRoutes.some((route) => path.startsWith(route)) ||
    (cacheableRoutes.length === 0 && path.startsWith('/api'));

  if (method === 'GET' && routeIsCachable && !noCache) {
    const key = generateCacheKey(method, path, query, authorizationHeader);
    const cacheService = strapi.plugin('strapi-cache').services.service as CacheService;
    const cacheStore = cacheService.getCacheInstance();
    const providerType = strapi.plugin('strapi-cache').config('provider') || 'memory';
    const cacheEntry = await getCacheEntry(cacheStore, key);
    const cacheHeaders = strapi.plugin('strapi-cache').config('cacheHeaders') as boolean;
    if (cacheEntry) {
      loggy.info(`HIT with key: ${key}`);
      ctx.status = 200;
      ctx.body = cacheEntry.body;
      if (cacheHeaders) {
        ctx.set(cacheEntry.headers);
      }
      ctx.set('X-Cache', `Hit from ${providerType}`);
      return;
    }
    loggy.info(`INIT with key: ${key}`);
    await cacheStore.set(key, { init: true });

    try {
      await next();
    }
    catch(e) {
      cacheStore.del(key);
      throw e;
    }

    try {
      if (statusIsCachable(ctx)) {
        loggy.info(`MISS with key: ${key}`);
        const headersToStore = cacheHeaders ? ctx.response.headers : null;
        if (authorizationHeader && headersToStore && headersToStore.authorization) {
          delete headersToStore.authorization;
        }
        if (ctx.body instanceof Stream) {
          const buf = await streamToBuffer(ctx.body as Stream);
          const contentEncoding = ctx.response.headers['content-encoding']; // e.g., gzip, br, deflate
          const decompressed = await decompressBuffer(buf, contentEncoding);
          const responseText = decodeBufferToText(decompressed);
          await cacheStore.set(key, { body: responseText, headers: headersToStore });
          ctx.body = buf;
        } else {
          await cacheStore.set(key, {
            body: ctx.body,
            headers: headersToStore,
          });
        }
        ctx.set('X-Cache', `Miss from ${providerType}`);
      } else {
        throw new Error('NOT_CACHABLE');
      }
    } catch (e) {
      cacheStore.del(key);
      if (e.message === 'NOT_CACHABLE') {
        loggy.info(`${e.message} with key: ${key}`);
      } else {
        loggy.error(`${e.stack} with key: ${key}`);
      }
    }
    return;
  }
  await next();
};

export default middleware;
