import { parse } from 'querystringify';

export const qsparse = (url) => {
  const parts = url.split("?");
  return {
    path: parts[0],
    query: parts[1] ? parse(parts[1]) : undefined
  }
}
