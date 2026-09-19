// Local static-project artifact harness. No application/API fallback or redirects.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../../apps/site/project-dist/', import.meta.url);
const types = {
  html: 'text/html',
  css: 'text/css',
  svg: 'image/svg+xml',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain',
};
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost:4425').pathname;
  const name =
    path === '/mutuallens/'
      ? 'index.html'
      : path.replace(/^\/mutuallens\//, '');
  const allowed =
    /^(index\.html|404\.html|project\.css|favicon\.svg|build-info\.json|robots\.txt|sitemap\.xml)$/;
  const exists = path.startsWith('/mutuallens/') && allowed.test(name);
  response.statusCode = exists ? 200 : 404;
  const target = exists ? name : '404.html';
  response.setHeader(
    'Content-Type',
    types[target.split('.').at(-1)] || 'application/octet-stream',
  );
  response.end(await readFile(new URL(target, root)));
}).listen(4425, '127.0.0.1');
