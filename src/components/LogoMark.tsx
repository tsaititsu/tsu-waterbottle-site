import Image from 'next/image'

export function LogoMark({ compact = false }: { compact?: boolean }) {
  const sizeClass = compact ? 'h-14 w-14' : 'h-16 w-16 md:h-[72px] md:w-[72px]'

  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <Image
        src="/brand/waterbottle-logo-transparent.png"
        alt="WATERBOTTLE 樹形 Logo"
        fill
        className="object-contain"
        sizes={compact ? '56px' : '72px'}
        priority={!compact}
      />
    </div>
  )
}
