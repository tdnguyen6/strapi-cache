import * as crypto from 'crypto';

export function hash(
  input: string,
  alg?: string,
  encoding: crypto.BinaryToTextEncoding = 'base64url'
) {
  return alg ? crypto.createHash(alg).update(input).digest(encoding) : input;
}
