const lineSupportUrl = 'https://lin.ee/6Tpje1P'

export function FloatingLineButton() {
  return (
    <a
      aria-label="加入水瓶先生客服 LINE"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#06c755] text-sm font-black text-white shadow-[0_12px_30px_rgba(6,199,85,0.35)] transition hover:scale-105 hover:shadow-[0_16px_36px_rgba(6,199,85,0.45)] md:bottom-6 md:right-6 md:h-16 md:w-16"
      href={lineSupportUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      LINE
    </a>
  )
}
