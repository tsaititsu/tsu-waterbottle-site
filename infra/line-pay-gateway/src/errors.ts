export class GatewayHttpError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string) {
    super(code)
    this.name = 'GatewayHttpError'
    this.statusCode = statusCode
    this.code = code
  }
}
