"use client"

import { ziweiCards } from "@/lib/divination/cards"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const initialMessage = "請先開始洗牌。"
const shufflingMessage = "洗牌中..."
const readyMessage = "洗牌完成，請憑直覺點選一張牌。"
const pendingMessage = "你選到一張牌。請確認是不是這張。"
const previewMessage = "本機開發預覽：正式解讀流程將在下一階段接入。"

export function DivinationDrawPreview() {
  const [started, setStarted] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const [message, setMessage] = useState(initialMessage)
  const [errorMessage, setErrorMessage] = useState("")
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPreviewComplete = message === previewMessage
  const pendingCard = pendingIndex === null ? null : ziweiCards[pendingIndex]

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current)
      }
    }
  }, [])

  function startShuffle() {
    if (shuffling) return

    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current)
    }

    setStarted(true)
    setShuffling(true)
    setPendingIndex(null)
    setErrorMessage("")
    setMessage(shufflingMessage)

    shuffleTimerRef.current = setTimeout(() => {
      setShuffling(false)
      setMessage(readyMessage)
    }, 800)
  }

  function pickCard(index: number) {
    if (!started || shuffling || isPreviewComplete) return

    setPendingIndex(index)
    setErrorMessage("")
    setMessage(pendingMessage)
  }

  function changeCard() {
    if (shuffling) return

    setPendingIndex(null)
    setErrorMessage("")
    setMessage(readyMessage)
  }

  function confirmCard() {
    if (pendingIndex === null) {
      setErrorMessage("請先選一張牌。")
      return
    }

    setErrorMessage("")
    setMessage(previewMessage)
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#8c6a2d] bg-[#050505] p-6 text-[#f4d77d] shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-8">
      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b7964b]">
          Divination Preview
        </p>
        <div className="grid gap-2">
          <h3 className="text-2xl font-semibold tracking-[0.08em] md:text-3xl">抽一張紫微牌卡</h3>
          <p className="leading-7 text-[#d9c68e]">
            請在心中默念問題，洗牌後憑直覺選一張牌。
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#8c6a2d]/80 bg-[#120f09] px-5 py-4 text-[#f4d77d]">
        目前問題：本機開發預覽問題
      </div>

      <div className="mt-8 grid justify-items-center gap-6">
        {!started ? (
          <div className="relative h-44 w-28 overflow-hidden rounded-2xl border border-[#f1cf72] bg-[radial-gradient(circle_at_30%_20%,#5b3a96_0%,#201230_34%,#09070d_72%)] shadow-[0_18px_40px_rgba(122,82,190,0.22)]">
            <Image
              src="/cards/back.png"
              alt="紫微牌卡牌背"
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className={`grid w-full max-w-3xl grid-cols-4 gap-3 sm:grid-cols-7 ${
              shuffling ? "animate-pulse" : ""
            }`}
          >
            {ziweiCards.map((card, index) => {
              const isPending = pendingIndex === index

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => pickCard(index)}
                  disabled={shuffling || isPreviewComplete}
                  className={`group h-32 rounded-2xl border p-2 transition duration-200 sm:h-36 ${
                    isPending
                      ? "border-[#f1cf72] bg-[#251704] shadow-[0_0_24px_rgba(241,207,114,0.35)]"
                      : "border-[#8c6a2d]/80 bg-[#0b090d] hover:-translate-y-1 hover:border-[#f1cf72]"
                  } ${shuffling || isPreviewComplete ? "cursor-default opacity-80" : ""}`}
                  aria-label={`選擇第 ${index + 1} 張牌：${card.name}`}
                >
                  <span className="relative block h-full overflow-hidden rounded-xl border border-[#d5ad4a]/50 bg-[radial-gradient(circle_at_30%_20%,#5b3a96_0%,#1b1128_38%,#050505_76%)] transition group-hover:border-[#f1cf72]">
                    <Image
                      src="/cards/back.png"
                      alt=""
                      fill
                      sizes="(min-width: 640px) 96px, 25vw"
                      className="object-cover"
                    />
                    <span className="sr-only">紫微牌卡牌背</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <p
          className={`text-center leading-7 ${
            isPreviewComplete ? "text-[#8af0c0]" : "text-[#f4d77d]"
          }`}
        >
          {message}
        </p>

        {errorMessage ? <p className="text-center text-[#ff9aa8]">{errorMessage}</p> : null}

        {pendingIndex !== null && !isPreviewComplete ? (
          <div className="grid w-full max-w-xl gap-3 rounded-2xl border border-[#0b8f74] bg-[#041d17] p-4 text-[#bff9df]">
            <p className="text-lg font-semibold">是不是這張牌？</p>
            <div className="grid gap-2 rounded-2xl border border-[#0b8f74]/70 bg-[#02120e] p-4 leading-7">
              <p>你選到：{pendingCard?.name ?? "紫微牌卡"}</p>
              <p>正反位：本機預覽暫不顯示</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={confirmCard}
                className="rounded-full border border-[#f1cf72] bg-[#201508] px-5 py-3 font-semibold text-[#f4d77d] transition hover:bg-[#2f210c]"
              >
                就是這張，開始解讀
              </button>
              <button
                type="button"
                onClick={changeCard}
                className="rounded-full border border-[#0b8f74] px-5 py-3 font-semibold text-[#bff9df] transition hover:bg-[#06251d]"
              >
                換一張
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={startShuffle}
          disabled={shuffling}
          className="w-full max-w-sm rounded-full border border-[#f1cf72] bg-[#1b1206] px-8 py-4 text-lg font-semibold text-[#f4d77d] transition hover:bg-[#2b1d0a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {shuffling ? "洗牌中..." : started ? "重新洗牌" : "開始洗牌"}
        </button>
      </div>
    </section>
  )
}
