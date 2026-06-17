import Link from 'next/link'
import { LogoMark } from './LogoMark'

export function Footer() {
  return (
    <footer className="border-t border-borderSoft bg-white">
      <div className="section-shell grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
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
      </div>
    </footer>
  )
}
