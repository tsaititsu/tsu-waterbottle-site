import { createHash } from 'node:crypto'
import { createAiChartD1CanonicalJson } from './d1CommonContracts'

export function createAiChartD1CanonicalSha256(
  value: unknown,
): string {
  return createHash('sha256')
    .update(createAiChartD1CanonicalJson(value), 'utf8')
    .digest('hex')
}
