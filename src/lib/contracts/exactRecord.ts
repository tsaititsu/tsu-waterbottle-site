export function readExactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  contractName: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${contractName}_contract_mismatch`)
  }

  const record = value as Record<string, unknown>
  const actualKeys = Object.keys(record).sort()
  const requiredKeys = [...expectedKeys].sort()

  if (
    actualKeys.length !== requiredKeys.length ||
    actualKeys.some((key, index) => key !== requiredKeys[index])
  ) {
    throw new Error(`${contractName}_contract_mismatch`)
  }

  return record
}
