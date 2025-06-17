import { Context } from 'koa';
import { b64encode } from './b64';
import * as jwt from 'jsonwebtoken';
import { hash } from './hash';

export const generateCacheKey = (context: Context) => {
  const { path, method, query } = context.request;
  const queryString = JSON.stringify(query);
  const auth = strapi.plugin('strapi-cache').config('auth') as string;
  const keyPrefix = `${method}:${path}`;
  if (auth === 'before') {
    return keyPrefix;
  }
  const cacheAuthorizedRequests = strapi
      .plugin('strapi-cache')
      .config('cacheAuthorizedRequests') as boolean;
  const authorizationHeader = context.request.headers['authorization'];
  if (cacheAuthorizedRequests && authorizationHeader) {
      const token = authorizationHeader.replace(/^Bearer /, "");
      const decodedJwt = jwt.decode(token);
      if (decodedJwt) {
        return `${keyPrefix}:id-${decodedJwt['id']}`;
      }
      const alg = strapi.plugin('strapi-cache').config('hashCacheKey') as string | undefined;
      return `${keyPrefix}:${hash(token, alg)}`;
  }
  return `${keyPrefix}`;
};

export const generateGraphqlCacheKey = (context: Context) => {
  
  const b64payload = b64encode(payload);
  const auth = strapi.plugin('strapi-cache').config('auth') as string;
  if (auth === 'before') {
    return `POST:/graphql:${b64payload}`;
  }
  const cacheAuthorizedRequests = strapi
      .plugin('strapi-cache')
      .config('cacheAuthorizedRequests') as boolean;
  const authorizationHeader = context.request.headers['authorization'];
  if (cacheAuthorizedRequests && authorizationHeader) {
      const token = authorizationHeader.replace(/^Bearer /, "");
      const decodedJwt = jwt.decode(token);
      if (decodedJwt) {
        return `POST:/graphql:${b64payload}:id-${decodedJwt['id']}`;
      }
      const alg = strapi.plugin('strapi-cache').config('hashCacheKey') as string | undefined;
      return `POST:/graphql:${b64payload}:${token}`;
  }
  return `POST:/graphql:${b64payload}`;
};
