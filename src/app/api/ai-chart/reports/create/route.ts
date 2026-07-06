import {
  handleCreateAiChartReportRequest,
  type CreateAiChartReportRequest,
} from './handler'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateAiChartReportRequest | null
  return handleCreateAiChartReportRequest(body)
}
