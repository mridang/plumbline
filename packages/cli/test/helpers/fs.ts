import { access } from 'node:fs/promises';

export const pathExists = (path: string | URL): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);
