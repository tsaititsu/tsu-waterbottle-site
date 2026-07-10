import {
  handleNewebPayReturnGet,
  handleNewebPayReturnPost,
  type NewebPayReturnHandlerDeps,
} from '../../../api/payments/newebpay/return/handler'

export function createNewebPayPublicReturnRoute(deps: NewebPayReturnHandlerDeps) {
  return {
    GET(request: Request) {
      return handleNewebPayReturnGet(request)
    },
    POST(request: Request) {
      return handleNewebPayReturnPost(request, deps)
    },
  }
}
