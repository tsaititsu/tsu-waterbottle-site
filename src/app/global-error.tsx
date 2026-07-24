'use client'

/* eslint-disable @next/next/no-html-link-for-pages -- This self-contained fallback requires plain anchors. */

type GlobalErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          color: '#1f1b2e',
          background: '#f8f5fc',
          fontFamily:
            '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
        }}
      >
        <title>網站暫時無法載入｜WATERBOTTLE 紫微命理</title>
        <meta name="robots" content="noindex, nofollow" />
        <main
          style={{
            boxSizing: 'border-box',
            display: 'grid',
            minHeight: '100svh',
            placeItems: 'center',
            padding: 16,
            overflowX: 'hidden',
          }}
        >
          <section
            aria-labelledby="waterbottle-global-error-title"
            role="alert"
            style={{
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: 560,
              border: '1px solid #eadff5',
              borderRadius: 24,
              padding: '32px 20px',
              textAlign: 'center',
              background: '#ffffff',
            }}
          >
            <p
              style={{
                margin: '0 0 12px',
                color: '#9b6c12',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.14em',
              }}
            >
              WATERBOTTLE
            </p>
            <h1
              id="waterbottle-global-error-title"
              style={{
                margin: 0,
                color: '#3b0f75',
                fontSize: 'clamp(1.75rem, 8vw, 2.5rem)',
                lineHeight: 1.25,
              }}
            >
              網站暫時無法載入
            </h1>
            <p style={{ margin: '18px auto 0', maxWidth: 440, lineHeight: 1.8 }}>
              網站遇到暫時性問題，請稍後再試。若問題持續，請回到首頁或聯絡客服。
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 16,
                marginTop: 28,
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: 44,
                  border: 0,
                  borderRadius: 999,
                  padding: '10px 20px',
                  color: '#ffffff',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: '#3b0f75',
                }}
              >
                重新嘗試
              </button>
              <a href="/">回到首頁</a>
              <a href="/contact">聯絡客服</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
