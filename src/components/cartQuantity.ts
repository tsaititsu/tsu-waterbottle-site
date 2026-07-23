type CartQuantityItem = {
  id: string
  type: string
  quantity: number
  status: string
}

export function getCartItemsWithUpdatedQuantity<T extends CartQuantityItem>(
  items: T[],
  id: string,
  type: string,
  quantity: number,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return items

  let didUpdate = false
  const nextItems = items.map((item) => {
    if (item.id !== id || item.type !== type || item.status !== 'unpaid' || item.quantity === quantity) {
      return item
    }

    didUpdate = true
    return {
      ...item,
      quantity,
    }
  })

  return didUpdate ? nextItems : items
}
