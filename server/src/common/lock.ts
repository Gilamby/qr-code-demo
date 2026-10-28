/* Eén ding tegelijk per sleutel (in dit proces): lezen → aanpassen → opslaan van een lijst in settings
   (feedback, aanmeldingen, formulier). Zonder dit kan bij twee inzendingen op hetzelfde moment er één verloren gaan. */
const chains = new Map<string, Promise<unknown>>();
export function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}
