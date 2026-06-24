'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { shouldHideConsultationServices, shouldHideCoursesServices } from '@/lib/siteVisibility'

export type CartItemType = 'divination' | 'consultation' | 'course' | 'booking' | 'other'

export type CartItemStatus = 'unpaid' | 'paid'

export type CartItem = {
  id: string
  type: CartItemType
  itemName: string
  amount: number
  quantity: number
  status: CartItemStatus
}

export type AddCartItemInput = {
  id: string
  type: CartItemType
  itemName: string
  amount: number
  quantity?: number
}

type CartContextValue = {
  items: CartItem[]
  isLoaded: boolean
  totalQuantity: number
  totalAmount: number
  addItem: (item: AddCartItemInput) => void
  removeItem: (id: string) => void
}

const CartContext = createContext<CartContextValue | null>(null)

const CART_STORAGE_KEY = 'waterbottle-offline-cart'

function isVisibleCartItem(item: CartItem) {
  if (shouldHideConsultationServices() && item.type === 'consultation') return false
  if (shouldHideCoursesServices() && item.type === 'course') return false
  return true
}

function normalizeCart(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return []
  const parsed = items
    .map((entry) => {
      const raw = entry as Partial<CartItem>
      const amount = typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? Math.max(0, Math.floor(raw.amount)) : 0
      const quantity = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) ? Math.max(1, Math.floor(raw.quantity)) : 1
      const type = raw.type

      if (!raw.id || typeof raw.id !== 'string') return null
      if (!raw.itemName || typeof raw.itemName !== 'string') return null
      if (type !== 'divination' && type !== 'consultation' && type !== 'course' && type !== 'booking' && type !== 'other') return null

      return {
        id: raw.id,
        type,
        itemName: raw.itemName,
        amount,
        quantity,
        status: raw.status === 'paid' ? 'paid' : 'unpaid',
      } as CartItem
    })
    .filter((value): value is CartItem => value !== null)
    .filter(isVisibleCartItem)

  return parsed
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setItems(normalizeCart(parsed))
      }
    } catch {
      // Ignore invalid cache.
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items.filter((item) => item.status === 'unpaid')))
    } catch {
      // Ignore storage failure.
    }
  }, [items, isLoaded])

  const addItem = useCallback((item: AddCartItemInput) => {
    setItems((current) => {
      const amount = item.amount > 0 ? Math.floor(item.amount) : 0
      const quantity = Math.max(1, Math.floor(item.quantity ?? 1))
      const normalizedId = item.id.trim()
      const normalizedName = item.itemName.trim()
      const normalizedType = item.type

      const normalizedItem: CartItem = {
        id: normalizedId,
        type: normalizedType,
        itemName: normalizedName,
        amount,
        quantity,
        status: 'unpaid',
      }

      if (!normalizedItem.id || !normalizedItem.itemName || normalizedItem.amount < 0) return current
      if (!isVisibleCartItem(normalizedItem)) return current

      const next = [...current]
      const index = next.findIndex(
        (row) => row.id === normalizedItem.id && row.type === normalizedItem.type && row.status === normalizedItem.status
      )

      if (index >= 0) {
        next[index] = {
          ...next[index],
          quantity: next[index].quantity + quantity,
          amount,
        }
        return next
      }

      return [
        ...next,
        normalizedItem,
      ]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id || item.status !== 'unpaid'))
  }, [])

const value = useMemo(
    () => ({
      items: items.filter((item) => item.status === 'unpaid').filter(isVisibleCartItem),
      isLoaded,
      totalQuantity: items
        .filter((item) => item.status === 'unpaid')
        .filter(isVisibleCartItem)
        .reduce((total, item) => total + item.quantity, 0),
      totalAmount: items
        .filter((item) => item.status === 'unpaid')
        .filter(isVisibleCartItem)
        .reduce((total, item) => total + item.amount * item.quantity, 0),
      addItem,
      removeItem,
    }),
    [addItem, isLoaded, items, removeItem]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
