import Image from 'next/image'

const palaceGrid: Record<string, [number, number]> = {
  巳: [0, 0],
  午: [0, 1],
  未: [0, 2],
  申: [0, 3],
  辰: [1, 0],
  酉: [1, 3],
  卯: [2, 0],
  戌: [2, 3],
  寅: [3, 0],
  丑: [3, 1],
  子: [3, 2],
  亥: [3, 3]
}

const palaceStars = [
  { branch: '巳', stars: ['紫微', '七殺'] },
  { branch: '辰', stars: ['天機', '天梁'] },
  { branch: '卯', stars: ['天相'] },
  { branch: '寅', stars: ['巨門', '太陽'] },
  { branch: '丑', stars: ['武曲', '貪狼'] },
  { branch: '子', stars: ['太陰', '天同'] },
  { branch: '亥', stars: ['天府'] },
  { branch: '酉', stars: ['廉貞', '破軍'] }
]

const branches = ['巳', '午', '未', '申', '辰', '酉', '卯', '戌', '寅', '丑', '子', '亥']

export function ZiweiChartPreview() {
  return (
    <div className="relative ml-auto w-full max-w-[620px] rounded-[26px] border border-white/60 bg-white/50 p-3 shadow-[0_24px_70px_rgba(31,27,46,0.2)] backdrop-blur-md">
      <div className="grid aspect-[1.38] grid-cols-4 grid-rows-4 border border-[#d9cbea] bg-[#fbf8ff]/78 backdrop-blur-sm">
        {branches.map((branch) => {
          const [row, col] = palaceGrid[branch]
          const item = palaceStars.find((palace) => palace.branch === branch)

          return (
            <div
              key={branch}
              className="relative border border-[#d9cbea] bg-white/22 p-4 md:p-5"
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
            >
              {item && (
                <div className="space-y-0.5 font-serifTC text-[17px] font-semibold leading-[1.12] text-[#706878] md:text-[22px]">
                  {item.stars.map((star) => (
                    <div key={star}>{star}</div>
                  ))}
                </div>
              )}
              <span className="absolute bottom-2 right-3 font-serifTC text-lg text-[#34283f] md:text-xl">
                {branch}
              </span>
            </div>
          )
        })}

        <div className="col-start-2 col-end-4 row-start-2 row-end-4 flex items-center justify-center border border-[#d9cbea] bg-white/12 px-5 backdrop-blur-sm">
          <div className="relative h-[62%] w-[62%] md:h-[70%] md:w-[70%]">
            <Image
              src="/brand/waterbottle-logo-transparent-cropped.png"
              alt="WATERBOTTLE"
              fill
              sizes="(max-width: 768px) 160px, 260px"
              className="object-contain opacity-80"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
}
