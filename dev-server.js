// AEGIS dev server — serves ui/ on port 1420 for cargo tauri dev
// Usage: node dev-server.js (from D:\Dev\aegis\)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 1420;
const UI_DIR = path.join(__dirname, 'ui');

const server = http.createServer((req, res) => {
  const filePath = path.join(UI_DIR, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Always serve index.html for SPA routing
      fs.readFile(path.join(UI_DIR, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AEGIS dev server: http://localhost:${PORT}`);
  console.log('Serving: ' + UI_DIR);
});
