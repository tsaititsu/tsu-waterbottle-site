import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const LOGO_PATH = join(process.cwd(), 'public/brand/waterbottle-logo-web.png')

export async function getDefaultShareImageElement() {
  const logoData = await readFile(LOGO_PATH, 'base64')
  const logoSrc = `data:image/png;base64,${logoData}`

  return (
    <div
      style={{
        alignItems: 'center',
        background: '#f9f7fc',
        color: '#30243f',
        display: 'flex',
        height: '100%',
        justifyContent: 'space-between',
        overflow: 'hidden',
        padding: '60px 72px',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          background: '#b8944f',
          borderRadius: 999,
          display: 'flex',
          height: 18,
          left: 72,
          position: 'absolute',
          top: 60,
          width: 92,
        }}
      />
      <div
        style={{
          border: '2px solid rgba(184, 148, 79, 0.35)',
          borderRadius: 999,
          bottom: -150,
          display: 'flex',
          height: 340,
          position: 'absolute',
          right: -88,
          width: 340,
        }}
      />

      <div
        style={{
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid rgba(83, 62, 105, 0.14)',
          borderRadius: 32,
          boxShadow: '0 18px 50px rgba(48, 36, 63, 0.10)',
          display: 'flex',
          height: 390,
          justifyContent: 'center',
          marginTop: 34,
          width: 390,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders this local logo into the PNG. */}
        <img alt="" height={340} src={logoSrc} width={340} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginLeft: 58,
          marginTop: 14,
          width: 602,
        }}
      >
        <div
          style={{
            color: '#30243f',
            display: 'flex',
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1.05,
          }}
        >
          WATERBOTTLE
        </div>
        <div
          style={{
            color: '#604878',
            display: 'flex',
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: '0.12em',
            lineHeight: 1.2,
            marginTop: 18,
          }}
        >
          紫微命理
        </div>
        <div
          style={{
            background: '#b8944f',
            display: 'flex',
            height: 3,
            marginTop: 28,
            width: 74,
          }}
        />
        <div
          style={{
            color: '#51465d',
            display: 'flex',
            fontSize: 27,
            fontWeight: 500,
            letterSpacing: '0.03em',
            lineHeight: 1.45,
            marginTop: 24,
          }}
        >
          紫微命盤分析・牌卡占卜・論命預約
        </div>
        <div
          style={{
            color: '#806d8e',
            display: 'flex',
            fontSize: 20,
            letterSpacing: '0.08em',
            marginTop: 42,
          }}
        >
          tsu-waterbottle.com
        </div>
      </div>
    </div>
  )
}
