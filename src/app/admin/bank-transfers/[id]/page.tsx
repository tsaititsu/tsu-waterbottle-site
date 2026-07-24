import BankTransferDetailClient from './BankTransferDetailClient'

export default async function AdminBankTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BankTransferDetailClient id={id} />
}
