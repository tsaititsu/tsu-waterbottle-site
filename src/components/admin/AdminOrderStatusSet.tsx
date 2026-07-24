import AdminStatusBadge from './AdminStatusBadge'

type AdminOrderStatusSetProps = {
  orderStatus: string
  paymentStatus: string
  shippingStatus: string
}

const statuses = [
  ['訂單', 'orderStatus'],
  ['付款', 'paymentStatus'],
  ['物流', 'shippingStatus'],
] as const

export default function AdminOrderStatusSet(props: AdminOrderStatusSetProps) {
  return (
    <dl className="flex flex-wrap gap-2">
      {statuses.map(([label, key]) => (
        <div className="inline-flex items-center gap-1" key={key}>
          <dt className="text-xs font-semibold text-textMuted">{label}</dt>
          <dd><AdminStatusBadge value={props[key]} /></dd>
        </div>
      ))}
    </dl>
  )
}
