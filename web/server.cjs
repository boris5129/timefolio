const { createServer } = require('node:http')
const { createReadStream } = require('node:fs')
const { join } = require('node:path')

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/ledger.js', ['ledger.js', 'text/javascript']],
])

const port = Number(process.env.TIMEFOLIO_WEB_PORT || 4173)
const server = createServer((request, response) => {
  const path = request.url?.split('?')[0]
  const asset = assets.get(path)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  if (!asset) {
    response.writeHead(path === '/favicon.ico' ? 204 : 404).end()
    return
  }
  const [file, type] = asset
  response.setHeader('Content-Type', type + '; charset=utf-8')
  if (request.method === 'HEAD') response.end()
  else createReadStream(join(__dirname, file)).on('error', () => {
    response.writeHead(500).end()
  }).pipe(response)
})
server.on('error', error => {
  console.error('Timefolio 서버를 시작하지 못했습니다. (' + error.code + ')')
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => console.log('Timefolio · http://127.0.0.1:' + port))
