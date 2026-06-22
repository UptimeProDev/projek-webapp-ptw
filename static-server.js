const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8000;
const root = process.cwd();

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  try {
    const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
    const routePath = safePath.replace(/\\/g, '/');
    let filePath = path.join(root, safePath);

    // Provide auth path support on the static server
    if (routePath === '/login' || routePath === '/signup') {
      filePath = path.join(root, 'index.html');
    }

    // Provide admin path support on the static server
    if (routePath === '/admin' || routePath === '/admin.html') {
      filePath = path.join(root, 'admin.html');
    }

    // Provide requester dashboard path support on the static server
    if (routePath === '/dashboard' || routePath === '/dashboard.html') {
      filePath = path.join(root, 'dashboard.html');
    }

    if (routePath === '/safety' || routePath === '/safety.html') {
      filePath = path.join(root, 'safety.html');
    }

    if (
      routePath === '/review' ||
      routePath === '/review.html' ||
      routePath === '/supervisor' ||
      routePath === '/supervisor.html' ||
      routePath === '/approver' ||
      routePath === '/approver.html'
    ) {
      filePath = path.join(root, 'supervisor.html');
    }

    if (routePath === '/worker' || routePath === '/worker.html') {
      filePath = path.join(root, 'worker.html');
    }

    // If requesting root or a directory, serve index.html inside it
    if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');

    // If it's a directory without trailing slash, attempt index.html
    if (!path.extname(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }

    // Fallback to index.html for single-page apps
    if (!fs.existsSync(filePath)) {
      const fallback = path.join(root, 'index.html');
      if (fs.existsSync(fallback)) {
        filePath = fallback;
      }
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mime[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}/`);
});
