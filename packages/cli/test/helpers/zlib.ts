import { brotliCompress, deflate, gzip } from 'node:zlib';
import { promisify } from 'node:util';

export const brotliCompressAsync = promisify(brotliCompress);
export const deflateAsync = promisify(deflate);
export const gzipAsync = promisify(gzip);
