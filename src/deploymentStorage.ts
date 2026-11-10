/** Browser storage stays local to each hosted app/PR path; exports keep their logical keys. */
export type DeploymentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function createDeploymentStorage(
  baseUrl: string,
  readStorage: () => Storage = () => globalThis.localStorage,
): DeploymentStorage {
  const base = `${baseUrl.replace(/\/+$/, '')}/`;
  // Keep existing root installations and their saved data compatible.
  const prefix = base === '/' ? '' : `__biomechanics_deployment__:${encodeURIComponent(base)}:`;
  const physicalKey = (key: string) => `${prefix}${key}`;
  const keys = (storage: Storage): string[] => {
    const result: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(prefix)) result.push(key.slice(prefix.length));
    }
    return result;
  };

  // Resolve native storage on every operation: browser privacy settings can block
  // access, and callers already handle those errors without pretending a save worked.
  return {
    getItem: key => readStorage().getItem(physicalKey(key)),
    setItem: (key, value) => readStorage().setItem(physicalKey(key), value),
    removeItem: key => readStorage().removeItem(physicalKey(key)),
    key: index => prefix ? keys(readStorage())[index] ?? null : readStorage().key(index),
    get length() { return prefix ? keys(readStorage()).length : readStorage().length; },
  };
}

const baseUrl = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL;
export const deploymentStorage = createDeploymentStorage(baseUrl);
