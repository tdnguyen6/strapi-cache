import type { Core } from '@strapi/strapi';
import { Context } from 'koa';
import { CacheService } from 'src/types/cache.types';
import { loggy } from '../utils/log';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async purgeCache(ctx: Context) {
    try {
      const service = strapi.plugin('strapi-cache').service('service') as CacheService;

      await service.getCacheInstance().reset();

      ctx.body = {
        message: 'Cache purged successfully',
      };
      loggy.info(`Invalidated cache for all keys`);
    } catch (error) {
      loggy.error('Cache invalidation error:');
      loggy.error(error);
    }
  },
  async purgeCacheByKey(ctx: Context) {
    try {
      const { key } = ctx.params;
      const service = strapi.plugin('strapi-cache').service('service') as CacheService;
      const apiPath = `/api(/.*)?${key}`;
      const regex = new RegExp(`^.*:${apiPath}(/.*)?(\\?.*)?(:.*)?$`);

      await service.getCacheInstance().clearByRegexp([regex]);

      ctx.body = {
        message: `Cache purged successfully for key: ${key}`,
      };
      loggy.info(`Invalidated cache for ${key}`);
    } catch (error) {
      loggy.error('Cache invalidation error:');
      loggy.error(error);
    }
  },
  async cacheableRoutes(ctx: Context) {
    const cacheableRoutes = strapi.plugin('strapi-cache').config('cacheableRoutes');
    ctx.body = cacheableRoutes;
  },
});

export default controller;
