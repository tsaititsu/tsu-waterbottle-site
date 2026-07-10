import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const hero = readFileSync(join(root, 'src/components/HeroSection.tsx'), 'utf8')
const lineButton = readFileSync(join(root, 'src/components/FloatingLineButton.tsx'), 'utf8')
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8')

// 首頁 Hero 的手機標題明確換行，且文字容器可縮小、不再用 nowrap 撐出畫面。
assert.equal(hero.includes('min-w-0 max-w-full'), true)
assert.equal(hero.includes('hero-section-shell section-shell'), true)
assert.equal(hero.includes('text-[30px]'), true)
assert.equal(hero.includes('leading-[1.2]'), true)
assert.equal(hero.includes('<span className="block sm:inline">紫微命盤分析 ×</span>'), true)
assert.equal(hero.includes('<span className="block sm:inline">紫微牌卡占卜</span>'), true)
assert.equal(hero.includes('whitespace-nowrap'), false)
assert.equal(hero.includes('whitespace-normal'), true)
assert.equal(hero.includes('overflow-wrap'), false)
assert.equal(hero.includes('overflow-hidden text'), false)
assert.equal(hero.includes('立即開始分析'), true)
assert.equal(hero.includes('預約水瓶先生論命'), true)

// `/` 只套既有的手機 hidden class；該 class 僅在 767px 以下生效，桌面 LINE 維持原樣。
assert.equal(lineButton.includes("pathname === '/'"), true)
assert.equal(lineButton.includes("window.matchMedia('(min-width: 768px)')"), true)
assert.equal(lineButton.includes('floating-line-button--mobile-hidden'), true)
assert.equal(globals.includes('@media (max-width: 767px)'), true)
assert.equal(globals.includes('.section-shell.hero-section-shell {\n    width: min(1200px, calc(100% - 48px));'), true)
assert.equal(globals.includes('.floating-line-button--mobile-hidden {\n    display: none;'), true)
assert.equal(globals.includes('@media (min-width: 768px)'), true)

// 本包不靠全域水平裁切掩蓋 Hero 或牌卡問題。
assert.equal(/(?:html|body)[^{]*\{[^}]*overflow-x:\s*hidden/s.test(globals), false)

console.log('✓ mobile homepage hero and LINE visibility checks passed')
