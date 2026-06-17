const palaces = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '交友', '官祿', '田宅', '福德', '父母']

export function LayoutPreview() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px] rounded-[32px] border border-borderSoft bg-white p-6 shadow-soft star-field">
      <div className="absolute inset-8 rounded-full border border-lightGold/80" />
      <div className="absolute inset-16 rounded-full border border-lightPurple bg-white/78 backdrop-blur-sm" />
      <div className="relative grid h-full grid-cols-4 grid-rows-4 overflow-hidden rounded-[24px] border border-borderSoft bg-white/86">
        {palaces.map((name, index) => (
          <div key={name} className="flex flex-col justify-between border border-borderSoft/80 p-3">
            <span className="text-xs font-semibold text-darkGold">{String(index + 1).padStart(2, '0')}</span>
            <span className="font-serifTC text-sm font-semibold text-deepPurple">{name}</span>
          </div>
        ))}
        <div className="col-span-2 row-span-2 flex flex-col items-center justify-center border border-lightGold bg-softPurple text-center">
          <p className="font-serifTC text-2xl font-semibold text-deepPurple">紫微命盤</p>
          <p className="mt-2 text-xs text-textMuted">AI Insight Preview</p>
        </div>
      </div>
    </div>
  )
}
