export const NEWEBPAY_CLIENT_FORM_FIELD_NAMES = [
  'MerchantID',
  'TradeInfo',
  'TradeSha',
  'Version',
] as const

export type NewebPayClientFormFieldName = (typeof NEWEBPAY_CLIENT_FORM_FIELD_NAMES)[number]

export type NewebPayClientFormField = {
  name: NewebPayClientFormFieldName
  value: string
}

export type BuildNewebPayClientFormFieldsResult =
  | { ok: true; fields: NewebPayClientFormField[] }
  | { ok: false; error: 'missing_required_field'; missingField: NewebPayClientFormFieldName }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function buildNewebPayClientFormFields(
  input: unknown,
): BuildNewebPayClientFormFieldsResult {
  const source = isRecord(input) ? input : {}
  const fields: NewebPayClientFormField[] = []

  for (const name of NEWEBPAY_CLIENT_FORM_FIELD_NAMES) {
    const value = source[name]
    if (typeof value !== 'string' || value.trim().length === 0) {
      return {
        ok: false,
        error: 'missing_required_field',
        missingField: name,
      }
    }

    fields.push({ name, value })
  }

  return { ok: true, fields }
}
