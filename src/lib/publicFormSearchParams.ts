export type DivinationSearchParamState = {
  resetKey: string
  followUpKey: string
}

export type BookingSearchParamState = {
  resetKey: string
}

export const INITIAL_DIVINATION_SEARCH_PARAM_STATE: DivinationSearchParamState = {
  resetKey: '',
  followUpKey: '',
}

export const INITIAL_BOOKING_SEARCH_PARAM_STATE: BookingSearchParamState = {
  resetKey: '',
}

export function reconcileDivinationSearchParamState(
  current: DivinationSearchParamState,
  next: DivinationSearchParamState,
) {
  if (
    current.resetKey === next.resetKey &&
    current.followUpKey === next.followUpKey
  ) {
    return current
  }

  return next
}

export function reconcileBookingSearchParamState(
  current: BookingSearchParamState,
  next: BookingSearchParamState,
) {
  if (current.resetKey === next.resetKey) {
    return current
  }

  return next
}
