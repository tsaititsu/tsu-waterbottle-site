import { handleProductOrderLinePayCapabilityCallback } from './capabilityHandler'
import { readLinePayCapabilityCookie } from './capabilityToken'

type CapabilityCallbackInput = Parameters<
  typeof handleProductOrderLinePayCapabilityCallback
>[0]

function requestWithServerCapability(
  request: Request,
  purpose: 'confirm' | 'cancel',
) {
  const url = new URL(request.url)
  url.searchParams.delete('capability')

  const capability = readLinePayCapabilityCookie(request, purpose)
  if (capability) url.searchParams.set('capability', capability)

  return new Request(url, request)
}

export function handlePublicProductOrderLinePayCapabilityCallback(
  input: CapabilityCallbackInput,
) {
  return handleProductOrderLinePayCapabilityCallback({
    ...input,
    request: requestWithServerCapability(input.request, input.purpose),
  })
}
