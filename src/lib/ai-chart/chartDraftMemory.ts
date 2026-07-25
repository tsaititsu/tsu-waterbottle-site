'use client'

import type { ChartInput } from '@/features/ziwei-chart/package'

export type AiChartDraftSession = {
  input: ChartInput
  chartId: string
  selectedCategory: string
  birthOrder?: string
}

export type AiChartSavedDraft = {
  id: string
  input: ChartInput
}

export type AiChartDraftWorkspace = {
  categories: string[]
  selectedCategory: string
  selectedChartId?: string
  charts: Record<string, AiChartSavedDraft[]>
}

let currentSession: AiChartDraftSession | null = null
let notesByChartId: Record<string, string> = {}
let workspace: AiChartDraftWorkspace = {
  categories: ['自己'],
  selectedCategory: '自己',
  charts: {},
}

function copyInput(input: ChartInput): ChartInput {
  return { ...input }
}

export function getAiChartDraftSession(): AiChartDraftSession | null {
  return currentSession
    ? {
        ...currentSession,
        input: copyInput(currentSession.input),
      }
    : null
}

export function setAiChartDraftSession(session: AiChartDraftSession): void {
  currentSession = {
    ...session,
    input: copyInput(session.input),
  }
}

export function clearAiChartDraftSession(): void {
  currentSession = null
}

export function clearAiChartDraftMemory(): void {
  currentSession = null
  notesByChartId = {}
  workspace = {
    categories: ['自己'],
    selectedCategory: '自己',
    charts: {},
  }
}

export function getAiChartDraftNotes(): Record<string, string> {
  return { ...notesByChartId }
}

export function setAiChartDraftNotes(notes: Record<string, string>): void {
  notesByChartId = { ...notes }
}

export function getAiChartDraftWorkspace(): AiChartDraftWorkspace {
  return {
    ...workspace,
    categories: [...workspace.categories],
    charts: Object.fromEntries(
      Object.entries(workspace.charts).map(([category, charts]) => [
        category,
        charts.map((chart) => ({ ...chart, input: copyInput(chart.input) })),
      ]),
    ),
  }
}

export function setAiChartDraftWorkspace(next: AiChartDraftWorkspace): void {
  workspace = {
    ...next,
    categories: [...next.categories],
    charts: Object.fromEntries(
      Object.entries(next.charts).map(([category, charts]) => [
        category,
        charts.map((chart) => ({ ...chart, input: copyInput(chart.input) })),
      ]),
    ),
  }
}
