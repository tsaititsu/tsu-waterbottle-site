export const CANCELLATION_REASON_MAX_LENGTH = 300

export function validateCancellationReason(reason: string) {
  const trimmedReason = reason.trim()
  if (!trimmedReason) {
    return { reason: '', error: '請填寫取消原因。' }
  }
  if (reason.length > CANCELLATION_REASON_MAX_LENGTH) {
    return { reason: trimmedReason, error: `取消原因最多 ${CANCELLATION_REASON_MAX_LENGTH} 字。` }
  }
  return { reason: trimmedReason, error: '' }
}
