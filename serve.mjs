// Minimal static server for dist/ (local testing only).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const dist = join(process.cwd(), 'dist');
const port = Number(process.env.PORT) || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (!path || path.endsWith('/') || path.endsWith('\\')) path += 'index.html';
  try {
    const body = await readFile(join(dist, path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(join(dist, 'index.html'));
    res.writeHead(200, { 'content-type': types['.html'] });
    res.end(body);
  }
}).listen(port, () => console.log('Serving dist/ on http://localhost:' + port));
