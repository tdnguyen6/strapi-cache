export const withTimeout = (callback: (cancelRef?: {cancel: boolean}) => Promise<any>, ms: number) => {
  let timeout: NodeJS.Timeout | null = null;
  const cancelRef = {cancel: false};

  return Promise.race([
    callback(cancelRef).then((result) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      return result;
    }),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        cancelRef.cancel = true;
        reject(new Error('timeout'));
      }, ms);
    }),
  ]);
};
