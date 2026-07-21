export const LINE_PAY_POSTGRES_IMAGE =
  'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'

const reviewedDigestPattern = /^postgres@sha256:[0-9a-f]{64}$/

if (!reviewedDigestPattern.test(LINE_PAY_POSTGRES_IMAGE)) {
  throw new Error('LINE_PAY_POSTGRES_IMAGE_MUST_USE_REVIEWED_OFFICIAL_DIGEST')
}

if (
  LINE_PAY_POSTGRES_IMAGE !==
  'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
) {
  throw new Error('LINE_PAY_POSTGRES_IMAGE_DIGEST_DRIFT')
}
