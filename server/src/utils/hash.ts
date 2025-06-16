import * as crypto from 'crypto';

export function hash(input, alg = 'sha1', encoding: crypto.BinaryToTextEncoding = 'binary') {
  return crypto.createHash(alg).update(input).digest(encoding);
}
