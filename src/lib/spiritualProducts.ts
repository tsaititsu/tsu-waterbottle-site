export type SpiritualProduct = {
  slug: string
  name: string
  category: '符咒商品' | '聚寶盆'
  priceTwd: number
  validity: string
  image: string
  images?: string[]
  description: string
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
    description: '人緣與互動關係相關的民俗祈福用品。',
  },
  {
    slug: 'kai-yun-cai-fu',
    name: '開運財符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/kai-yun-cai-fu.jpg',
    description: '開運與財運相關的民俗祈福用品。',
  },
  {
    slug: 'tao-hua-fu',
    name: '桃花符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/tao-hua-fu.jpg',
    description: '桃花、人際魅力與感情緣分相關的民俗祈福用品。',
  },
  {
    slug: 'zhen-e-meng-fu',
    name: '鎮噩夢符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/zhen-e-meng-fu.jpg',
    description: '睡眠安定與鎮噩夢相關的民俗祈福用品。',
  },
  {
    slug: 'fang-xiao-ren-fu',
    name: '防小人符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '半年內',
    image: '/products/spiritual/fang-xiao-ren-fu.jpg',
    description: '防小人與減少人際干擾相關的民俗祈福用品。',
  },
  {
    slug: 'li-jing-ying-fu',
    name: '利經營符',
    category: '符咒商品',
    priceTwd: 6600,
    validity: '一年內',
    image: '/products/spiritual/li-jing-ying-fu.jpg',
    description: '經營事業、店面與生意相關的民俗祈福用品。',
  },
  {
    slug: 'zhen-zhai-fu',
    name: '鎮宅符',
    category: '符咒商品',
    priceTwd: 6600,
    validity: '一年內',
    image: '/products/spiritual/zhen-zhai-fu.jpg',
    description: '居家空間安定與鎮宅相關的民俗祈福用品。',
  },
  {
    slug: 'gao-jie-zhen-zhai-fu',
    name: '高階鎮宅符',
    category: '符咒商品',
    priceTwd: 12000,
    validity: '一年內',
    image: '/products/spiritual/gao-jie-zhen-zhai-fu.jpg',
    description: '進階鎮宅與空間安定相關的民俗祈福用品。',
  },
  {
    slug: 'jin-guang-bao-shen-fu',
    name: '金光保身符',
    category: '符咒商品',
    priceTwd: 3600,
    validity: '一年內',
    image: '/products/spiritual/jin-guang-bao-shen-fu.jpg',
    description: '保身平安與護身相關的民俗祈福用品。',
  },
  {
    slug: 'wu-lei-ya-sha-fu',
    name: '五雷壓煞符',
    category: '符咒商品',
    priceTwd: 1500,
    validity: '3 個月',
    image: '/products/spiritual/wu-lei-ya-sha-fu.jpg',
    description: '針對大人淨身、卡陰、去霉氣使用的民俗祈福用品。',
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
    description: '聚寶盆服務，價格不含材料費。',
    note: '聚寶盆與材料等費用另計。',
  },
]
