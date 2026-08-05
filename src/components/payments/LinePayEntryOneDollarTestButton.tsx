'use client'

type LinePayEntryOneDollarTestButtonProps = {
  available: boolean
  disabled: boolean
  onClick: () => void
  className?: string
}

export function LinePayEntryOneDollarTestButton({
  available,
  disabled,
  onClick,
  className = '',
}: LinePayEntryOneDollarTestButtonProps) {
  if (!available) return null

  return (
    <button
      className={`focus-ring rounded-xl border border-[#06c755] bg-white px-5 py-3 font-semibold text-[#067a38] transition hover:bg-[#effcf4] disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      管理員 LINE Pay 入口驗收 NT$1
    </button>
  )
}
