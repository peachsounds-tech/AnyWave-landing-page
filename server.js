const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function resolveFilePath(urlPath) {
  let filePath = urlPath.split('?')[0];
  filePath = decodeURIComponent(filePath);

  if (filePath === '/') {
    filePath = '/index.html';
  }

  let fullPath = path.join(ROOT_DIR, filePath);

  try {
    if (fs.statSync(fullPath).isDirectory()) {
      fullPath = path.join(fullPath, 'index.html');
    }
  } catch (e) {
    // Not found yet — let the exists check handle it
  }

  if (!fullPath.startsWith(ROOT_DIR)) {
    return null;
  }

  // Extensionless clean URLs: GitHub Pages serves "/download" from
  // "download.html". Mirror that locally so hand-off links like
  // beatcue.app/download work when tested against this dev server.
  if (!fs.existsSync(fullPath) && !path.extname(fullPath)) {
    const htmlCandidate = fullPath + '.html';
    if (fs.existsSync(htmlCandidate)) {
      fullPath = htmlCandidate;
    }
  }

  return fullPath;
}

function parseRange(rangeHeader, size) {
  // bytes=start-end | bytes=start- | bytes=-suffix
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if (!match) return null;

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);

  if (start === null && end === null) return null;

  if (start === null) {
    // suffix form: last N bytes
    const suffix = end;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    if (end === null || end >= size) end = size - 1;
    if (start >= size) return { unsatisfiable: true };
  }

  if (start < 0 || end < start) return { unsatisfiable: true };
  return { start, end };
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  const fullPath = resolveFilePath(req.url || '/');
  if (!fullPath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const contentType = contentTypeFor(fullPath);
    const size = stats.size;
    const rangeHeader = req.headers.range;

    // HEAD / full GET — advertise Accept-Ranges so media elements become seekable.
    if (!rangeHeader || req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Last-Modified': stats.mtime.toUTCString()
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    const range = parseRange(rangeHeader, size);
    if (!range) {
      res.writeHead(416, {
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes'
      });
      res.end();
      return;
    }
    if (range.unsatisfiable) {
      res.writeHead(416, {
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes'
      });
      res.end();
      return;
    }

    const { start, end } = range;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': chunkSize,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Last-Modified': stats.mtime.toUTCString()
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(fullPath, { start, end }).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${ROOT_DIR}`);
});
