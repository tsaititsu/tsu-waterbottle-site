export type BookingPlan = {
  id: string
  name: string
  durationMinutes: number
  price: number
  description: string
}

export const bookingPlans: BookingPlan[] = [
  {
    id: 'ziwei-consultation-60',
    name: '水瓶先生論命',
    durationMinutes: 60,
    price: 3600,
    description: '一對一完整諮詢，可討論本命盤、感情、事業、財運與流年方向。'
  }
]

export function getBookingPlan(planId: string) {
  return bookingPlans.find((plan) => plan.id === planId)
}
