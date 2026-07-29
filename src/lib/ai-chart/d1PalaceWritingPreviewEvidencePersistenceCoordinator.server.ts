import 'server-only'

import {
  buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
} from './d1PalaceWritingPreviewEvidencePersistenceContracts'
import {
  persistAiChartD1PalaceWritingPreviewEvidence,
  type AiChartD1PalaceWritingPreviewPersistedEvidence,
} from './d1PalaceWritingPreviewEvidenceWriter.server'

export async function persistAiChartD1PalaceWritingPreviewTerminalEvidence(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    executionLedger: unknown
  }>,
): Promise<AiChartD1PalaceWritingPreviewPersistedEvidence> {
  const envelope =
    buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(input)

  return persistAiChartD1PalaceWritingPreviewEvidence({
    previewPlan: input.previewPlan,
    gatePlan: input.gatePlan,
    envelope,
  })
}
