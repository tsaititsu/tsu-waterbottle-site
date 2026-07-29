import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-storage-contract/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS =
  Object.freeze([
    'receipt_contract_version',
    'receipt_task',
    'authorization_status',
    'source_contract_version',
    'source_contract_fingerprint',
    'authorization_port_contract_version',
    'authorization_port_contract_fingerprint',
    'transport_contract_version',
    'transport_contract_fingerprint',
    'authorization_command_contract_version',
    'authorization_command_task',
    'authorization_scope',
    'feature',
    'release_commit_sha',
    'migration_version',
    'migration_sha256',
    'migration_readiness_fingerprint',
    'runtime_activation_policy_version',
    'authorization_command_fingerprint',
    'replay_key_fingerprint',
    'receipt_fingerprint',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_MAPPINGS =
  freezeAiChartD1Value([
    {
      receiptPath: 'contractVersion' as const,
      storageColumn:
        'receipt_contract_version' as const,
    },
    {
      receiptPath: 'task' as const,
      storageColumn: 'receipt_task' as const,
    },
    {
      receiptPath: 'authorizationStatus' as const,
      storageColumn:
        'authorization_status' as const,
    },
    {
      receiptPath:
        'sourceContractVersion' as const,
      storageColumn:
        'source_contract_version' as const,
    },
    {
      receiptPath:
        'sourceContractFingerprint' as const,
      storageColumn:
        'source_contract_fingerprint' as const,
    },
    {
      receiptPath:
        'authorizationPortContractVersion' as const,
      storageColumn:
        'authorization_port_contract_version' as const,
    },
    {
      receiptPath:
        'authorizationPortContractFingerprint' as const,
      storageColumn:
        'authorization_port_contract_fingerprint' as const,
    },
    {
      receiptPath:
        'transportContractVersion' as const,
      storageColumn:
        'transport_contract_version' as const,
    },
    {
      receiptPath:
        'transportContractFingerprint' as const,
      storageColumn:
        'transport_contract_fingerprint' as const,
    },
    {
      receiptPath:
        'authorizationCommand.contractVersion' as const,
      storageColumn:
        'authorization_command_contract_version' as const,
    },
    {
      receiptPath:
        'authorizationCommand.task' as const,
      storageColumn:
        'authorization_command_task' as const,
    },
    {
      receiptPath:
        'authorizationCommand.authorizationScope' as const,
      storageColumn:
        'authorization_scope' as const,
    },
    {
      receiptPath:
        'authorizationCommand.feature' as const,
      storageColumn: 'feature' as const,
    },
    {
      receiptPath:
        'authorizationCommand.releaseCommitSha' as const,
      storageColumn:
        'release_commit_sha' as const,
    },
    {
      receiptPath:
        'authorizationCommand.migrationVersion' as const,
      storageColumn:
        'migration_version' as const,
    },
    {
      receiptPath:
        'authorizationCommand.migrationSha256' as const,
      storageColumn:
        'migration_sha256' as const,
    },
    {
      receiptPath:
        'authorizationCommand.migrationReadinessFingerprint' as const,
      storageColumn:
        'migration_readiness_fingerprint' as const,
    },
    {
      receiptPath:
        'authorizationCommand.runtimeActivationPolicyVersion' as const,
      storageColumn:
        'runtime_activation_policy_version' as const,
    },
    {
      receiptPath:
        'authorizationCommandFingerprint' as const,
      storageColumn:
        'authorization_command_fingerprint' as const,
    },
    {
      receiptPath: 'replayKeyFingerprint' as const,
      storageColumn:
        'replay_key_fingerprint' as const,
    },
    {
      receiptPath: 'receiptFingerprint' as const,
      storageColumn:
        'receipt_fingerprint' as const,
    },
  ])

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_ATOMIC_CREATE_RPC_PARAMETERS =
  Object.freeze(
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS.map(
      (column) => `p_${column}`,
    ),
  )

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RECONCILIATION_RPC_PARAMETERS =
  Object.freeze([
    'p_authorization_command_fingerprint',
    'p_replay_key_fingerprint',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RUNTIME_READ_RPC_PARAMETERS =
  Object.freeze([
    'p_authorization_command_fingerprint',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RPC_RESPONSE_FIELDS =
  Object.freeze([
    'result_code',
    ...AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS,
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_UNIQUE_CONSTRAINTS =
  freezeAiChartD1Value([
    {
      constraint:
        'runtime_authorization_receipts_command_fingerprint_key' as const,
      columns: [
        'authorization_command_fingerprint',
      ] as const,
      role: 'PRIMARY_KEY' as const,
    },
    {
      constraint:
        'runtime_authorization_receipts_replay_fingerprint_key' as const,
      columns: [
        'replay_key_fingerprint',
      ] as const,
      role: 'UNIQUE' as const,
    },
  ])

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_VALIDATION_RULES =
  Object.freeze([
    'ALL_COLUMNS_NOT_NULL',
    'CONTRACT_TASK_STATUS_SCOPE_FEATURE_AND_MIGRATION_VALUES_EXACT',
    'RELEASE_COMMIT_SHA_LOWERCASE_HEX_40',
    'ALL_FINGERPRINTS_AND_SHA256_LOWERCASE_HEX_64',
    'NO_SYSTEM_GENERATED_ID_OR_TIMESTAMP_AUTHORITY',
    'RECEIPT_FINGERPRINT_COVERS_RECONSTRUCTED_EXACT_RECEIPT',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_SECURITY_CONTROLS =
  Object.freeze([
    'PRIVATE_SCHEMA_NOT_DATA_API_EXPOSED',
    'ROW_LEVEL_SECURITY_ENABLED_AND_FORCED',
    'FUNCTION_OWNER_NON_LOGIN_ROLE',
    'SECURITY_DEFINER_RPCS_WITH_EMPTY_SEARCH_PATH',
    'FULLY_SCHEMA_QUALIFIED_RELATIONS',
    'RPC_EXECUTE_SERVICE_ROLE_ONLY',
    'NO_DIRECT_TABLE_PRIVILEGES_FOR_PUBLIC_ANON_AUTHENTICATED',
    'NO_DIRECT_TABLE_PRIVILEGES_FOR_SERVICE_ROLE',
    'APPEND_ONLY_NO_UPDATE_DELETE_RPC',
    'NO_CALLER_SELECTED_SCHEMA_TABLE_OR_RPC',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RESULT_CODES =
  Object.freeze([
    'CREATED',
    'EXISTING_EXACT',
    'RECONCILED_EXACT',
    'READ_EXACT',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_METHOD_MAPPINGS =
  freezeAiChartD1Value([
    {
      repositoryMethod:
        'createOrReadExact' as const,
      rpcSequence: [
        'CREATE_OR_READ_EXACT_ONCE',
        'RECONCILE_BOTH_KEYS_ON_UNKNOWN_WRITE_ONLY',
      ] as const,
      maximumWriteInvocations: 1 as const,
      maximumReadInvocations: 1 as const,
      automaticRetryAllowed: false as const,
    },
    {
      repositoryMethod: 'readExact' as const,
      rpcSequence: [
        'READ_CURRENT_RUNTIME_EXACT_ONCE',
      ] as const,
      maximumWriteInvocations: 0 as const,
      maximumReadInvocations: 1 as const,
      automaticRetryAllowed: false as const,
    },
  ])

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_FAILURE_MAPPINGS =
  freezeAiChartD1Value([
    {
      storageCondition:
        'SCHEMA_OR_RPC_UNAVAILABLE' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE' as const,
    },
    {
      storageCondition:
        'ATOMIC_CREATE_EXPLICIT_FAILURE' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_CREATE_FAILED' as const,
    },
    {
      storageCondition:
        'RUNTIME_EXACT_RECEIPT_ABSENT' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_NOT_FOUND' as const,
    },
    {
      storageCondition:
        'RPC_ROW_SHAPE_OR_FINGERPRINT_INVALID' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_INVALID' as const,
    },
    {
      storageCondition:
        'UNIQUE_KEYS_PARTIAL_DIVERGED_OR_BINDINGS_CONFLICT' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_CONFLICT' as const,
    },
    {
      storageCondition:
        'CURRENT_RELEASE_POLICY_OR_CONTRACT_BINDING_DRIFT' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_BINDING_MISMATCH' as const,
    },
    {
      storageCondition:
        'UNKNOWN_WRITE_NOT_RESOLVED_BY_ONE_BOTH_KEY_READ' as const,
      repositoryFailureCode:
        'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED' as const,
    },
  ])

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_FAILURE_MAPPINGS)[number]['storageCondition']

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContract =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT_TASK
    dataClassification:
      'RUNTIME_ACTIVATION_AUTHORIZATION_RECEIPT_STORAGE_METADATA'
    sourceReceiptContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_VERSION
    sourceReceiptContractFingerprint: string
    storageNamespace: 'ai_chart_private'
    tableName:
      'runtime_activation_authorization_receipts'
    storageEncoding:
      'NORMALIZED_NON_NULL_SCALAR_COLUMNS_NO_JSONB'
    requiredColumns:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS
    columnMappings:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_MAPPINGS
    normalizedReceiptColumnCount: 21
    uniqueConstraints:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_UNIQUE_CONSTRAINTS
    columnValidationRules:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_VALIDATION_RULES
    requiredSecurityControls:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_SECURITY_CONTROLS
    externalRepositoryInterface:
      'CREATE_OR_READ_EXACT_AND_READ_EXACT'
    internalStorageOperations:
      'ATOMIC_CREATE_CONDITIONAL_RECONCILIATION_AND_RUNTIME_READ'
    storageOperationCount: 3
    atomicCreateRpc:
      'create_or_read_ai_chart_runtime_authorization_receipt'
    atomicCreateRpcParameters:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_ATOMIC_CREATE_RPC_PARAMETERS
    unknownWriteReconciliationRpc:
      'reconcile_ai_chart_runtime_authorization_receipt'
    unknownWriteReconciliationRpcParameters:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RECONCILIATION_RPC_PARAMETERS
    runtimeReadRpc:
      'read_ai_chart_runtime_authorization_receipt'
    runtimeReadRpcParameters:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RUNTIME_READ_RPC_PARAMETERS
    atomicCreatePolicy:
      'ONE_TRANSACTION_LOCK_BOTH_KEYS_INSERT_OR_VERIFY_EXACT'
    unknownWritePolicy:
      'ONE_READ_ONLY_BOTH_KEY_RECONCILIATION_NO_WRITE_RETRY'
    runtimeReadPolicy:
      'READ_BY_COMMAND_FINGERPRINT_THEN_REVALIDATE_CURRENT_BINDINGS'
    methodMappings:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_METHOD_MAPPINGS
    resultCodes:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RESULT_CODES
    failureMappings:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_FAILURE_MAPPINGS
    rpcResponseShape:
      'FIXED_RESULT_CODE_PLUS_EXACT_21_SCALAR_RECEIPT_COLUMNS'
    rpcResponseFields:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RPC_RESPONSE_FIELDS
    rpcProviderErrorPolicy:
      'NEVER_PERSIST_OR_RETURN_PROVIDER_MESSAGE_DETAILS_HINT_OR_STACK'
    rawAuthorizationCommandPersistenceAllowed: false
    jsonPersistenceAllowed: false
    rawReplayInputsPersistenceAllowed: false
    rawProviderClaimsPersistenceAllowed: false
    rawTokenPersistenceAllowed: false
    authorizerIdentityPersistenceAllowed: false
    approvalProofPersistenceAllowed: false
    providerMessagePersistenceAllowed: false
    freeTextPersistenceAllowed: false
    directTableMutationAllowed: false
    receiptUpdateAllowed: false
    receiptDeleteAllowed: false
    automaticRetryAllowed: false
    callerSelectedStorageAllowed: false
    serializedContractAuthority:
      'NONE_DECLARATION_ONLY'
    schemaContractStatus:
      'DECLARED_NOT_IMPLEMENTED'
    productionAdapterMappingStatus:
      'OFFLINE_RPC_MAPPING_VERIFIED_PRODUCTION_NOT_IMPLEMENTED'
    offlineRpcAdapterProbeStatus: 'VERIFIED'
    migrationStatus: 'NOT_CREATED'
    rpcImplementationStatus: 'NOT_IMPLEMENTED'
    productionAdapterStatus: 'NOT_IMPLEMENTED'
    runtimeReadAdapterStatus: 'NOT_IMPLEMENTED'
    runtimeActivationStatus:
      'BLOCKED_PENDING_VERIFIED_DURABLE_RECEIPT_STORAGE_ADAPTER'
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    receiptWrites: 0
    receiptReads: 0
    environmentReads: 0
    secretReads: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'DESIGN_MIGRATION_AND_PRODUCTION_ADAPTER_SOURCE_WITHOUT_DATABASE_APPLICATION'
    contractFingerprint: string
  }>

const withoutFingerprint = {
  contractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT_VERSION,
  task:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT_TASK,
  dataClassification:
    'RUNTIME_ACTIVATION_AUTHORIZATION_RECEIPT_STORAGE_METADATA' as const,
  sourceReceiptContractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_VERSION,
  sourceReceiptContractFingerprint:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT.contractFingerprint,
  storageNamespace: 'ai_chart_private' as const,
  tableName:
    'runtime_activation_authorization_receipts' as const,
  storageEncoding:
    'NORMALIZED_NON_NULL_SCALAR_COLUMNS_NO_JSONB' as const,
  requiredColumns:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS,
  columnMappings:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_MAPPINGS,
  normalizedReceiptColumnCount: 21 as const,
  uniqueConstraints:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_UNIQUE_CONSTRAINTS,
  columnValidationRules:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_VALIDATION_RULES,
  requiredSecurityControls:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_SECURITY_CONTROLS,
  externalRepositoryInterface:
    'CREATE_OR_READ_EXACT_AND_READ_EXACT' as const,
  internalStorageOperations:
    'ATOMIC_CREATE_CONDITIONAL_RECONCILIATION_AND_RUNTIME_READ' as const,
  storageOperationCount: 3 as const,
  atomicCreateRpc:
    'create_or_read_ai_chart_runtime_authorization_receipt' as const,
  atomicCreateRpcParameters:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_ATOMIC_CREATE_RPC_PARAMETERS,
  unknownWriteReconciliationRpc:
    'reconcile_ai_chart_runtime_authorization_receipt' as const,
  unknownWriteReconciliationRpcParameters:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RECONCILIATION_RPC_PARAMETERS,
  runtimeReadRpc:
    'read_ai_chart_runtime_authorization_receipt' as const,
  runtimeReadRpcParameters:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RUNTIME_READ_RPC_PARAMETERS,
  atomicCreatePolicy:
    'ONE_TRANSACTION_LOCK_BOTH_KEYS_INSERT_OR_VERIFY_EXACT' as const,
  unknownWritePolicy:
    'ONE_READ_ONLY_BOTH_KEY_RECONCILIATION_NO_WRITE_RETRY' as const,
  runtimeReadPolicy:
    'READ_BY_COMMAND_FINGERPRINT_THEN_REVALIDATE_CURRENT_BINDINGS' as const,
  methodMappings:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_METHOD_MAPPINGS,
  resultCodes:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RESULT_CODES,
  failureMappings:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_FAILURE_MAPPINGS,
  rpcResponseShape:
    'FIXED_RESULT_CODE_PLUS_EXACT_21_SCALAR_RECEIPT_COLUMNS' as const,
  rpcResponseFields:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RPC_RESPONSE_FIELDS,
  rpcProviderErrorPolicy:
    'NEVER_PERSIST_OR_RETURN_PROVIDER_MESSAGE_DETAILS_HINT_OR_STACK' as const,
  rawAuthorizationCommandPersistenceAllowed:
    false as const,
  jsonPersistenceAllowed: false as const,
  rawReplayInputsPersistenceAllowed: false as const,
  rawProviderClaimsPersistenceAllowed: false as const,
  rawTokenPersistenceAllowed: false as const,
  authorizerIdentityPersistenceAllowed: false as const,
  approvalProofPersistenceAllowed: false as const,
  providerMessagePersistenceAllowed: false as const,
  freeTextPersistenceAllowed: false as const,
  directTableMutationAllowed: false as const,
  receiptUpdateAllowed: false as const,
  receiptDeleteAllowed: false as const,
  automaticRetryAllowed: false as const,
  callerSelectedStorageAllowed: false as const,
  serializedContractAuthority:
    'NONE_DECLARATION_ONLY' as const,
  schemaContractStatus:
    'DECLARED_NOT_IMPLEMENTED' as const,
  productionAdapterMappingStatus:
    'OFFLINE_RPC_MAPPING_VERIFIED_PRODUCTION_NOT_IMPLEMENTED' as const,
  offlineRpcAdapterProbeStatus:
    'VERIFIED' as const,
  migrationStatus: 'NOT_CREATED' as const,
  rpcImplementationStatus:
    'NOT_IMPLEMENTED' as const,
  productionAdapterStatus:
    'NOT_IMPLEMENTED' as const,
  runtimeReadAdapterStatus:
    'NOT_IMPLEMENTED' as const,
  runtimeActivationStatus:
    'BLOCKED_PENDING_VERIFIED_DURABLE_RECEIPT_STORAGE_ADAPTER' as const,
  runtimeActivationAllowed: false as const,
  customerDeliveryAllowed: false as const,
  productionCallable: false as const,
  databaseConnections: 0 as const,
  receiptWrites: 0 as const,
  receiptReads: 0 as const,
  environmentReads: 0 as const,
  secretReads: 0 as const,
  reportMutations: 0 as const,
  openAiRequests: 0 as const,
  nextRequiredAction:
    'DESIGN_MIGRATION_AND_PRODUCTION_ADAPTER_SOURCE_WITHOUT_DATABASE_APPLICATION' as const,
}

const contractFingerprint = createHash('sha256')
  .update(
    createAiChartD1PalaceWritingCanonicalJson(
      withoutFingerprint,
    ),
    'utf8',
  )
  .digest('hex')

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT:
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContract =
    freezeAiChartD1Value({
      ...withoutFingerprint,
      contractFingerprint,
    })
