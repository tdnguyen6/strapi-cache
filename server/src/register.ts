import type { Core } from '@strapi/strapi';
import middlewares from './middlewares';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // register global middleware - run before auth
  // strapi.server.use(middlewares.cache);
  // strapi.server.use(middlewares.graphql);

  // register route middleware - run after auth (https://github.com/strapi/strapi/blob/main/packages/core/core/src/services/server/compose-endpoint.ts#L85-L93)
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
};

export default register;
