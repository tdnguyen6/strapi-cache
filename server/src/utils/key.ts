import * as jwt from 'jsonwebtoken';
import { hash } from './hash';
import stringify from 'fast-json-stable-stringify';
import { parse } from 'graphql';

const _generateCacheKey = (
  method: string,
  path: string,
  payload: {} | undefined,
  auth?: string
) => {
  const prefix = `${method}:${path}`;
  const suffixes = [];
  if (payload) {
    const deterministicPayload = stringify(payload);
    suffixes.push(deterministicPayload);
  }
  if (auth) {
    suffixes.push(auth);
  }
  const suffixToHash = suffixes.join('');
  if (!suffixToHash) return prefix;
  const alg = strapi.plugin('strapi-cache').config('hashCacheKey') as string | undefined;
  const hashedSuffix = hash(stringify(suffixToHash), alg);
  return `${prefix}:${hashedSuffix}`;
};

const generateCacheKeyWithAuth = (
  method: string,
  path: string,
  payload: {} | undefined,
  authorizationHeader: string
) => {
  const token = authorizationHeader.replace(/^Bearer /, '');
  const decodedJwt = jwt.decode(token);
  if (decodedJwt) {
    return _generateCacheKey(method, path, payload, `id-${decodedJwt['id']}`);
  }
  return _generateCacheKey(method, path, payload, token);
};

export const generateCacheKey = (
  method: string,
  path: string,
  payload: {} | undefined,
  authorizationHeader: string
) => {
  return authorizationHeader
    ? generateCacheKeyWithAuth(method, path, payload, authorizationHeader)
    : _generateCacheKey(method, path, payload);
};
