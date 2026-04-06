const http = require('http');
const name = process.env.SERVICE_NAME || 'unknown';
const port = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: name }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `${name} placeholder`, version: '0.0.1' }));
  }
});

server.listen(port, () => console.log(`${name} listening on :${port}`));
