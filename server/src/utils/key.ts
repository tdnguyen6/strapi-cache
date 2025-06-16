import { b64encode } from './b64';
import { hash } from './hash';

export const generateCacheKey = (context: Context, alg?: string) => {
  const { url } = context.request;
  const { method } = context.request;
  const keyPlainText = `${method}:${url}`;

  return alg ? hash(keyPlainText, alg) : keyPlainText;
};

export const generateGraphqlCacheKey = (payload: string, alg?: string) => {
  const b64payload = b64encode(payload);
  const keyPlainText = `POST:/graphql:${b64payload}`;
  return alg ? hash(keyPlainText, alg) : keyPlainText;
};
