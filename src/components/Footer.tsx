import Link from 'next/link'
import { LogoMark } from './LogoMark'

const lineSupportUrl = 'https://lin.ee/6Tpje1P'

export function Footer() {
  return (
    <footer className="border-t border-borderSoft bg-white">
      <div className="section-shell grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <LogoMark />
          <p className="mt-4 max-w-md leading-7 text-textMuted">
            用簡單直覺的方式，看懂自己的命盤、問題與未來方向。
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-deepPurple">服務</h3>
          <div className="mt-3 grid gap-2 text-sm text-textMuted">
            <Link href="/ai-chart">紫微命盤分析</Link>
            <Link href="/ai-divination">紫微牌卡占卜</Link>
            <Link href="/booking">水瓶先生論命預約</Link>
            <Link href="/courses">紫微斗數課程</Link>
          </div>
        </div>
        <div id="about">
          <h3 className="font-semibold text-deepPurple">會員</h3>
          <div className="mt-3 grid gap-2 text-sm text-textMuted">
            <Link href="/account">會員中心</Link>
            <Link href="/payment/success">付款成功示意</Link>
            <Link href="/payment/fail">付款失敗示意</Link>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-deepPurple">消費資訊</h3>
          <div className="mt-3 grid gap-2 text-sm text-textMuted">
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私權政策</Link>
            <Link href="/refund-policy">退款政策</Link>
            <Link href="/consumer-rights">消費者權益</Link>
            <Link href="/contact">聯絡我們</Link>
          </div>
          <div className="mt-5 grid gap-1 text-sm leading-6 text-textMuted">
            <p>客服信箱：water.bottle.fortune.teller@gmail.com</p>
            <p>
              客服 LINE：
              <a className="font-semibold text-deepPurple underline underline-offset-4" href={lineSupportUrl} rel="noopener noreferrer" target="_blank">
                {lineSupportUrl}
              </a>
            </p>
            <p>客服時間：09:00–19:00</p>
            <p>營業人名稱：水瓶先生工作室</p>
            <p>統一編號：61010005</p>
            <p>商業登記地址：彰化縣田尾鄉饒平村東平巷167號1樓</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
