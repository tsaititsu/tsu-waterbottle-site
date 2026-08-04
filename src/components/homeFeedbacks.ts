export type HomeFeedback = {
  id: string
  category: string
  highlight: string
  fullText: string
  author: string
}

export const HOME_FEEDBACKS: readonly HomeFeedback[] = [
  {
    id: 'booking-life-direction',
    category: '論命預約',
    highlight:
      '水瓶先生不是叫我認命，而是讓我知道可以怎麼微調，讓自己的人生慢慢掌握在自己手裡。',
    fullText: [
      '我原本有一位十幾年的紫微論命老師，所以其實不太再找其他人論命。後來看到水瓶先生的文章，聊天之後才知道原來也是大耕老師的學生，幾次交流後決定請水瓶先生排命盤。',
      '大致上都符合，但讓我最有感的是，水瓶先生不是叫我認命，而是讓我知道可以怎麼微調，讓自己的人生慢慢掌握在自己手裡。雖然不可能全部都控制，但那種為自己而活的感受是很好的。',
      '最後讓我驚訝的是，水瓶先生會寄淨身符、財運符、人緣符給客戶，是到雲林武德宮過完爐後寄來的。這些行為讓我感受到希望，而且符的期限到了，還會再重新寄給我，我真的覺得這份幫助已經超過解盤費用了。',
      '如果你對自己的人生有興趣，或對人生感到迷惑，真的可以給水瓶先生解盤。可以認識自己，是一件很幸福的事情。',
    ].join('\n\n'),
    author: '匿名會員',
  },
  {
    id: 'chart-personality',
    category: '紫微命盤分析',
    highlight: '才 100 元，把我的個性分析講到我都懷疑 AI 是不是我媽了。',
    fullText: '才 100 元，把我的個性分析講到我都懷疑 AI 是不是我媽了。',
    author: '匿名會員',
  },
  {
    id: 'chart-next-step',
    category: '紫微命盤分析',
    highlight: '看完後比較知道自己個性上容易卡住的地方，也比較知道下一步怎麼調整。',
    fullText: '看完後比較知道自己個性上容易卡住的地方，也比較知道下一步怎麼調整。',
    author: '匿名會員',
  },
  {
    id: 'divination-emotional-knot',
    category: '紫微牌卡占卜',
    highlight: '原本只是想問一個感情問題，解讀卻把我心裡真正糾結的點講出來了。',
    fullText: '原本只是想問一個感情問題，解讀卻把我心裡真正糾結的點講出來了。',
    author: '匿名會員',
  },
  {
    id: 'divination-detail',
    category: '紫微牌卡占卜',
    highlight: '占卜解讀講得比外面 15 分鐘 300 元的還要詳細。',
    fullText: '占卜解讀講得比外面 15 分鐘 300 元的還要詳細。',
    author: '匿名會員',
  },
  {
    id: 'booking-supported',
    category: '論命預約',
    highlight: '老師完全站在我這邊，會提醒我該注意什麼，也會提醒我哪些決定做了之後不要讓自己後悔。',
    fullText: '老師完全站在我這邊，會提醒我該注意什麼，也會提醒我哪些決定做了之後不要讓自己後悔。',
    author: '匿名會員',
  },
  {
    id: 'booking-transcript',
    category: '論命預約',
    highlight: '以前會有靈異體質，老師竟然也看得出來，論命後還有逐字稿跟重點整理也太貼心了。',
    fullText: '以前會有靈異體質，老師竟然也看得出來，論命後還有逐字稿跟重點整理也太貼心了。',
    author: '匿名會員',
  },
]
