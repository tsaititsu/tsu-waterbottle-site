'use client'

import Image from 'next/image'
import Link from 'next/link'

type BrandedErrorPageProps = {
  code: string
  description: string
  onRetry?: () => void
  showChartLink?: boolean
  standalone?: boolean
  title: string
}

const brandedErrorPageStyles = `
  .waterbottle-error-page {
    position: relative;
    display: grid;
    min-height: clamp(520px, 72svh, 760px);
    place-items: center;
    overflow: hidden;
    padding: clamp(48px, 8vw, 96px) 20px;
    color: #1f1b2e;
    background:
      radial-gradient(circle at 16% 12%, rgba(237, 231, 246, 0.98), transparent 32%),
      radial-gradient(circle at 86% 18%, rgba(242, 228, 196, 0.58), transparent 28%),
      #ffffff;
  }

  .waterbottle-error-page[data-standalone='true'] {
    min-height: 100svh;
  }

  .waterbottle-error-card {
    position: relative;
    width: min(100%, 680px);
    border: 1px solid #eadff5;
    border-radius: 28px;
    padding: clamp(28px, 6vw, 52px);
    text-align: center;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 24px 70px rgba(59, 15, 117, 0.12);
  }

  .waterbottle-error-logo {
    display: grid;
    width: 88px;
    height: 88px;
    margin: 0 auto 20px;
    place-items: center;
    border: 1px solid #eadff5;
    border-radius: 24px;
    background: #ffffff;
    box-shadow: 0 12px 32px rgba(59, 15, 117, 0.1);
  }

  .waterbottle-error-code {
    margin: 0;
    color: #9b6c12;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .waterbottle-error-title {
    margin: 12px 0 0;
    color: #3b0f75;
    font-family: "Noto Serif TC", "Songti TC", serif;
    font-size: clamp(2rem, 7vw, 3.25rem);
    font-weight: 700;
    line-height: 1.2;
  }

  .waterbottle-error-description {
    max-width: 560px;
    margin: 20px auto 0;
    color: #665f73;
    font-size: clamp(1rem, 2.8vw, 1.125rem);
    line-height: 1.85;
  }

  .waterbottle-error-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 32px;
  }

  .waterbottle-error-action {
    display: inline-flex;
    min-height: 46px;
    align-items: center;
    justify-content: center;
    border: 1px solid #3b0f75;
    border-radius: 999px;
    padding: 11px 22px;
    color: #3b0f75;
    font: inherit;
    font-weight: 700;
    line-height: 1.4;
    text-decoration: none;
    cursor: pointer;
    background: #ffffff;
    transition:
      background-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .waterbottle-error-action--primary {
    color: #ffffff;
    background: #3b0f75;
  }

  .waterbottle-error-action:hover {
    transform: translateY(-1px);
  }

  .waterbottle-error-action--primary:hover {
    background: #2e095f;
  }

  .waterbottle-error-action--secondary:hover {
    background: #f7f3ff;
  }

  .waterbottle-error-action:focus-visible {
    outline: 3px solid rgba(200, 155, 60, 0.48);
    outline-offset: 3px;
  }

  .waterbottle-error-brand {
    margin: 30px 0 0;
    color: #8a8294;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.15em;
  }

  @media (max-width: 520px) {
    .waterbottle-error-page {
      padding-inline: 14px;
    }

    .waterbottle-error-card {
      border-radius: 22px;
      padding-inline: 22px;
    }

    .waterbottle-error-actions {
      display: grid;
    }

    .waterbottle-error-action {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .waterbottle-error-action {
      transition: none;
    }
  }
`

export function BrandedErrorPage({
  code,
  description,
  onRetry,
  showChartLink = false,
  standalone = false,
  title,
}: BrandedErrorPageProps) {
  return (
    <section
      aria-describedby="waterbottle-error-description"
      aria-labelledby="waterbottle-error-title"
      className="waterbottle-error-page"
      data-standalone={standalone}
      role={onRetry ? 'alert' : undefined}
    >
      <style>{brandedErrorPageStyles}</style>
      <div className="waterbottle-error-card">
        <div className="waterbottle-error-logo">
          <Image
            alt="WATERBOTTLE 樹形 Logo"
            height={72}
            src="/brand/waterbottle-logo-transparent.png"
            width={72}
          />
        </div>

        <p className="waterbottle-error-code">{code}</p>
        <h1 className="waterbottle-error-title" id="waterbottle-error-title">
          {title}
        </h1>
        <p
          className="waterbottle-error-description"
          id="waterbottle-error-description"
        >
          {description}
        </p>

        <div className="waterbottle-error-actions">
          {onRetry ? (
            <button
              className="waterbottle-error-action waterbottle-error-action--primary"
              onClick={onRetry}
              type="button"
            >
              重新嘗試
            </button>
          ) : (
            <Link
              className="waterbottle-error-action waterbottle-error-action--primary"
              href="/"
            >
              回到首頁
            </Link>
          )}

          {onRetry ? (
            <Link
              className="waterbottle-error-action waterbottle-error-action--secondary"
              href="/"
            >
              回到首頁
            </Link>
          ) : null}

          {showChartLink ? (
            <Link
              className="waterbottle-error-action waterbottle-error-action--secondary"
              href="/ai-chart"
            >
              紫微命盤分析
            </Link>
          ) : null}

          <Link
            className="waterbottle-error-action waterbottle-error-action--secondary"
            href="/contact"
          >
            聯絡客服
          </Link>
        </div>

        <p className="waterbottle-error-brand">WATERBOTTLE 紫微命理</p>
      </div>
    </section>
  )
}
