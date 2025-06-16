import type { Core } from '@strapi/strapi';
import middlewares from './middlewares';
import { loggy } from './utils/log';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const auth = strapi.plugin('strapi-cache').config('auth') as string;
  // register route middleware so auth run before (https://github.com/strapi/strapi/blob/main/packages/core/core/src/services/server/compose-endpoint.ts#L85-L93)
  if (auth === 'before') {
    loggy.info("register route middleware so auth run before");
    Object.entries(strapi.apis).forEach(([apiName, apiConfig]) => {
      Object.entries(apiConfig.routes).forEach(([routeGroupName, routeGroupConfig]) => {
        routeGroupConfig.routes.forEach(route => {
            route.config.middlewares = [
              middlewares.cache,
              middlewares.graphql,
              ...route.config.middlewares || [],
            ]
          })
      })
    })
  }

  // register global middleware so auth run after
  if (auth === 'after') {
    loggy.info("register global middleware so auth run after");
    strapi.server.use(middlewares.cache);
    strapi.server.use(middlewares.graphql);
  }

};

export default register;
