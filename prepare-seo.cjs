// Preparación local. No despliega ni conecta servicios; ejecutar con el dominio definitivo aprobado.
const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
if (!input) throw Error('Ingresá el dominio HTTPS definitivo.');
const url = new URL(input);
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password ||
    /(?:^|\.)(?:localhost|vercel\.app)$/.test(url.hostname) || url.hostname.includes('127.0.0.1')) {
  throw Error('Usá solamente el origen HTTPS del dominio definitivo, sin rutas ni parámetros.');
}
const base = url.origin;
const file = path.join(__dirname, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const demoRobots = '<meta name="robots" content="noindex, nofollow">';
const demoNotice = 'DEMO DE PROPUESTA · NO ES EL SITIO OFICIAL';
if (!html.includes(demoRobots) || !html.includes(demoNotice)) {
  throw Error('La demo ya fue preparada o cambió su estructura. Revisá antes de continuar.');
}
html = html.replace(demoRobots, '<meta name="robots" content="index, follow">');
html = html.replace(demoNotice, 'SITIO OFICIAL · MOTORLOZ');
html = html.replace(/<link rel="canonical"[^>]*>/g, '').replace(/<meta property="og:url"[^>]*>/g, '');
html = html.replace('</head>', `<link rel="canonical" href="${base}/"><meta property="og:url" content="${base}/"></head>`);
fs.writeFileSync(file, html);
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>\n`);
fs.writeFileSync(path.join(__dirname, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
console.log('SEO preparado para ' + base + '. No se publicó ningún archivo.');
