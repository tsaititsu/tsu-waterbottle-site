export type SpiritualProduct = {
  slug: string
  name: string
  category: '符咒商品' | '聚寶盆'
  priceTwd: number
  validity: string
  image: string
  images?: string[]
  description: string
  usage?: string
  note?: string
}

export const spiritualProducts: SpiritualProduct[] = [
  {
    slug: 'ren-yuan-fu',
    name: '人緣符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/ren-yuan-fu.jpg',
    description: '祈求人際互動順利、好人緣增加，適合希望提升人際關係、談案件、開會、客戶溝通或職場互動較順的人。',
    usage: '建議隨身攜帶，放在皮夾、包包內層或乾淨的夾鏈袋中。',
  },
  {
    slug: 'kai-yun-cai-fu',
    name: '開運財符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/kai-yun-cai-fu.jpg',
    description: '祈求財氣流通、業務拓展與收入機會增加，適合業務、開店者、創業者、自由業者或需要提升財運流動的人。',
    usage: '建議隨身攜帶，或放在工作包、錢包、收款相關物品附近。',
  },
  {
    slug: 'tao-hua-fu',
    name: '桃花符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/tao-hua-fu.jpg',
    description: '祈求感情緣分、人際魅力與客緣提升。單身者可祈求遇見適合的對象；開店者也可作為提升人氣與客源的祈福用品。',
    usage: '建議隨身攜帶，放在皮夾、包包內層或乾淨的夾鏈袋中。',
  },
  {
    slug: 'zhen-e-meng-fu',
    name: '鎮噩夢符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/zhen-e-meng-fu.jpg',
    description: '祈求睡眠安定、減少噩夢干擾，適合容易作夢、睡眠不安或希望夜間心神較穩的人。',
    usage: '建議放在枕頭下方或床邊乾淨處，請避免碰水或受潮。',
  },
  {
    slug: 'fang-xiao-ren-fu',
    name: '防小人符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/fang-xiao-ren-fu.jpg',
    description: '祈求遠離是非、小人干擾與不必要的人際消耗，適合容易遇到口舌、人際壓力或職場是非的人。',
    usage: '建議隨身攜帶，放在皮夾、包包內層或乾淨的夾鏈袋中。',
  },
  {
    slug: 'li-jing-ying-fu',
    name: '利經營符',
    category: '符咒商品',
    priceTwd: 6600,
    validity: '一年內',
    image: '/products/spiritual/li-jing-ying-fu.jpg',
    description: '祈求經營順利、財氣穩定與生意運作順暢，適合開店、創業、自由業、工作室或需要穩定經營的人。',
    usage: '建議放在保險箱、錢櫃、收銀處、銀行或郵局存摺附近，並保持環境乾淨整齊。',
  },
  {
    slug: 'zhen-zhai-fu',
    name: '鎮宅符',
    category: '符咒商品',
    priceTwd: 6600,
    validity: '一年內',
    image: '/products/spiritual/zhen-zhai-fu.jpg',
    description: '祈求居家空間安定、家宅平順與氣場穩定，適合放置於住家、工作室或常用空間。',
    usage: '建議使用 A4 相框裱起來，放在家中看得順眼、乾淨且穩定的位置。',
  },
  {
    slug: 'gao-jie-zhen-zhai-fu',
    name: '高階鎮宅符',
    category: '符咒商品',
    priceTwd: 12000,
    validity: '一年內',
    image: '/products/spiritual/gao-jie-zhen-zhai-fu.jpg',
    description: '進階鎮宅祈福用品，祈求居家或空間氣場穩定、財位安定與整體環境平順，適合需要較完整安宅祈福的人。',
    usage: '建議使用 A4 相框裱起來，可放在覺得順眼的位置或財位，並保持周圍乾淨。',
  },
  {
    slug: 'jin-guang-bao-shen-fu',
    name: '金光保身符',
    category: '符咒商品',
    priceTwd: 3600,
    validity: '一年內',
    image: '/products/spiritual/jin-guang-bao-shen-fu.jpg',
    description: '祈求保身平安、減少外在雜氣與靈性干擾，適合希望加強自身安定感與保護感的人。',
    usage: '建議隨身攜帶，放在皮夾、包包內層或乾淨的夾鏈袋中。',
  },
  {
    slug: 'wu-lei-ya-sha-fu',
    name: '五雷壓煞符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '3 個月',
    image: '/products/spiritual/wu-lei-ya-sha-fu.jpg',
    description: '祈求淨身、去霉氣、清理負能量與減少外在靈性干擾，適合成人在感覺磁場低落、卡陰或運勢不順時作為民俗淨化用品。',
    usage: '使用時可燒化後，以煙繞過自身周圍作為淨化。請注意通風與用火安全，遠離易燃物。',
    note: '限成人使用。請勿直接對小朋友燒化；若小朋友需要淨化，請先將符咒燒化於清水中，再以噴霧方式外用淨化全身。請勿飲用符水。',
  },
  {
    slug: 'ju-bao-pen',
    name: '聚寶盆',
    category: '聚寶盆',
    priceTwd: 12000,
    validity: '不適用',
    image: '/products/spiritual/ju-bao-pen1.jpg',
    images: [
      '/products/spiritual/ju-bao-pen1.jpg',
      '/products/spiritual/ju-bao-pen2.jpg',
    ],
    description: '聚寶盆為財氣聚集與祈願使用的民俗信仰用品，適合希望建立財位、聚財象徵與日常許願儀式的人。',
    usage: '建議放在財位，並每日早晚點香許願，作為穩定心念與財氣祈願的日常儀式。',
    note: '此價格僅包含開光手法，不包含聚寶盆本體、符咒及相關材料費用。聚寶盆與材料等費用需另計。',
  },
]
