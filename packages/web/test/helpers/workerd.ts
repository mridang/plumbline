/**
 * Runs code in the real Workers runtime (workerd, through Miniflare), for the
 * parts that need Cloudflare's own `HTMLRewriter`, which Node does not have.
 */

import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

/**
 * Bundles the function `name` exported by `module` (called with the request
 * body as text) and returns a function that runs it in workerd and returns its
 * JSON result. Call `dispose` when done.
 */
export async function inWorkerd<T>(
  module: string,
  name: string,
): Promise<{ run(text: string): Promise<T>; dispose(): Promise<void> }> {
  const bundled = await build({
    stdin: {
      contents: `import { ${name} } from ${JSON.stringify(module)};
export default {
  async fetch(request) {
    return Response.json(await ${name}(await request.text()));
  },
};`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    tsconfig: 'tsconfig.json',
  });
  const script = bundled.outputFiles[0]?.text ?? '';
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: 'test',
          compatibilityDate: '2026-05-01',
          manifest: {
            mainModule: 'worker.js',
            modules: { 'worker.js': { type: 'esm', contents: script } },
          },
        },
      },
    ],
  });
  return {
    async run(text) {
      const response = await mf.dispatchFetch('http://worker.test/', {
        method: 'POST',
        body: text,
      });
      return (await response.json()) as T;
    },
    dispose: () => mf.dispose(),
  };
}
