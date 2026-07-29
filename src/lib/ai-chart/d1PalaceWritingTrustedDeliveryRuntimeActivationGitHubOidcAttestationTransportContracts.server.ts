import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-oidc-attestation-transport-contract/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_TOKEN_CLAIMS =
  Object.freeze([
    'iss',
    'aud',
    'sub',
    'jti',
    'iat',
    'nbf',
    'exp',
    'repository',
    'repository_id',
    'repository_owner_id',
    'ref',
    'sha',
    'environment',
    'workflow_ref',
    'workflow_sha',
    'run_id',
    'run_attempt',
    'event_name',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_ENVELOPE_FIELDS =
  Object.freeze([
    'sourceContractVersion',
    'sourceContractFingerprint',
    'authorizationPortContractVersion',
    'authorizationPortContractFingerprint',
    'authorizationCommand',
    'authorizationCommandFingerprint',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_VERIFICATION_CHECKS =
  Object.freeze([
    'OIDC_SIGNATURE_VALID',
    'OIDC_ISSUER_EXACT_MATCH',
    'OIDC_AUDIENCE_EXACT_MATCH',
    'OIDC_TIME_WINDOW_VALID',
    'OIDC_JTI_PRESENT',
    'REPOSITORY_NAME_AND_ID_EXACT_MATCH',
    'REPOSITORY_OWNER_ID_EXACT_MATCH',
    'PROTECTED_ENVIRONMENT_EXACT_MATCH',
    'MAIN_REF_EXACT_MATCH',
    'RELEASE_COMMIT_SHA_EXACT_MATCH',
    'WORKFLOW_IDENTITY_EXACT_MATCH',
    'WORKFLOW_SOURCE_SHA_EXACT_MATCH',
    'MIGRATION_IDENTITY_EXACT_MATCH',
    'MIGRATION_READINESS_FINGERPRINT_EXACT_MATCH',
    'RUNTIME_ACTIVATION_POLICY_VERSION_EXACT_MATCH',
    'AUTHORIZATION_COMMAND_FINGERPRINT_EXACT_MATCH',
    'AUTHORIZATION_PORT_CONTRACT_FINGERPRINT_EXACT_MATCH',
    'ATTESTATION_ENVELOPE_STRICT',
    'REPLAY_KEY_DURABLE_ATOMIC_CLAIM_OR_EXACT_EXISTING',
  ] as const)

const REPLAY_KEY_INPUTS = Object.freeze([
  'jti',
  'repository_id',
  'run_id',
  'run_attempt',
  'sha',
  'authorizationCommandFingerprint',
] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContract =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_TASK
    dataClassification:
      'RUNTIME_ACTIVATION_AUTHORIZATION_TRANSPORT_METADATA'
    sourceContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION
    sourceContractFingerprint: string
    authorizationPortContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION
    authorizationPortContractFingerprint: string
    transport:
      'GITHUB_ACTIONS_OIDC_AUTHENTICATED_SERVER_POST'
    trustModel:
      'SHORT_LIVED_SIGNED_IDENTITY_PLUS_EXACT_COMMAND_AND_ATOMIC_REPLAY_GUARD'
    issuer:
      'https://token.actions.githubusercontent.com'
    audience:
      'urn:tsu-waterbottle-site:ai-chart-runtime-activation'
    tokenPlacement:
      'AUTHORIZATION_BEARER_HEADER_ONLY'
    manualApprovalEvidence:
      'JOB_STARTED_ONLY_AFTER_PROTECTED_ENVIRONMENT_APPROVAL'
    subjectPolicy:
      'VERIFY_ENVIRONMENT_CONTEXT_WITHOUT_ASSUMING_NAME_ONLY_SUB_FORMAT'
    requiredTokenClaims:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_TOKEN_CLAIMS
    requiredAttestationEnvelopeFields:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_ENVELOPE_FIELDS
    requiredVerificationChecks:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_VERIFICATION_CHECKS
    replayKeyInputs: typeof REPLAY_KEY_INPUTS
    replayProtection:
      'ATOMIC_DURABLE_EXACT_ONCE_REQUIRED'
    tokenLifetimePolicy:
      'VERIFY_EXP_IAT_NBF_DO_NOT_EXTEND'
    sourceContractAuthority:
      'SOURCE_METADATA_NOT_AUTHORITY'
    rawTokenPersistenceAllowed: false
    rawTokenLoggingAllowed: false
    providerClaimsOutputAllowed: false
    authorizerIdentityOutputAllowed: false
    approvalProofOutputAllowed: false
    providerMessageOutputAllowed: false
    longLivedSharedSecretRequired: false
    environmentSecretRequiredByContract: false
    requestBodyFreeTextAllowed: false
    networkRetryAllowed: false
    automaticRetryAllowed: false
    transportStatus:
      'CONTRACT_DECLARED_NOT_IMPLEMENTED'
    httpEndpointStatus: 'NOT_IMPLEMENTED'
    oidcVerifierStatus: 'NOT_IMPLEMENTED'
    replayStoreStatus: 'NOT_IMPLEMENTED'
    authorizationPortAdapterStatus: 'NOT_IMPLEMENTED'
    durableRuntimeActivationStatus: 'NOT_IMPLEMENTED'
    authorizationStatus:
      'TRANSPORT_DESIGNED_NOT_VERIFIED'
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    oidcTokensRequested: 0
    oidcTokensVerified: 0
    transportRequests: 0
    authorizationPortInvocations: 0
    environmentReads: 0
    secretReads: 0
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'USE_DURABLE_ATOMIC_AUTHORIZATION_RECEIPT_CONTRACT_BEFORE_IMPLEMENTING_TRANSPORT'
    contractFingerprint: string
  }>

const withoutFingerprint = {
  contractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION,
  task:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_TASK,
  dataClassification:
    'RUNTIME_ACTIVATION_AUTHORIZATION_TRANSPORT_METADATA' as const,
  sourceContractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION,
  sourceContractFingerprint:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
  authorizationPortContractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
  authorizationPortContractFingerprint:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
  transport:
    'GITHUB_ACTIONS_OIDC_AUTHENTICATED_SERVER_POST' as const,
  trustModel:
    'SHORT_LIVED_SIGNED_IDENTITY_PLUS_EXACT_COMMAND_AND_ATOMIC_REPLAY_GUARD' as const,
  issuer:
    'https://token.actions.githubusercontent.com' as const,
  audience:
    'urn:tsu-waterbottle-site:ai-chart-runtime-activation' as const,
  tokenPlacement:
    'AUTHORIZATION_BEARER_HEADER_ONLY' as const,
  manualApprovalEvidence:
    'JOB_STARTED_ONLY_AFTER_PROTECTED_ENVIRONMENT_APPROVAL' as const,
  subjectPolicy:
    'VERIFY_ENVIRONMENT_CONTEXT_WITHOUT_ASSUMING_NAME_ONLY_SUB_FORMAT' as const,
  requiredTokenClaims:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_TOKEN_CLAIMS,
  requiredAttestationEnvelopeFields:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_ENVELOPE_FIELDS,
  requiredVerificationChecks:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_VERIFICATION_CHECKS,
  replayKeyInputs: REPLAY_KEY_INPUTS,
  replayProtection:
    'ATOMIC_DURABLE_EXACT_ONCE_REQUIRED' as const,
  tokenLifetimePolicy:
    'VERIFY_EXP_IAT_NBF_DO_NOT_EXTEND' as const,
  sourceContractAuthority:
    'SOURCE_METADATA_NOT_AUTHORITY' as const,
  rawTokenPersistenceAllowed: false as const,
  rawTokenLoggingAllowed: false as const,
  providerClaimsOutputAllowed: false as const,
  authorizerIdentityOutputAllowed: false as const,
  approvalProofOutputAllowed: false as const,
  providerMessageOutputAllowed: false as const,
  longLivedSharedSecretRequired: false as const,
  environmentSecretRequiredByContract: false as const,
  requestBodyFreeTextAllowed: false as const,
  networkRetryAllowed: false as const,
  automaticRetryAllowed: false as const,
  transportStatus:
    'CONTRACT_DECLARED_NOT_IMPLEMENTED' as const,
  httpEndpointStatus: 'NOT_IMPLEMENTED' as const,
  oidcVerifierStatus: 'NOT_IMPLEMENTED' as const,
  replayStoreStatus: 'NOT_IMPLEMENTED' as const,
  authorizationPortAdapterStatus:
    'NOT_IMPLEMENTED' as const,
  durableRuntimeActivationStatus:
    'NOT_IMPLEMENTED' as const,
  authorizationStatus:
    'TRANSPORT_DESIGNED_NOT_VERIFIED' as const,
  runtimeActivationAllowed: false as const,
  customerDeliveryAllowed: false as const,
  productionCallable: false as const,
  oidcTokensRequested: 0 as const,
  oidcTokensVerified: 0 as const,
  transportRequests: 0 as const,
  authorizationPortInvocations: 0 as const,
  environmentReads: 0 as const,
  secretReads: 0 as const,
  databaseConnections: 0 as const,
  reportMutations: 0 as const,
  openAiRequests: 0 as const,
  nextRequiredAction:
    'USE_DURABLE_ATOMIC_AUTHORIZATION_RECEIPT_CONTRACT_BEFORE_IMPLEMENTING_TRANSPORT' as const,
}

const contractFingerprint = createHash('sha256')
  .update(
    createAiChartD1PalaceWritingCanonicalJson(
      withoutFingerprint,
    ),
    'utf8',
  )
  .digest('hex')

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT:
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContract =
    freezeAiChartD1Value({
      ...withoutFingerprint,
      contractFingerprint,
    })
