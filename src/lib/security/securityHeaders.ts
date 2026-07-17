type SecurityHeader = {
  key: string
  value: string
}

const CONTENT_SECURITY_POLICY_REPORT_ONLY_DIRECTIVES = [
  ['default-src', ["'self'"]],
  ['base-uri', ["'self'"]],
  ['object-src', ["'none'"]],
  ['frame-ancestors', ["'self'"]],
  ['script-src', ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com']],
  ['style-src', ["'self'", "'unsafe-inline'"]],
  [
    'img-src',
    [
      "'self'",
      'data:',
      'blob:',
      'https://www.google-analytics.com',
      'https://region1.google-analytics.com',
      'https://www.googletagmanager.com',
    ],
  ],
  ['font-src', ["'self'", 'data:']],
  [
    'connect-src',
    [
      "'self'",
      'https://www.google-analytics.com',
      'https://region1.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://ndbqoznvobmpkgxkiezz.supabase.co',
      'wss://ndbqoznvobmpkgxkiezz.supabase.co',
    ],
  ],
  [
    'form-action',
    ["'self'", 'https://core.newebpay.com', 'https://ccore.newebpay.com'],
  ],
  ['frame-src', ["'self'"]],
  ['worker-src', ["'self'", 'blob:']],
  ['media-src', ["'self'", 'blob:']],
  ['manifest-src', ["'self'"]],
] as const

export function createContentSecurityPolicyReportOnly() {
  return CONTENT_SECURITY_POLICY_REPORT_ONLY_DIRECTIVES.map(
    ([directive, sources]) => `${directive} ${sources.join(' ')}`,
  ).join('; ')
}

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = createContentSecurityPolicyReportOnly()

export const SECURITY_HEADERS: SecurityHeader[] = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: CONTENT_SECURITY_POLICY_REPORT_ONLY,
  },
]
