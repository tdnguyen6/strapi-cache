import { CacheProvider } from "src/types/cache.types";
import { sleepAsync } from "./sleep";
import { loggy } from "./log";

export async function waitCacheInit(cancelRef: {cancel: boolean}, cacheStore: CacheProvider, key, delayMs = 100) {
  const cacheEntry = await cacheStore.get(key);
  if (cacheEntry) {
    if (!cacheEntry.init) return cacheEntry;
    if (!cancelRef.cancel) {
      await sleepAsync(delayMs);
      await waitCacheInit(cancelRef, cacheStore, key, delayMs);
    } 
  }
  loggy.info(`INIT key: ${key}`);
  await cacheStore.set(key, { init: true });
}
