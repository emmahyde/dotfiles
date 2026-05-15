#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');

program
  .argument('[file]', 'diagram.json file path')
  .option('-p, --port <number>', 'port number', '8000')
  .option('--mcp', 'MCP mode (not yet implemented)')
  .parse(process.argv);

const opts = program.opts();
const args = program.args;

if (opts.mcp) {
  console.log('MCP mode not yet implemented');
  process.exit(0);
}

const diagramFile = args[0] ? path.resolve(args[0]) : null;
const basePort = parseInt(opts.port, 10);
const distDir = path.join(__dirname, '..', 'dist');
const bundlePath = path.join(distDir, 'index.html');

// SSE clients
const sseClients = [];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function pushReload() {
  for (const res of sseClients) {
    try {
      res.write('data: reload\n\n');
    } catch {
      // client disconnected
    }
  }
}

function startWatcher() {
  if (!diagramFile) return;
  if (!fs.existsSync(diagramFile)) return;

  let debounce = null;
  fs.watch(diagramFile, () => {
    clearTimeout(debounce);
    debounce = setTimeout(pushReload, 50);
  });
}

function handleRequest(req, res) {
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname;

  if (req.method === 'GET' && pathname === '/') {
    const html = readFile(bundlePath);
    if (!html) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('bundle.html not found. Run npm run build first.');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && pathname === '/diagram') {
    if (!diagramFile) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    const data = readFile(diagramFile);
    if (!data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
    return;
  }

  if (req.method === 'POST' && pathname === '/save') {
    collectBody(req).then((body) => {
      const target = diagramFile || path.join(process.cwd(), 'diagram.json');
      fs.writeFileSync(target, body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(':\n\n'); // initial comment to establish connection

    sseClients.push(res);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
    return;
  }

  // Serve static assets from dist/
  const assetPath = path.join(distDir, pathname.replace(/^\//, ''));
  const asset = readFile(assetPath);
  if (asset) {
    const ext = path.extname(assetPath).toLowerCase();
    const mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(asset);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function tryListen(port, attemptsLeft) {
  if (attemptsLeft === 0) {
    console.error(`Could not bind to any port in range ${basePort}–${basePort + 10}. Exiting.`);
    process.exit(1);
  }

  const server = http.createServer(handleRequest);

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      tryListen(port + 1, attemptsLeft - 1);
    } else {
      console.error('Server error:', err.message);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const filename = diagramFile ? path.basename(diagramFile) : null;
    const url = filename
      ? `http://localhost:${port}/${filename}`
      : `http://localhost:${port}/`;

    console.log(`Serving at ${url}`);

    startWatcher();

    import('open').then(({ default: open }) => open(url)).catch(() => {
      // 'open' package unavailable; skip auto-open silently
    });
  });
}

tryListen(basePort, 11);
