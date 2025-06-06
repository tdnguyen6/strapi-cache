import { promises as fs } from 'fs';
export const withTimeout = (callback: () => Promise<any>, ms: number) => {
  let timeout: NodeJS.Timeout | null = null;

  return Promise.race([
    callback().then((result) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      return result;
    }),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('timeout'));
      }, ms);
    }),
  ]);
};

export const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function main() {
  

for (let i = 0; i < 20; i++) {
  const f = await withTimeout(() => fs.readFile('./a.txt','utf8'), 100);
  console.log(f);
  if (f) break;
  await sleep(5000);
}

}
main()
