export function getDivinationReadingAction(readingId: string, status: string | null) {
  const encodedReadingId = encodeURIComponent(readingId)

  if (status === 'paid') {
    return {
      label: '繼續產生解讀',
      href: `/ai-divination/result/${encodedReadingId}?payment=success`,
    }
  }

  if (status === 'interpreting') {
    return {
      label: '查看解讀進度',
      href: `/ai-divination/result/${encodedReadingId}`,
    }
  }

  if (status === 'completed') {
    return {
      label: '查看解讀',
      href: `/account/divinations/${encodedReadingId}`,
    }
  }

  return null
}
