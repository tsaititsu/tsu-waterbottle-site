import ProductOrderDetailClient from './ProductOrderDetailClient'

export default async function AdminProductOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProductOrderDetailClient id={id} />
}
