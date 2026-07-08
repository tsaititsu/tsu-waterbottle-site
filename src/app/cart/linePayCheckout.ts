export const CART_LINE_PAY_BUTTON_LABEL = 'LINE Pay'
export const CART_LINE_PAY_UNAVAILABLE_MESSAGE = 'LINE Pay 測試中，暫未開放付款。'

export type CartLinePayButtonState = {
  visible: boolean
  disabled: true
  label: typeof CART_LINE_PAY_BUTTON_LABEL
  message: typeof CART_LINE_PAY_UNAVAILABLE_MESSAGE
}

export function getCartLinePayButtonState(
  flagValue: string | undefined = process.env.NEXT_PUBLIC_ENABLE_LINE_PAY,
): CartLinePayButtonState {
  return {
    visible: flagValue === 'true',
    disabled: true,
    label: CART_LINE_PAY_BUTTON_LABEL,
    message: CART_LINE_PAY_UNAVAILABLE_MESSAGE,
  }
}
