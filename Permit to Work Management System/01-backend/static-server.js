const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8000;
const root = process.cwd();
const sourceRoot = path.join(root, 'Permit to Work Management System');
const authRoot = path.join(sourceRoot, '02-authentication');
const roleRoot = path.join(sourceRoot, '03-roles');
const sharedRoot = path.join(sourceRoot, '04-shared');
const assetRoot = path.join(sourceRoot, '05-assets', 'assets');

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

function authFile(section, fileName) {
  return path.join(authRoot, section, fileName);
}

function roleFile(role, fileName) {
  return path.join(roleRoot, role, fileName);
}

function sharedFile(section, fileName) {
  return path.join(sharedRoot, section, fileName);
}

const routeFiles = new Map([
  ['/', authFile('sign-in-sign-up', 'index.html')],
  ['/index.html', authFile('sign-in-sign-up', 'index.html')],
  ['/login', authFile('sign-in-sign-up', 'index.html')],
  ['/login.html', authFile('sign-in-sign-up', 'index.html')],
  ['/signup', authFile('sign-in-sign-up', 'index.html')],
  ['/signup.html', authFile('sign-in-sign-up', 'index.html')],
  ['/style.css', authFile('sign-in-sign-up', 'style.css')],
  ['/app.js', authFile('sign-in-sign-up', 'app.js')],
  ['/activate', authFile('activation', 'activate.html')],
  ['/activate.html', authFile('activation', 'activate.html')],
  ['/activate.css', authFile('activation', 'activate.css')],
  ['/activate.js', authFile('activation', 'activate.js')],
  ['/dashboard', roleFile('requester', 'dashboard.html')],
  ['/dashboard.html', roleFile('requester', 'dashboard.html')],
  ['/dashboard.css', roleFile('requester', 'dashboard.css')],
  ['/dashboard.js', roleFile('requester', 'dashboard.js')],
  ['/requester-dashboard.js', roleFile('requester', 'requester-dashboard.js')],
  ['/organization', roleFile('organization-admin', 'organization.html')],
  ['/organization.html', roleFile('organization-admin', 'organization.html')],
  ['/organization.css', roleFile('organization-admin', 'organization.css')],
  ['/organization.js', roleFile('organization-admin', 'organization.js')],
  ['/admin', roleFile('admin', 'admin.html')],
  ['/admin.html', roleFile('admin', 'admin.html')],
  ['/admin.css', roleFile('admin', 'admin.css')],
  ['/admin.js', roleFile('admin', 'admin.js')],
  ['/safety', roleFile('safety-officer', 'safety.html')],
  ['/safety.html', roleFile('safety-officer', 'safety.html')],
  ['/safety.css', roleFile('safety-officer', 'safety.css')],
  ['/safety.js', roleFile('safety-officer', 'safety.js')],
  ['/review', roleFile('supervisor', 'supervisor.html')],
  ['/review.html', roleFile('supervisor', 'supervisor.html')],
  ['/supervisor', roleFile('supervisor', 'supervisor.html')],
  ['/supervisor.html', roleFile('supervisor', 'supervisor.html')],
  ['/approver', roleFile('supervisor', 'supervisor.html')],
  ['/approver.html', roleFile('supervisor', 'supervisor.html')],
  ['/supervisor.css', roleFile('supervisor', 'supervisor.css')],
  ['/supervisor.js', roleFile('supervisor', 'supervisor.js')],
  ['/worker', roleFile('worker', 'worker.html')],
  ['/worker.html', roleFile('worker', 'worker.html')],
  ['/worker.css', roleFile('worker', 'worker.css')],
  ['/worker.js', roleFile('worker', 'worker.js')],
  ['/account', sharedFile('account', 'account.html')],
  ['/account.html', sharedFile('account', 'account.html')],
  ['/account.css', sharedFile('account', 'account.css')],
  ['/account.js', sharedFile('account', 'account.js')],
  ['/support', sharedFile('support', 'support.html')],
  ['/support.html', sharedFile('support', 'support.html')],
  ['/support.css', sharedFile('support', 'support.css')],
  ['/support.js', sharedFile('support', 'support.js')],
  ['/role-switcher.js', sharedFile('scripts', 'role-switcher.js')],
  ['/ptw-flow.css', sharedFile('styles', 'ptw-flow.css')],
]);

const server = http.createServer((req, res) => {
  try {
    const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
    const routePath = safePath.replace(/\\/g, '/');
    let filePath = routeFiles.get(routePath);

    if (!filePath && routePath.startsWith('/assets/')) {
      filePath = path.join(assetRoot, routePath.slice('/assets/'.length));
    }

    if (!filePath) {
      filePath = path.join(sourceRoot, safePath);
    }

    // If requesting root or a directory, serve index.html inside it
    if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');

    // If it's a directory without trailing slash, attempt index.html
    if (!path.extname(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }

    // Fallback to index.html for single-page apps
    if (!fs.existsSync(filePath)) {
      const fallback = authFile('sign-in-sign-up', 'index.html');
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
