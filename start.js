const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const HOST = 'localhost';

const server = http.createServer((req, res) => {
  // Ignore browser requests for system files
  if (req.url.startsWith('/.')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
    return;
  }

  // Default to index.html if root
  let filePath = req.url === '/' ? '/gm-role-manager.html' : req.url;
  filePath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  try {
    const realPath = path.resolve(__dirname);
    const realFilePath = path.resolve(filePath);
    if (!realFilePath.startsWith(realPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
  } catch (err) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Read and serve file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - File Not Found\n\nRequested: ' + req.url);
      return;
    }

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n=====================================');
  console.log('  Role Manager - Local Server');
  console.log('=====================================\n');
  console.log('Server running at: http://' + HOST + ':' + PORT);
  console.log('Open: http://' + HOST + ':' + PORT + '/gm-role-manager.html\n');
  console.log('Press Ctrl+C to stop\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use!');
    console.error('Try another port: PORT=8001 node start.js');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
