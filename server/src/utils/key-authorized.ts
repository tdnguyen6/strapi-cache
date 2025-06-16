import { createHash } from 'crypto';
import { Context } from 'koa';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';


const hash = (input, alg = "sha1") => {
  const algList = crypto.getHashes();
  if (!algList.includes(alg)) {
    throw new Error (`NotImplementedError: ${alg} is not implemented by nodejs crypto`);
  }
  return crypto.createHash(alg).update(input).digest();
}

export const generateCacheKey = (context: Context) => hash(generateRawCacheKey(context));

export const generateRawCacheKey = (context: Context) => {
  const { url } = context.request;
  const { method } = context.request;
  const cacheAuthorizedRequests = strapi
      .plugin('strapi-cache')
      .config('cacheAuthorizedRequests') as boolean;
  if (cacheAuthorizedRequests) {
    const authorizationHeader = context.request.headers['authorization'];
    if (authorizationHeader) {
      const token = authorizationHeader.replace(/^Bearer /, "");
      const decodedJwt = jwt.decode(token);
      if (decodedJwt) {
        return `${method}:id-${decodedJwt['id']}:${url}`;
      }
      return `${method}:${token}:${url}`;
    }
  }
  
  return `${method}:${url}`;
};

export const generateGraphqlCacheKey = (payload: string) => {
  const hash = createHash('sha256').update(payload).digest('base64url');
  return `POST:/graphql:${hash}`;
};
