import { Context } from 'koa';
import { b64encode } from './b64';
import * as jwt from 'jsonwebtoken';

export const generateCacheKey = (context: Context) => {
  const { url } = context.request;
  const { method } = context.request;
  const auth = strapi.plugin('strapi-cache').config('auth') as string;
  if (auth === 'before') {
    return `${method}:${url}`;
  }
  const cacheAuthorizedRequests = strapi
      .plugin('strapi-cache')
      .config('cacheAuthorizedRequests') as boolean;
  const authorizationHeader = context.request.headers['authorization'];
  if (cacheAuthorizedRequests && authorizationHeader) {
      const token = authorizationHeader.replace(/^Bearer /, "");
      const decodedJwt = jwt.decode(token);
      if (decodedJwt) {
        return `${method}:${url}:id-${decodedJwt['id']}`;
      }
      return `${method}:${url}:${token}`;
  }
  return `${method}:${url}`;
};

export const generateGraphqlCacheKey = (context: Context, payload: string) => {
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
      return `POST:/graphql:${b64payload}:${token}`;
  }
  return `POST:/graphql:${b64payload}`;
};
