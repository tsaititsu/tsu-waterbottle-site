import 'server-only'

import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
} from './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-policy/v1' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY =
  Object.freeze({
    policyVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
    feature:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
    activationStatus:
      'BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION' as const,
    activationSource:
      'MODULE_OWNED_STATIC_POLICY' as const,
    callerOverrideAllowed: false as const,
    environmentOverrideAllowed: false as const,
  })
