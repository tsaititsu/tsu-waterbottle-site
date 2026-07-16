import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http'
import { createGatewayHandler, type GatewayRequest, type GatewayResponse, type GatewayUpstreamFetch } from './app.js'
import { MAX_GATEWAY_BODY_BYTES, type GatewayConfig } from './security.js'

function normalizeHeaders(headers: IncomingHttpHeaders) {
  const normalized: Record<string, string | undefined> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string') normalized[name.toLowerCase()] = value
    else if (Array.isArray(value)) normalized[name.toLowerCase()] = value.join(',')
  }
  return normalized
}

async function readRequest(
  request: IncomingMessage,
): Promise<Pick<GatewayRequest, 'bodyText' | 'rawBody' | 'bodyByteLength'>> {
  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_GATEWAY_BODY_BYTES) {
    request.resume()
    return { bodyText: '', rawBody: Buffer.alloc(0), bodyByteLength: contentLength }
  }

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunkValue of request) {
    const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue)
    size += chunk.length
    if (size > MAX_GATEWAY_BODY_BYTES) {
      request.resume()
      return { bodyText: '', rawBody: Buffer.alloc(0), bodyByteLength: size }
    }
    chunks.push(chunk)
  }
  const rawBody = Buffer.concat(chunks)
  return { bodyText: rawBody.toString('utf8'), rawBody, bodyByteLength: size }
}

function sendJson(response: ServerResponse, gatewayResponse: GatewayResponse) {
  const bodyText = JSON.stringify(gatewayResponse.body)
  response.writeHead(gatewayResponse.statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(bodyText),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(bodyText)
}

export function createGatewayServer(config: GatewayConfig, fetchFn: GatewayUpstreamFetch) {
  const handler = createGatewayHandler(config, { fetchFn })
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://gateway.internal')
      const body = await readRequest(request)
      const gatewayResponse = await handler({
        method: request.method ?? 'GET',
        path: url.search ? `${url.pathname}${url.search}` : url.pathname,
        headers: normalizeHeaders(request.headers),
        ...(request.socket.remoteAddress ? { remoteAddress: request.socket.remoteAddress } : {}),
        ...body,
      })
      sendJson(response, gatewayResponse)
    } catch {
      sendJson(response, { statusCode: 500, body: { ok: false, error: 'internal_error' } })
    }
  })
}
