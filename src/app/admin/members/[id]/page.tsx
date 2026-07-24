import MemberDetailClient from './MemberDetailClient'

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MemberDetailClient id={id} />
}
