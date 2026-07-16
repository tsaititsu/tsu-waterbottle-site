import { createGatewayServer } from './server.js'
import { loadGatewayConfig } from './security.js'

const config = loadGatewayConfig(process.env)
const server = createGatewayServer(config, async (url, init) => {
  const response = await fetch(url, init)
  return { status: response.status, text: () => response.text() }
})

server.listen(config.port, '0.0.0.0')
