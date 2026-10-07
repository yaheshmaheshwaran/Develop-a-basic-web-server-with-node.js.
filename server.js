/**
 * =============================================
 *  PROJECT 3 – Basic Web Server with Node.js
 *  Pure http module — no Express, no frameworks
 * =============================================
 *
 *  Routes:
 *    GET  /            → HTML home page
 *    GET  /about       → About page
 *    GET  /api/info    → JSON API info
 *    GET  /api/time    → JSON current server time
 *    POST /api/echo    → Echoes JSON body back
 *    *                 → 404 page
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ─── Config ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// ─── MIME Types ────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

// ─── Helpers ───────────────────────────────────────────────────

/** Send a JSON response */
function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

/** Send an HTML response */
function sendHTML(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/** Read request body as string */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Logger middleware */
function log(req, statusCode) {
  const now  = new Date().toISOString();
  const ms   = Date.now();
  const line = `[${now}] ${req.method} ${req.url} → ${statusCode}`;
  console.log(line);
}

// ─── HTML Templates ────────────────────────────────────────────
const layout = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | NodeServer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }
    nav { background: #161b22; border-bottom: 1px solid #30363d; padding: 1rem 2rem; display: flex; align-items: center; gap: 2rem; }
    .brand { font-size: 1.2rem; font-weight: 700; color: #7c3aed; }
    nav a { color: #8b949e; text-decoration: none; font-size: .9rem; transition: color .2s; }
    nav a:hover, nav a.active { color: #e6edf3; }
    main { max-width: 900px; margin: 3rem auto; padding: 0 1.5rem; }
    .hero { text-align: center; padding: 3rem 1rem; }
    .hero h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: .75rem; background: linear-gradient(135deg, #7c3aed, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { color: #8b949e; font-size: 1.05rem; }
    .badge { display: inline-block; background: #7c3aed22; color: #a78bfa; border: 1px solid #7c3aed55; border-radius: 999px; padding: .2rem .75rem; font-size: .8rem; margin-bottom: 1rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin: 2.5rem 0; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 1.5rem; transition: border-color .2s, transform .2s; }
    .card:hover { border-color: #7c3aed; transform: translateY(-3px); }
    .card .icon { font-size: 2rem; margin-bottom: .75rem; }
    .card h3 { font-size: 1rem; font-weight: 600; margin-bottom: .4rem; }
    .card p { font-size: .85rem; color: #8b949e; }
    .routes { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 1.5rem; margin: 2rem 0; }
    .routes h2 { margin-bottom: 1rem; font-size: 1.1rem; }
    .route-row { display: flex; align-items: center; gap: 1rem; padding: .65rem 0; border-bottom: 1px solid #21262d; font-size: .88rem; }
    .route-row:last-child { border-bottom: none; }
    .method { padding: .2rem .55rem; border-radius: 6px; font-weight: 700; font-size: .75rem; min-width: 45px; text-align: center; }
    .get  { background: #0d419d33; color: #58a6ff; }
    .post { background: #18803733; color: #3fb950; }
    .path { font-family: monospace; color: #a78bfa; }
    .desc { color: #8b949e; }
    .demo-btn {
      display: inline-block; margin-top: 1.5rem; padding: .75rem 2rem;
      background: linear-gradient(135deg, #7c3aed, #a78bfa); border: none;
      border-radius: 10px; color: #fff; font-size: .95rem; font-weight: 600;
      text-decoration: none; cursor: pointer; transition: transform .2s, box-shadow .2s;
    }
    .demo-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(124,58,237,.4); }
    .about-content { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 2rem; }
    .about-content h2 { margin-bottom: 1rem; }
    .about-content p { color: #8b949e; margin-bottom: .75rem; line-height: 1.7; }
    .about-content code { background: #21262d; padding: .1rem .4rem; border-radius: 4px; font-family: monospace; font-size: .88rem; color: #a78bfa; }
    .status-ok { color: #3fb950; font-weight: 700; }
    footer { text-align: center; color: #8b949e; font-size: .82rem; padding: 2rem; margin-top: 2rem; border-top: 1px solid #21262d; }
  </style>
</head>
<body>
  <nav>
    <span class="brand">⚡ NodeServer</span>
    <a href="/" class="${title === 'Home' ? 'active' : ''}">Home</a>
    <a href="/about" class="${title === 'About' ? 'active' : ''}">About</a>
    <a href="/api/info" target="_blank">API Info</a>
    <a href="/api/time" target="_blank">API Time</a>
  </nav>
  <main>${body}</main>
  <footer>Built with pure Node.js http module • No frameworks • Running on port ${PORT}</footer>
</body>
</html>`;

const homePage = layout('Home', `
  <div class="hero">
    <span class="badge">🚀 Running on Node.js ${process.version}</span>
    <h1>Basic Web Server</h1>
    <p>A fully-featured HTTP server built with <strong>zero dependencies</strong> — just Node.js built-ins.</p>
    <a class="demo-btn" href="/api/info">View API →</a>
  </div>

  <div class="cards">
    <div class="card"><div class="icon">🔀</div><h3>Routing</h3><p>GET, POST routes handled manually using url parsing.</p></div>
    <div class="card"><div class="icon">📦</div><h3>JSON API</h3><p>REST-style endpoints returning structured JSON responses.</p></div>
    <div class="card"><div class="icon">📁</div><h3>Static Files</h3><p>Serves static files from the <code>public/</code> directory.</p></div>
    <div class="card"><div class="icon">📝</div><h3>Logging</h3><p>Every request is timestamped and logged to the console.</p></div>
    <div class="card"><div class="icon">❗</div><h3>Error Pages</h3><p>Custom 404 and 500 error pages with full HTML.</p></div>
    <div class="card"><div class="icon">🔒</div><h3>CORS Headers</h3><p>API responses include proper CORS headers for browser access.</p></div>
  </div>

  <div class="routes">
    <h2>📍 Available Routes</h2>
    <div class="route-row"><span class="method get">GET</span><span class="path">/</span><span class="desc">Home page (this page)</span></div>
    <div class="route-row"><span class="method get">GET</span><span class="path">/about</span><span class="desc">About this server</span></div>
    <div class="route-row"><span class="method get">GET</span><span class="path">/api/info</span><span class="desc">Server information as JSON</span></div>
    <div class="route-row"><span class="method get">GET</span><span class="path">/api/time</span><span class="desc">Current server time as JSON</span></div>
    <div class="route-row"><span class="method post">POST</span><span class="path">/api/echo</span><span class="desc">Echoes request body back as JSON</span></div>
    <div class="route-row"><span class="method get">GET</span><span class="path">/*</span><span class="desc">404 — Not Found</span></div>
  </div>
`);

const aboutPage = layout('About', `
  <div class="about-content">
    <h2>About This Server</h2>
    <p>This is <strong>Project 3</strong> — a basic web server written entirely with Node.js's built-in <code>http</code> module. No Express, no Fastify, no external packages.</p>
    <p>It demonstrates how HTTP servers work at a fundamental level:</p>
    <ul style="color:#8b949e; padding-left:1.5rem; line-height:2">
      <li>Parsing request URLs and methods</li>
      <li>Reading request bodies (for POST requests)</li>
      <li>Writing response headers and bodies</li>
      <li>Serving HTML pages and JSON APIs</li>
      <li>Handling static files with MIME types</li>
      <li>Custom 404 / 500 error handling</li>
    </ul>
    <p style="margin-top:1rem">Server Status: <span class="status-ok">● Online</span> | Node: <code>${process.version}</code> | Platform: <code>${process.platform}</code></p>
  </div>
`);

const notFoundPage = layout('404', `
  <div class="hero">
    <h1 style="font-size:5rem">404</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a class="demo-btn" href="/" style="margin-top:1.5rem">← Go Home</a>
  </div>
`);

const serverErrorPage = layout('500', `
  <div class="hero">
    <h1 style="font-size:5rem">500</h1>
    <p>Something went wrong on the server.</p>
    <a class="demo-btn" href="/" style="margin-top:1.5rem">← Go Home</a>
  </div>
`);

// ─── Router ────────────────────────────────────────────────────
async function router(req, res) {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  try {
    // ── GET /
    if (method === 'GET' && pathname === '/') {
      log(req, 200);
      return sendHTML(res, 200, homePage);
    }

    // ── GET /about
    if (method === 'GET' && pathname === '/about') {
      log(req, 200);
      return sendHTML(res, 200, aboutPage);
    }

    // ── GET /api/info
    if (method === 'GET' && pathname === '/api/info') {
      log(req, 200);
      return sendJSON(res, 200, {
        success: true,
        server: 'Node.js Built-in HTTP',
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        uptime: `${Math.floor(process.uptime())}s`,
        memoryMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        routes: ['GET /', 'GET /about', 'GET /api/info', 'GET /api/time', 'POST /api/echo'],
      });
    }

    // ── GET /api/time
    if (method === 'GET' && pathname === '/api/time') {
      log(req, 200);
      const now = new Date();
      return sendJSON(res, 200, {
        success: true,
        iso: now.toISOString(),
        timestamp: now.getTime(),
        utc: now.toUTCString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    // ── POST /api/echo
    if (method === 'POST' && pathname === '/api/echo') {
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw); } catch { body = { raw }; }
      log(req, 200);
      return sendJSON(res, 200, { success: true, echo: body, receivedAt: new Date().toISOString() });
    }

    // ── CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    // ── Static files from /public
    if (method === 'GET') {
      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(__dirname, 'public', safePath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext  = path.extname(filePath);
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
        log(req, 200);
        return;
      }
    }

    // ── 404
    log(req, 404);
    sendHTML(res, 404, notFoundPage);

  } catch (err) {
    console.error('Server error:', err);
    log(req, 500);
    sendHTML(res, 500, serverErrorPage);
  }
}

// ─── Start Server ──────────────────────────────────────────────
const server = http.createServer(router);

server.listen(PORT, HOST, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  ⚡ NodeServer running!                 ║`);
  console.log(`║  Local:  http://localhost:${PORT}           ║`);
  console.log(`║  Routes: GET / | /about | /api/info    ║`);
  console.log(`║  POST:   /api/echo                     ║`);
  console.log('╚════════════════════════════════════════╝\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌  Port ${PORT} is already in use. Try PORT=3001 node server.js`);
  } else {
    console.error('❌  Server error:', err.message);
  }
  process.exit(1);
});

// ─── Graceful shutdown ─────────────────────────────────────────
process.on('SIGINT',  () => { console.log('\n🛑  Server shutting down…'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
