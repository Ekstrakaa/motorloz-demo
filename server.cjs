const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const port = 4173;
// Local-only environment loading keeps the OpenAI key out of browser assets.
try {
  const envFile = fs.readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch {}
const assistant = require('./gemini-assistant.cjs');

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function handleApi(req, res, pathname) {
  const action = pathname.startsWith('/api/assistant/') ? pathname.slice('/api/assistant/'.length) : '';
  if (!['status', 'chat', 'speech', 'speech-stream', 'summary'].includes(action)) return false;
  if (req.method === 'POST') {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4_500_000) {
          json(res, 413, { error: 'mensaje_muy_largo', message: 'El audio es demasiado largo. Probá con una nota más corta.' });
          return true;
        }
        chunks.push(chunk);
      }
      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      json(res, 400, { error: 'solicitud_invalida', message: 'No pude leer esa solicitud.' });
      return true;
    }
  }
  await assistant.handle(req, res, action);
  return true;
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm'
};

function sendFile(req, res, file, stats) {
  const contentType = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const commonHeaders = {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes'
  };
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { ...commonHeaders, 'Content-Length': stats.size });
    fs.createReadStream(file).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
    res.end();
    return;
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stats.size) {
    res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    ...commonHeaders,
    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
    'Content-Length': end - start + 1
  });
  fs.createReadStream(file, { start, end }).pipe(res);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).then(handled => {
      if (!handled && !res.headersSent) json(res, 404, { error: 'no_encontrado' });
    }).catch(() => {
      if (!res.headersSent && !res.destroyed) json(res, 500, { error: 'error_interno' });
    });
    return;
  }

  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    sendFile(req, res, file, stats);
  });
});

server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(item => item && item.family === 'IPv4' && !item.internal)
    .map(item => `http://${item.address}:${port}`);
  console.log(`MOTORLOZ local: http://127.0.0.1:${port}`);
  addresses.forEach(address => console.log(`MOTORLOZ celular: ${address}`));
});
