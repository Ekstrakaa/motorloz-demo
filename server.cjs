const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const port = 4173;
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
