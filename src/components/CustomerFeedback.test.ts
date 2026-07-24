import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOME_FEEDBACKS } from './homeFeedbacks'

const root = process.cwd()
const carouselSource = readFileSync(
  join(root, 'src/components/CustomerFeedback.tsx'),
  'utf8',
)

assert.ok(HOME_FEEDBACKS.length >= 7)
for (const feedback of HOME_FEEDBACKS) {
  assert.ok(feedback.category.trim())
  assert.ok(feedback.highlight.trim())
  assert.ok(feedback.fullText.trim())
  assert.ok(feedback.author.trim())
  assert.ok(feedback.fullText.includes(feedback.highlight))
}

const longestFeedback = HOME_FEEDBACKS.find(
  ({ id }) => id === 'booking-life-direction',
)
assert.ok(longestFeedback)
assert.equal(longestFeedback.fullText.includes('我原本有一位十幾年的紫微論命老師'), true)
assert.equal(longestFeedback.fullText.includes('可以認識自己，是一件很幸福的事情。'), true)

assert.equal(carouselSource.startsWith("'use client'"), true)
assert.equal(carouselSource.includes('data-feedback-highlight'), true)
assert.equal(carouselSource.includes('feedback.fullText}</p>'), false)
assert.equal(carouselSource.includes('查看完整回饋'), true)
assert.equal(carouselSource.includes('aria-label="上一則客戶回饋"'), true)
assert.equal(carouselSource.includes('aria-label="下一則客戶回饋"'), true)
assert.equal(carouselSource.includes('auto-cols-[100%]'), true)
assert.equal(carouselSource.includes('auto-cols-[86%]'), false)
assert.equal(carouselSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)')"), true)
assert.equal(carouselSource.includes('if (prefersReducedMotion || isPaused)'), true)
assert.equal(carouselSource.includes("prefersReducedMotion ? 'auto' : 'smooth'"), true)
assert.equal(carouselSource.includes('scroll-smooth'), false)
assert.equal(carouselSource.includes('onMouseEnter={() => setIsPointerPaused(true)}'), true)
assert.equal(carouselSource.includes('onFocusCapture={() => setIsFocusPaused(true)}'), true)
assert.equal(carouselSource.includes('onScroll={handleInfiniteScroll}'), true)
assert.equal(carouselSource.includes('data-carousel-copy'), true)

assert.equal(carouselSource.includes('role="dialog"'), true)
assert.equal(carouselSource.includes('aria-modal="true"'), true)
assert.equal(carouselSource.includes('aria-labelledby={dialogTitleId}'), true)
assert.equal(carouselSource.includes("event.key === 'Escape'"), true)
assert.equal(carouselSource.includes('event.target === event.currentTarget'), true)
assert.equal(carouselSource.includes("document.body.style.overflow = 'hidden'"), true)
assert.equal(carouselSource.includes('previousFocusRef.current?.focus()'), true)
assert.equal(carouselSource.includes("event.key !== 'Tab'"), true)

console.log('✓ homepage feedback carousel and dialog contract passed')
