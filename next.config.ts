import type { NextConfig } from 'next'
import { SECURITY_HEADERS } from './src/lib/security/securityHeaders'

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

export default nextConfig
