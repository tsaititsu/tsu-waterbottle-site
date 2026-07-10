import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const header = readFileSync(join(root, 'src/components/Header.tsx'), 'utf8')
const bottomNav = readFileSync(join(root, 'src/components/MobileBottomNav.tsx'), 'utf8')
const lineButton = readFileSync(join(root, 'src/components/FloatingLineButton.tsx'), 'utf8')
const layout = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8')
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8')

// 實際使用中的手機 Header：購物車與漢堡各自保有至少 44px 觸控區。
assert.equal(header.includes('href="/cart"'), true)
assert.equal(header.includes('購物車，共 ${totalQuantity} 件商品'), true)
assert.equal(header.includes('h-11 w-11'), true)
assert.equal(header.includes('aria-controls="mobile-navigation"'), true)
assert.equal(header.includes("menuOpen ? '關閉選單' : '開啟選單'"), true)

// 選單可獨立滾動，背景鎖定不會鎖住 panel，並支援關閉／route change。
assert.equal(header.includes('mobile-menu-panel'), true)
assert.equal(header.includes("import { createPortal } from 'react-dom'"), true)
assert.equal(header.includes('createPortal('), true)
assert.equal(header.includes('document.body'), true)
assert.equal(header.includes('mobile-menu-overlay fixed inset-0'), true)
assert.equal(header.includes('mobile-menu-backdrop absolute inset-0 z-0'), true)
assert.equal(header.includes('onClick={() => setMenuOpen(false)}'), true)
assert.equal(header.includes('onClick={(event) => event.stopPropagation()}'), true)
assert.equal(header.includes('setMenuOpen(false)'), true)
assert.equal(header.includes("event.key === 'Escape'"), true)
assert.equal(header.includes("document.body.style.overflow = 'hidden'"), true)
assert.equal(header.includes('document.body.style.overflow = previousBodyOverflow'), true)
assert.equal(header.includes("dataset.mobileMenuOpen = 'true'"), true)
assert.equal(globals.includes('.mobile-menu-overlay {\n  pointer-events: auto'), true)
assert.equal(globals.includes('.mobile-menu-backdrop {\n  pointer-events: auto'), true)
assert.equal(globals.includes('top: var(--site-header-offset)'), true)
assert.equal(globals.includes('right: 0;\n  left: auto;\n  z-index: 1'), true)
assert.equal(globals.includes('width: min(400px, calc(100% - 48px))'), true)
assert.equal(globals.includes('max-height: calc(100dvh - var(--site-header-offset))'), true)
assert.equal(globals.includes('overflow-y: auto'), true)
assert.equal(globals.includes('overscroll-behavior: contain'), true)
assert.equal(globals.includes('-webkit-overflow-scrolling: touch'), true)
assert.equal(globals.includes('env(safe-area-inset-bottom, 0px)'), true)

// Header 維持 sticky 並參與版面流；hash 位置使用共用高度補償。
assert.equal(header.includes('site-header sticky top-0'), true)
assert.equal(header.includes('site-header fixed top-0'), false)
assert.equal(globals.includes('--mobile-header-height: 72px'), true)
assert.equal(globals.includes('scroll-padding-top: calc(var(--site-header-offset) + 12px)'), true)

// Root viewport、bottom nav 與主要內容共用 iPhone safe area。
assert.equal(layout.includes('viewportFit: \'cover\''), true)
assert.equal(layout.includes('className="site-main"'), true)
assert.equal(bottomNav.includes('mobile-bottom-nav'), true)
assert.equal(bottomNav.includes('aria-label="手機主要導覽"'), true)
assert.equal(globals.includes('--mobile-bottom-nav-height: 68px'), true)
assert.equal(globals.includes('.site-main'), true)
assert.equal(globals.includes('.mobile-bottom-nav'), true)

// 手機 LINE 固定為 56px、避開 bottom nav；只有桌面沿用拖曳座標。
assert.equal(lineButton.includes('h-14 w-14'), true)
assert.equal(lineButton.includes('md:h-16 md:w-16'), true)
assert.equal(lineButton.includes("data-draggable={isDesktop ? 'true' : 'false'}"), true)
assert.equal(lineButton.includes("style={isDesktop ?"), true)
assert.equal(lineButton.includes("window.matchMedia('(min-width: 768px)')"), true)
assert.equal(lineButton.includes("pathname.startsWith('/ai-chart')"), true)
assert.equal(lineButton.includes("pathname.startsWith('/ai-divination')"), true)
assert.equal(lineButton.includes("pathname === '/'"), true)
assert.equal(lineButton.includes('floating-line-button--mobile-hidden'), true)
assert.equal(globals.includes('.floating-line-button'), true)
assert.equal(globals.includes('var(--mobile-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 16px'), true)
assert.equal(globals.includes("html[data-mobile-menu-open='true'] .floating-line-button"), true)
assert.equal(globals.includes("html[data-mobile-menu-open='true'] .floating-line-button {\n  display: none"), true)
assert.equal(globals.includes('.floating-line-button--mobile-hidden'), true)

// 本包不可用全域裁切掩蓋命盤／占卜個別 overflow。
assert.equal(/(?:html|body)[^{]*\{[^}]*overflow-x:\s*hidden/s.test(globals), false)
assert.equal(header.includes('/api/payments'), false)
assert.equal(lineButton.includes('/api/divination/interpret'), false)

console.log('✓ mobile navigation and floating action source checks passed')
