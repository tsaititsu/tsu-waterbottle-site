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

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_REQUIRED_BINDING_CHECKS =
  Object.freeze([
    'REPOSITORY_EXACT_MATCH',
    'PROTECTED_ENVIRONMENT_EXACT_MATCH',
    'MAIN_BRANCH_EXACT_MATCH',
    'MAIN_REF_EXACT_MATCH',
    'REQUIRED_REVIEWER_MANUAL_APPROVAL_PRESENT',
    'PREVENT_SELF_REVIEW_ENABLED',
    'ADMINISTRATOR_BYPASS_DISABLED',
    'DEPLOYMENT_BRANCH_POLICY_MAIN_ONLY',
    'RELEASE_COMMIT_SHA_EXACT_MATCH',
    'MIGRATION_IDENTITY_EXACT_MATCH',
    'MIGRATION_READINESS_FINGERPRINT_EXACT_MATCH',
    'RUNTIME_ACTIVATION_POLICY_VERSION_EXACT_MATCH',
    'AUTHORIZATION_PORT_CONTRACT_FINGERPRINT_EXACT_MATCH',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContract =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_TASK
    dataClassification:
      'RUNTIME_ACTIVATION_AUTHORIZATION_SOURCE_METADATA'
    authorizationSource:
      'GITHUB_ENVIRONMENT_REQUIRED_REVIEWER_MANUAL_APPROVAL'
    repository:
      'tsaititsu/tsu-waterbottle-site'
    environmentName:
      'ai-chart-production-runtime'
    environmentProtection:
      'REQUIRED_REVIEWER_MANUAL_APPROVAL'
    preventSelfReviewRequired: true
    administratorBypassAllowed: false
    deploymentBranchPolicy: 'MAIN_ONLY'
    branch: 'main'
    ref: 'refs/heads/main'
    portContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION
    portContractFingerprint: string
    port:
      'VERIFY_EXPLICIT_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION'
    authorizationScope:
      'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE'
    requiredBindingChecks:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_REQUIRED_BINDING_CHECKS
    approvalScope:
      'ONE_EXACT_RELEASE_AND_MIGRATION_READINESS_FINGERPRINT'
    approvalReusePolicy:
      'ONE_MANUAL_APPROVAL_ONE_EXACT_AUTHORIZATION_COMMAND'
    serializedMetadataAuthority:
      'NONE_DECLARATION_ONLY'
    manualApprovalRequired: true
    automaticApprovalAllowed: false
    callerDeclaredApprovalAllowed: false
    environmentVariableApprovalAllowed: false
    unprotectedBranchAllowed: false
    crossReleaseReuseAllowed: false
    crossMigrationReadinessReuseAllowed: false
    providerIdentityOutputAllowed: false
    providerProofOutputAllowed: false
    providerMessageOutputAllowed: false
    environmentSecretRequiredByContract: false
    environmentMutationAllowed: false
    sourceSelectionStatus:
      'GITHUB_ENVIRONMENT_SOURCE_SELECTED'
    portAdapterStatus: 'NOT_IMPLEMENTED'
    workflowImplementationStatus: 'NOT_IMPLEMENTED'
    approvalAttestationTransportStatus:
      'NOT_IMPLEMENTED'
    durableRuntimeActivationStatus: 'NOT_IMPLEMENTED'
    authorizationStatus:
      'SOURCE_SELECTED_NOT_VERIFIED'
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    adapterInvocations: 0
    githubApiCalls: 0
    environmentReads: 0
    secretReads: 0
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'USE_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_BEFORE_IMPLEMENTING_ADAPTER'
    contractFingerprint: string
  }>

const withoutFingerprint = {
  contractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION,
  task:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_TASK,
  dataClassification:
    'RUNTIME_ACTIVATION_AUTHORIZATION_SOURCE_METADATA' as const,
  authorizationSource:
    'GITHUB_ENVIRONMENT_REQUIRED_REVIEWER_MANUAL_APPROVAL' as const,
  repository:
    'tsaititsu/tsu-waterbottle-site' as const,
  environmentName:
    'ai-chart-production-runtime' as const,
  environmentProtection:
    'REQUIRED_REVIEWER_MANUAL_APPROVAL' as const,
  preventSelfReviewRequired: true as const,
  administratorBypassAllowed: false as const,
  deploymentBranchPolicy: 'MAIN_ONLY' as const,
  branch: 'main' as const,
  ref: 'refs/heads/main' as const,
  portContractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
  portContractFingerprint:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
  port:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.port,
  authorizationScope:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.authorizationScope,
  requiredBindingChecks:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_REQUIRED_BINDING_CHECKS,
  approvalScope:
    'ONE_EXACT_RELEASE_AND_MIGRATION_READINESS_FINGERPRINT' as const,
  approvalReusePolicy:
    'ONE_MANUAL_APPROVAL_ONE_EXACT_AUTHORIZATION_COMMAND' as const,
  serializedMetadataAuthority:
    'NONE_DECLARATION_ONLY' as const,
  manualApprovalRequired: true as const,
  automaticApprovalAllowed: false as const,
  callerDeclaredApprovalAllowed: false as const,
  environmentVariableApprovalAllowed: false as const,
  unprotectedBranchAllowed: false as const,
  crossReleaseReuseAllowed: false as const,
  crossMigrationReadinessReuseAllowed: false as const,
  providerIdentityOutputAllowed: false as const,
  providerProofOutputAllowed: false as const,
  providerMessageOutputAllowed: false as const,
  environmentSecretRequiredByContract: false as const,
  environmentMutationAllowed: false as const,
  sourceSelectionStatus:
    'GITHUB_ENVIRONMENT_SOURCE_SELECTED' as const,
  portAdapterStatus: 'NOT_IMPLEMENTED' as const,
  workflowImplementationStatus:
    'NOT_IMPLEMENTED' as const,
  approvalAttestationTransportStatus:
    'NOT_IMPLEMENTED' as const,
  durableRuntimeActivationStatus:
    'NOT_IMPLEMENTED' as const,
  authorizationStatus:
    'SOURCE_SELECTED_NOT_VERIFIED' as const,
  runtimeActivationAllowed: false as const,
  customerDeliveryAllowed: false as const,
  productionCallable: false as const,
  adapterInvocations: 0 as const,
  githubApiCalls: 0 as const,
  environmentReads: 0 as const,
  secretReads: 0 as const,
  databaseConnections: 0 as const,
  reportMutations: 0 as const,
  openAiRequests: 0 as const,
  nextRequiredAction:
    'USE_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_BEFORE_IMPLEMENTING_ADAPTER' as const,
}

const contractFingerprint = createHash('sha256')
  .update(
    createAiChartD1PalaceWritingCanonicalJson(
      withoutFingerprint,
    ),
    'utf8',
  )
  .digest('hex')

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT:
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContract =
    freezeAiChartD1Value({
      ...withoutFingerprint,
      contractFingerprint,
    })
