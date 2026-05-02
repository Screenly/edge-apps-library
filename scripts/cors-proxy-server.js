import http from 'http'
import https from 'https'
import { URL } from 'url'

const MAX_REDIRECTS = 10

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
  )
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function handleRedirect(
  location,
  req,
  res,
  proxyRes,
  currentUrl,
  redirectCount,
) {
  if (redirectCount >= MAX_REDIRECTS) {
    proxyRes.resume()
    res.writeHead(508, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Too many redirects' }))
    return
  }

  try {
    const redirectUrl = new URL(location, currentUrl)
    if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
      proxyRes.resume()
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid redirect location' }))
      return
    }
    const redirectModule = redirectUrl.protocol === 'https:' ? https : http
    proxyRes.resume()
    makeProxyRequest(redirectModule, redirectUrl, req, res, redirectCount + 1)
  } catch {
    proxyRes.resume()
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid redirect location' }))
  }
}

function handleProxyResponse(proxyRes, req, res, currentUrl, redirectCount) {
  if (
    proxyRes.statusCode >= 301 &&
    proxyRes.statusCode <= 308 &&
    proxyRes.headers.location &&
    ['GET', 'HEAD'].includes(req.method)
  ) {
    handleRedirect(
      proxyRes.headers.location,
      req,
      res,
      proxyRes,
      currentUrl,
      redirectCount,
    )
    return
  }

  const excludeHeaders = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
  ]

  Object.keys(proxyRes.headers).forEach((key) => {
    if (!excludeHeaders.includes(key.toLowerCase())) {
      res.setHeader(key, proxyRes.headers[key])
    }
  })

  setCorsHeaders(res)
  res.writeHead(proxyRes.statusCode)
  proxyRes.pipe(res)
}

function makeProxyRequest(httpModule, parsedUrl, req, res, redirectCount = 0) {
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedUrl.host,
    },
    rejectUnauthorized: false,
  }

  delete options.headers['x-forwarded-for']
  delete options.headers['x-forwarded-proto']
  delete options.headers['x-forwarded-host']

  const proxyReq = httpModule.request(options, (proxyRes) =>
    handleProxyResponse(proxyRes, req, res, parsedUrl, redirectCount),
  )

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error.message)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Proxy error', message: error.message }))
    }
  })

  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy()
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Gateway timeout' }))
    }
  })

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
}

function handleProxyRequest(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const urlMatch = req.url.match(/^\/(https?:\/\/.+)$/)

  if (!urlMatch) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: 'Invalid request format. Expected: /{protocol}://{host}/{path}',
      }),
    )
    return
  }

  const targetUrl = urlMatch[1]

  try {
    const parsedUrl = new URL(targetUrl)
    console.log(`Proxying ${req.method} request to: ${targetUrl}`)

    const httpModule = parsedUrl.protocol === 'https:' ? https : http
    makeProxyRequest(httpModule, parsedUrl, req, res)
  } catch (error) {
    console.error('Invalid URL:', targetUrl, error.message)
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: 'Invalid URL format',
        message: error.message,
      }),
    )
  }
}

export function start() {
  const host = process.env.HOST || '0.0.0.0'
  const port = process.env.PORT || 8080

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  const server = http.createServer((req, res) => {
    handleProxyRequest(req, res)
  })

  server.listen(port, host, () => {
    console.log(
      `Running CORS Proxy (Node.js built-ins) on http://${host}:${port}`,
    )
  })
}
