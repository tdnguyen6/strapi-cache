import type { Core } from '@strapi/strapi';
import middlewares from './middlewares';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const auth = strapi.plugin('strapi-cache').config('auth') as string;

  // register global middleware so auth run before
  if (auth === 'before') {
    strapi.server.use(middlewares.cache);
    strapi.server.use(middlewares.graphql);
  }

  // register route middleware so auth run after (https://github.com/strapi/strapi/blob/main/packages/core/core/src/services/server/compose-endpoint.ts#L85-L93)
  if (auth === 'after') {
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
};

export default register;
