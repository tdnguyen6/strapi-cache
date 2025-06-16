import * as crypto from 'crypto';

export const hash = (input, alg = 'sha1', encoding: crypto.BinaryToTextEncoding = 'binary') => {
  return crypto.createHash(alg).update(input).digest(encoding);
};
