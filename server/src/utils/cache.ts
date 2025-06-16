import { CacheProvider } from 'src/types/cache.types';
import { sleepAsync } from './sleep';
import { withTimeout } from './withTimeout';

async function _getCacheEntry(
  cancelRef: { cancel: boolean },
  cacheStore: CacheProvider,
  key,
  delayMs = 100
) {
  const cacheEntry = await cacheStore.get(key);
  if (cacheEntry) {
    if (!cacheEntry.init) return cacheEntry;
    if (!cancelRef.cancel) {
      await sleepAsync(delayMs);
      await _getCacheEntry(cancelRef, cacheStore, key, delayMs);
    }
  }
}

export async function getCacheEntry(
  cacheStore: CacheProvider,
  key,
  initCacheTimeoutInMs,
  delayMs = 100
) {
  return await withTimeout(
    (cancelRef) => _getCacheEntry(cancelRef, cacheStore, key, delayMs),
    initCacheTimeoutInMs
  );
}

export function statusIsCachable(ctx) {
  return (ctx.status >= 200 && ctx.status < 300) || ctx.status === 404;
}
