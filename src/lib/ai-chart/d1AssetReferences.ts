import type { AiChartD1AssetManifest } from './d1Assets'

export const AI_CHART_D1_PRIMARY_SPEC_PATH =
  'content/ai-chart/d1-v1/spec/primary/20_D1_本命人格推理總控流程.md' as const
export const AI_CHART_D1_REQUIRED_REFERENCE_INVALID =
  'ai_chart_d1_required_asset_reference_invalid' as const

const PRIMARY_KNOWLEDGE_SECTION = '## 三、編排器可用知識來源'

export type AiChartD1RequiredReasoningAsset = {
  fileName: string
  path: string
  sourcePath: string
}

const requiredReasoningAssets: AiChartD1RequiredReasoningAsset[] = [
  {
    fileName: '07_四化正式規格_工作版.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/07_四化正式規格_工作版.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /07_四化正式規格_工作版.md',
  },
  {
    fileName: '08_固定雙主星整理骨架.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/08_固定雙主星整理骨架.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /08_固定雙主星整理骨架.md',
  },
  {
    fileName: '10_D1_全盤掃描與煞忌權重.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/10_D1_全盤掃描與煞忌權重.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /10_D1_全盤掃描與煞忌權重.md',
  },
  {
    fileName: '12_D1_對宮暗合三方四正.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/12_D1_對宮暗合三方四正.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /12_D1_對宮暗合三方四正.md',
  },
  {
    fileName: '13_D1_空宮借星與身宮.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/13_D1_空宮借星與身宮.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /13_D1_空宮借星與身宮.md',
  },
  {
    fileName: '14_D1_輔星煞星貴人星祿存.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/14_D1_輔星煞星貴人星祿存.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /14_D1_輔星煞星貴人星祿存.md',
  },
  {
    fileName: '16_D1_地支四馬地規則.md',
    path: 'content/ai-chart/d1-v1/knowledge/reasoning/16_D1_地支四馬地規則.md',
    sourcePath:
      'AI 命盤 OpenAI/SOP重構版_v1.0/紫微斗數_AI推理引擎_工作區 /16_D1_地支四馬地規則.md',
  },
]

for (const asset of requiredReasoningAssets) Object.freeze(asset)

export const AI_CHART_D1_REQUIRED_REASONING_ASSETS = Object.freeze(
  requiredReasoningAssets,
) as readonly AiChartD1RequiredReasoningAsset[]

function referenceInvalid(): never {
  throw new Error(AI_CHART_D1_REQUIRED_REFERENCE_INVALID)
}

function readPrimaryKnowledgeReferences(primarySpecText: string): Set<string> {
  if (typeof primarySpecText !== 'string') referenceInvalid()

  const lines = primarySpecText.split(/\r?\n/)
  const sectionStart = lines.findIndex(
    (line) => line.trim() === PRIMARY_KNOWLEDGE_SECTION,
  )
  if (sectionStart < 0) referenceInvalid()

  const nextSectionOffset = lines
    .slice(sectionStart + 1)
    .findIndex((line) => line.startsWith('## '))
  if (nextSectionOffset < 0) referenceInvalid()

  const sectionLines = lines.slice(
    sectionStart + 1,
    sectionStart + 1 + nextSectionOffset,
  )
  const references = new Set<string>()

  for (const line of sectionLines) {
    const match = /^\d+\.\s+`([^`]+)`$/.exec(line.trim())
    if (match) references.add(match[1])
  }

  return references
}

export function assertAiChartD1RequiredAssetReferences(
  manifest: AiChartD1AssetManifest,
  primarySpecText: string,
): void {
  try {
    const primaryReferences = readPrimaryKnowledgeReferences(primarySpecText)
    const requiredPaths = new Set<string>()
    const requiredSourcePaths = new Set<string>()

    for (const required of AI_CHART_D1_REQUIRED_REASONING_ASSETS) {
      if (!primaryReferences.has(required.fileName)) referenceInvalid()
      if (requiredPaths.has(required.path)) referenceInvalid()
      if (requiredSourcePaths.has(required.sourcePath)) referenceInvalid()
      requiredPaths.add(required.path)
      requiredSourcePaths.add(required.sourcePath)

      const manifestFile = manifest.files.find((file) => file.path === required.path)
      if (
        !manifestFile ||
        manifestFile.sourcePath !== required.sourcePath ||
        manifestFile.classification !== 'reasoning_knowledge' ||
        manifestFile.status !== 'reasoning_source_candidate' ||
        manifestFile.runtimeEligible !== true ||
        manifestFile.runtimeEnabled !== false
      ) {
        referenceInvalid()
      }
    }
  } catch {
    referenceInvalid()
  }
}
