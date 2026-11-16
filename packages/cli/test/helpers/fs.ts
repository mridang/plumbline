import { access } from 'node:fs/promises';

export const pathExists = async (path: string | URL): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);
