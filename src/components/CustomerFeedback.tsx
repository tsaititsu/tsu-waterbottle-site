'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { TrackedPublicCtaLink } from './analytics/TrackedPublicCtaLink'
import { HOME_FEEDBACKS, type HomeFeedback } from './homeFeedbacks'

const AUTOPLAY_INTERVAL_MS = 4500
const MANUAL_RESUME_DELAY_MS = 6500
const CAROUSEL_COPIES = [0, 1, 2] as const
const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function CustomerFeedback() {
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const carouselRegionRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const manualPauseUntilRef = useRef(0)
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()
  const [selectedFeedback, setSelectedFeedback] = useState<HomeFeedback | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isPointerPaused, setIsPointerPaused] = useState(false)
  const [isFocusPaused, setIsFocusPaused] = useState(false)
  const [manualInteractionVersion, setManualInteractionVersion] = useState(0)
  const isPaused = isPointerPaused || isFocusPaused

  const getCarouselAnchor = useCallback((copy: number, index = 0) => {
    return carouselRef.current?.querySelector<HTMLElement>(
      `[data-carousel-copy="${copy}"][data-feedback-index="${index}"]`,
    )
  }, [])

  const scrollByCard = useCallback(
    (direction: -1 | 1, behavior: ScrollBehavior) => {
      const viewport = carouselRef.current
      const firstCard = getCarouselAnchor(1)
      const secondCard = getCarouselAnchor(1, 1)
      if (!viewport || !firstCard) return

      const cardStep = secondCard
        ? secondCard.offsetLeft - firstCard.offsetLeft
        : firstCard.offsetWidth
      viewport.scrollBy({ left: direction * cardStep, behavior })
    },
    [getCarouselAnchor],
  )

  const pauseAfterManualInteraction = useCallback(() => {
    manualPauseUntilRef.current = Date.now() + MANUAL_RESUME_DELAY_MS
    setManualInteractionVersion((version) => version + 1)
  }, [])

  const handleManualScroll = useCallback(
    (direction: -1 | 1) => {
      pauseAfterManualInteraction()
      scrollByCard(direction, prefersReducedMotion ? 'auto' : 'smooth')
    },
    [pauseAfterManualInteraction, prefersReducedMotion, scrollByCard],
  )

  const handleInfiniteScroll = useCallback(() => {
    const viewport = carouselRef.current
    const firstCopyStart = getCarouselAnchor(0)?.offsetLeft
    const middleCopyStart = getCarouselAnchor(1)?.offsetLeft
    const lastCopyStart = getCarouselAnchor(2)?.offsetLeft
    if (
      !viewport ||
      firstCopyStart === undefined ||
      middleCopyStart === undefined ||
      lastCopyStart === undefined
    ) {
      return
    }

    const copyWidth = middleCopyStart - firstCopyStart
    if (viewport.scrollLeft <= firstCopyStart + 1) {
      viewport.scrollLeft += copyWidth
    } else if (viewport.scrollLeft >= lastCopyStart - 1) {
      viewport.scrollLeft -= copyWidth
    }
  }, [getCarouselAnchor])

  const closeDialog = useCallback(() => {
    setSelectedFeedback(null)
  }, [])

  const openDialog = useCallback(
    (feedback: HomeFeedback, trigger: HTMLButtonElement) => {
      previousFocusRef.current = trigger
      setSelectedFeedback(feedback)
      pauseAfterManualInteraction()
    },
    [pauseAfterManualInteraction],
  )

  useEffect(() => {
    const middleCopyStart = getCarouselAnchor(1)?.offsetLeft
    if (middleCopyStart === undefined || !carouselRef.current) return
    carouselRef.current.scrollLeft = middleCopyStart
  }, [getCarouselAnchor])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setPrefersReducedMotion(motionQuery.matches)
    updateMotionPreference()
    motionQuery.addEventListener('change', updateMotionPreference)
    return () => motionQuery.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return

    let timeoutId = 0
    const scheduleNextScroll = () => {
      const resumeDelay = Math.max(0, manualPauseUntilRef.current - Date.now())
      timeoutId = window.setTimeout(
        () => {
          scrollByCard(1, 'smooth')
          scheduleNextScroll()
        },
        Math.max(AUTOPLAY_INTERVAL_MS, resumeDelay),
      )
    }

    scheduleNextScroll()
    return () => window.clearTimeout(timeoutId)
  }, [
    isPaused,
    manualInteractionVersion,
    prefersReducedMotion,
    scrollByCard,
  ])

  useEffect(() => {
    if (!selectedFeedback) return

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => element.offsetParent !== null)

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleDocumentKeyDown)
      document.body.style.overflow = previousBodyOverflow
      previousFocusRef.current?.focus()
    }
  }, [closeDialog, selectedFeedback])

  const handleCarouselBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!carouselRegionRef.current?.contains(event.relatedTarget as Node | null)) {
      setIsFocusPaused(false)
    }
  }

  const dialog =
    selectedFeedback && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-textDark/50 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-8"
            data-feedback-dialog-backdrop
            onClick={(event) => {
              if (event.target === event.currentTarget) closeDialog()
            }}
          >
            <div
              ref={dialogRef}
              aria-describedby={dialogDescriptionId}
              aria-labelledby={dialogTitleId}
              aria-modal="true"
              className="w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-lightGold bg-white p-5 shadow-2xl sm:p-7"
              data-feedback-dialog
              role="dialog"
              style={{
                maxHeight: 'min(88dvh, 760px)',
                paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
              }}
              tabIndex={-1}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">
                    {selectedFeedback.category}
                  </span>
                  <h3
                    className="mt-4 font-serifTC text-2xl font-semibold text-deepPurple sm:text-3xl"
                    id={dialogTitleId}
                  >
                    完整客戶回饋
                  </h3>
                </div>
                <button
                  ref={closeButtonRef}
                  aria-label="關閉完整客戶回饋"
                  className="focus-ring grid size-11 shrink-0 place-items-center rounded-lg text-textMuted transition hover:bg-softPurple"
                  onClick={closeDialog}
                  type="button"
                >
                  <X aria-hidden="true" size={22} />
                </button>
              </div>

              <p
                className="mt-6 whitespace-pre-line break-words text-base leading-8 text-textDark sm:text-lg sm:leading-9"
                id={dialogDescriptionId}
              >
                「{selectedFeedback.fullText}」
              </p>
              <p className="mt-6 border-t border-borderSoft pt-4 text-sm font-semibold text-textMuted">
                {selectedFeedback.author}
              </p>
            </div>
          </div>,
          document.body,
        )
      : null

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

        <div
          ref={carouselRegionRef}
          aria-label="客戶回饋輪播"
          aria-roledescription="carousel"
          className="relative mt-8 min-w-0"
          data-home-feedback-carousel
          onBlurCapture={handleCarouselBlur}
          onFocusCapture={() => setIsFocusPaused(true)}
          onMouseEnter={() => setIsPointerPaused(true)}
          onMouseLeave={() => setIsPointerPaused(false)}
          onPointerDown={pauseAfterManualInteraction}
          role="region"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-textMuted sm:hidden">
              左右滑動查看更多
            </p>
            <div className="ml-auto flex gap-2">
              <button
                aria-label="上一則客戶回饋"
                className="focus-ring grid size-11 place-items-center rounded-full border border-borderSoft bg-white text-deepPurple shadow-soft transition hover:border-lightGold hover:bg-softPurple"
                onClick={() => handleManualScroll(-1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={22} />
              </button>
              <button
                aria-label="下一則客戶回饋"
                className="focus-ring grid size-11 place-items-center rounded-full border border-borderSoft bg-white text-deepPurple shadow-soft transition hover:border-lightGold hover:bg-softPurple"
                onClick={() => handleManualScroll(1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={22} />
              </button>
            </div>
          </div>

          <div className="relative">
            <div
              ref={carouselRef}
              className="grid auto-cols-[86%] grid-flow-col items-stretch gap-4 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-2 [scrollbar-width:none] sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_2.5rem)/3)] lg:gap-5 [&::-webkit-scrollbar]:hidden"
              data-feedback-carousel-viewport
              onScroll={handleInfiniteScroll}
            >
              {CAROUSEL_COPIES.flatMap((copy) =>
                HOME_FEEDBACKS.map((feedback, index) => (
                  <article
                    aria-hidden={copy === 1 ? undefined : true}
                    className="flex min-h-[260px] min-w-0 snap-start flex-col rounded-2xl border border-borderSoft bg-white p-5 shadow-soft sm:p-6"
                    data-carousel-copy={copy}
                    data-feedback-card
                    data-feedback-id={feedback.id}
                    data-feedback-index={index}
                    key={`${copy}-${feedback.id}`}
                  >
                    <span className="w-fit rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">
                      {feedback.category}
                    </span>
                    <p
                      className="mt-5 line-clamp-4 grow break-words text-base leading-7 text-textDark sm:text-lg sm:leading-8"
                      data-feedback-highlight
                    >
                      「{feedback.highlight}」
                    </p>
                    <p className="mt-5 text-sm font-semibold text-textMuted">
                      {feedback.author}
                    </p>
                    <button
                      className="focus-ring mt-4 inline-flex min-h-11 w-fit items-center rounded-lg font-semibold text-deepPurple underline decoration-lightGold decoration-2 underline-offset-4 transition hover:text-purpleMain"
                      onClick={(event) => openDialog(feedback, event.currentTarget)}
                      tabIndex={copy === 1 ? 0 : -1}
                      type="button"
                    >
                      查看完整回饋
                    </button>
                  </article>
                )),
              )}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-bgGray to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-bgGray to-transparent"
            />
          </div>
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
      {dialog}
    </section>
  )
}
