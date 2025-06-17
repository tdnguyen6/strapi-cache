import rawBody from 'raw-body';
import { generateCacheKey } from '../utils/key';
import Stream, { Readable } from 'stream';
import { loggy } from '../utils/log';
import { CacheService } from '../../src/types/cache.types';
import { decodeBufferToText, decompressBuffer, streamToBuffer } from '../../src/utils/body';
import { getCacheEntry, statusIsCachable } from '../utils/cache';
import { qsparse } from '../utils/qsparse';
import { parse } from 'graphql';

const middleware = async (ctx: any, next: any) => {
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
  const routeIsCachable = ctx.request.url.startsWith('/graphql');

  if (method === 'POST' && routeIsCachable && !noCache) {
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

    const bodyObj = JSON.parse(body);
    if (bodyObj.mutation || !bodyObj.query) {
      loggy.info('Skipping cache for mutation/non-query GraphQL requests');
      await next();
      return;
    }
    const key = generateCacheKey(
      method,
      path,
      parse(bodyObj.query, { noLocation: true }),
      authorizationHeader,
    );
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
      if (statusIsCachable(ctx)) {
        loggy.info(`MISS with key: ${key}`);
        const headersToStore = cacheHeaders ? ctx.response.headers : null;
        if (authorizationHeader) {
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
        cacheStore.del(key);
        throw new Error('NOT_CACHABLE');
      }
    } catch (e) {
      if (e.message === 'NOT_CACHABLE') {
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
