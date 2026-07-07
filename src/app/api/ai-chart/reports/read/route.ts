import { handleReadAiChartReportRequest } from './handler'

export async function GET(request: Request) {
  const url = new URL(request.url)
  return handleReadAiChartReportRequest(url.searchParams)
}
