import { TrackedPublicCtaLink } from './analytics/TrackedPublicCtaLink'

const featuredFeedback = {
  service: '論命預約',
  label: '精選回饋',
  author: '匿名會員',
  paragraphs: [
    '我原本有一位十幾年的紫微論命老師，所以其實不太再找其他人論命。後來看到水瓶先生的文章，聊天之後才知道原來也是大耕老師的學生，幾次交流後決定請水瓶先生排命盤。',
    '大致上都符合，但讓我最有感的是，水瓶先生不是叫我認命，而是讓我知道可以怎麼微調，讓自己的人生慢慢掌握在自己手裡。雖然不可能全部都控制，但那種為自己而活的感受是很好的。',
    '最後讓我驚訝的是，水瓶先生會寄淨身符、財運符、人緣符給客戶，是到雲林武德宮過完爐後寄來的。這些行為讓我感受到希望，而且符的期限到了，還會再重新寄給我，我真的覺得這份幫助已經超過解盤費用了。',
    '如果你對自己的人生有興趣，或對人生感到迷惑，真的可以給水瓶先生解盤。可以認識自己，是一件很幸福的事情。'
  ]
}

const feedbackItems = [
  {
    service: '紫微命盤分析',
    message: '才 100 元，把我的個性分析講到我都懷疑 AI 是不是我媽了。',
    author: '匿名會員'
  },
  {
    service: '紫微命盤分析',
    message: '看完後比較知道自己個性上容易卡住的地方，也比較知道下一步怎麼調整。',
    author: '匿名會員'
  },
  {
    service: '紫微牌卡占卜',
    message: '原本只是想問一個感情問題，解讀卻把我心裡真正糾結的點講出來了。',
    author: '匿名會員'
  },
  {
    service: '紫微牌卡占卜',
    message: '占卜一次 50 元，講得比外面 15 分鐘 300 元的還要詳細。',
    author: '匿名會員'
  },
  {
    service: '論命預約',
    message: '老師完全站在我這邊，會提醒我該注意什麼，也會提醒我哪些決定做了之後不要讓自己後悔。',
    author: '匿名會員'
  },
  {
    service: '論命預約',
    message: '以前會有靈異體質，老師竟然也看得出來，論命後還有逐字稿跟重點整理也太貼心了。',
    author: '匿名會員'
  }
]

export function CustomerFeedback() {
  return (
    <section className="bg-bgGray py-12 md:py-20">
      <div className="section-shell">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-darkGold">Feedback</p>
          <h2 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">客戶回饋</h2>
          <p className="mt-4 text-lg leading-8 text-textMuted">
            很多人看完後，不只是覺得準，而是更知道接下來可以怎麼做。
          </p>
        </div>

        <article
          className="mt-10 min-w-0 rounded-[28px] border border-lightGold bg-white p-6 shadow-soft md:p-8"
          data-featured-feedback
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="w-fit rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                {featuredFeedback.label}
              </span>
              <span className="w-fit rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">
                {featuredFeedback.service}
              </span>
            </div>
            <p className="text-sm font-semibold text-textMuted">{featuredFeedback.author}</p>
          </div>

          <div className="mt-6 grid gap-5 text-lg leading-8 text-textDark md:text-xl md:leading-9">
            {featuredFeedback.paragraphs.map((paragraph) => (
              <p key={paragraph}>「{paragraph}」</p>
            ))}
          </div>
        </article>

        <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {feedbackItems.map((item) => (
            <article
              className="flex min-w-0 flex-col rounded-2xl border border-borderSoft bg-white p-6 shadow-soft"
              data-feedback-card
              key={`${item.service}-${item.message}`}
            >
              <span className="w-fit rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">
                {item.service}
              </span>
              <p className="mt-5 grow text-lg leading-8 text-textDark">「{item.message}」</p>
              <p className="mt-6 text-sm font-semibold text-textMuted">{item.author}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-4 rounded-2xl border border-borderSoft bg-white p-6 text-center shadow-soft md:grid-cols-[1fr_auto] md:items-center md:text-left">
          <p className="text-lg font-semibold leading-8 text-deepPurple">
            想知道自己的狀態，也可以從一題占卜開始。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <TrackedPublicCtaLink
              className="focus-ring inline-flex justify-center rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white shadow-[0_8px_18px_rgba(59,15,117,0.18)]"
              destination="ai_divination"
              href="/ai-divination"
              placement="home_feedback"
            >
              體驗牌卡占卜
            </TrackedPublicCtaLink>
            <TrackedPublicCtaLink
              className="focus-ring inline-flex justify-center rounded-lg border border-deepPurple bg-white px-5 py-3 font-semibold text-deepPurple"
              destination="booking"
              href="/booking"
              placement="home_feedback"
            >
              預約論命
            </TrackedPublicCtaLink>
          </div>
        </div>
      </div>
    </section>
  )
}
