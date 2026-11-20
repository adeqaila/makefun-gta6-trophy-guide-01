// Leonida Legend dev server: serves app/ on http://localhost:8080 so the guide can be
// tried in a desktop browser with no build step. Usage: `node serve.ts [--port <n>]`.
// Node standard library only; it refuses every path that escapes app/ and answers
// 404 for anything that is not a plain file inside it.

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(fileURLToPath(new URL('./app', import.meta.url)));

// Pick the port from --port when it names a real one, otherwise fall back to 8080.
function pickPort(argv) {
  const at = argv.indexOf('--port');
  if (at === -1) return 8080;
  const n = Number(argv[at + 1]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

const PORT = pickPort(process.argv.slice(2));

function mimeFor(file) {
  switch (extname(file).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

const server = createServer(async (request, response) => {
  let path = '/';
  try {
    path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (path.endsWith('/')) path += 'index.html';

  // Resolve inside app/ and refuse anything that climbs out of it.
  const file = resolve(join(APP_ROOT, path));
  if (file !== APP_ROOT && !file.startsWith(APP_ROOT + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': mimeFor(file),
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Leonida Legend is on http://localhost:${PORT}`);
});
