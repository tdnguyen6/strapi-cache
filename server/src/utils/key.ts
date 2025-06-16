import { Context } from 'koa';
import { b64encode } from './b64';
import { hash } from './hash';

export const generateCacheKey = (context: Context) => {
  const { url } = context.request;
  const { method } = context.request;
  return `${method}:${url}`;
};

export const generateGraphqlCacheKey = (payload: string) => {
  const b64payload = b64encode(payload);
  return `POST:/graphql:${b64payload}`;
};
