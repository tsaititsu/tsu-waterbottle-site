"use client"

import type { KeyboardEvent } from "react"
import { DIVINATION_READING_PRICE_LABEL } from "@/lib/divination/pricing"
import type { DivinationQuestionAdvisoryNotice } from "@/lib/divination/types"

type DivinationQuestionAdvisoryDialogProps = {
  advisory: DivinationQuestionAdvisoryNotice
  disabled?: boolean
  onModify: () => void
  onContinue: () => void
}

const noChargeMessage = "目前尚未抽牌，也不會收取費用。"

export function DivinationQuestionAdvisoryDialog({
  advisory,
  disabled = false,
  onModify,
  onContinue,
}: DivinationQuestionAdvisoryDialogProps) {
  const explanation = advisory.message
    .replace(`${noChargeMessage}你可以修改問題，或仍然繼續抽牌。`, "")
    .replace(`${noChargeMessage} 你可以修改問題，或仍然繼續抽牌。`, "")
    .trim()
  const requiresSeparateReadings = advisory.reasons.includes("multiple_options")

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !disabled) {
      event.preventDefault()
      onModify()
      return
    }

    if (event.key !== "Tab") return

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    )
    const firstButton = buttons.at(0)
    const lastButton = buttons.at(-1)

    if (!firstButton || !lastButton) return

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault()
      lastButton.focus()
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault()
      firstButton.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#24123b]/55 p-4">
      <div
        aria-describedby="divination-question-advisory-description"
        aria-labelledby="divination-question-advisory-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-borderSoft bg-white p-5 shadow-2xl md:p-7"
        role="dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-darkGold">
          提問提醒
        </p>
        <h2
          id="divination-question-advisory-title"
          className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple"
        >
          {advisory.title}
        </h2>
        <div
          id="divination-question-advisory-description"
          className="mt-4 grid gap-3 whitespace-pre-line leading-7 text-textMuted"
        >
          <p>{explanation}</p>
          {advisory.suggestions.length > 0 ? (
            <ul className="grid gap-2 rounded-xl bg-softPurple px-4 py-3 text-sm">
              {advisory.suggestions.map((suggestion) => (
                <li key={suggestion}>・{suggestion}</li>
              ))}
            </ul>
          ) : null}
          {requiresSeparateReadings ? (
            <p className="text-sm">
              若拆成多個問題，每個問題都要個別抽牌；開始 AI 解讀時，每次各收 {DIVINATION_READING_PRICE_LABEL}。
            </p>
          ) : null}
          <p className="font-semibold text-textDark">目前尚未抽牌，也不會收取費用。</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            autoFocus
            disabled={disabled}
            type="button"
            onClick={onModify}
            className="focus-ring min-h-12 rounded-xl border border-borderSoft bg-white px-5 py-3 text-sm font-semibold text-deepPurple transition hover:bg-softPurple disabled:cursor-not-allowed disabled:opacity-60"
          >
            修改問題
          </button>
          <button
            disabled={disabled}
            type="button"
            onClick={onContinue}
            className="focus-ring min-h-12 rounded-xl bg-deepPurple px-5 py-3 text-sm font-semibold text-white transition hover:bg-purpleMain disabled:cursor-not-allowed disabled:opacity-60"
          >
            仍要繼續抽牌
          </button>
        </div>
      </div>
    </div>
  )
}
