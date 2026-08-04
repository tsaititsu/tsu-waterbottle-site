import Link from 'next/link'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { getAdminModulesBySection } from '@/components/admin/adminModules'
import LinePaySandboxE2ePanel from '@/components/admin/LinePaySandboxE2ePanel'
import { isLinePaySandboxE2eRouteEnabled } from '@/app/api/internal/line-pay/sandbox-e2e/start/handler'
import { isLinePayProductionOneDollarRouteEnabled } from '@/app/api/internal/line-pay/production-one-dollar/start/handler'

export const dynamic = 'force-dynamic'

const readOnlyModules = getAdminModulesBySection('readonly')
const toolModules = getAdminModulesBySection('tool')
const unavailableModules = getAdminModulesBySection('unavailable')

export default function AdminPage() {
  const sandboxE2eEnabled = isLinePaySandboxE2eRouteEnabled(process.env)
  const productionOneDollarEnabled =
    isLinePayProductionOneDollarRouteEnabled(process.env)
  const linePayTestEnvironment = sandboxE2eEnabled
    ? 'sandbox'
    : productionOneDollarEnabled
      ? 'production'
      : null

  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="這裡只提供已確認安全邊界的唯讀紀錄與既有工具入口，不呈現假統計，也不預先建立付款、AI 或權限操作。"
        eyebrow="Admin Foundation V1"
        title="能力與模組狀態總覽"
      />

      <section aria-labelledby="readonly-modules" className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="readonly-modules" className="font-serifTC text-2xl font-semibold text-deepPurple">已啟用：唯讀紀錄</h2>
            <p className="mt-2 text-sm leading-7 text-textMuted">所有資料操作都由後端重新驗證管理員身分。</p>
          </div>
          <AdminStatusBadge tone="readonly">唯讀</AdminStatusBadge>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {readOnlyModules.map((module) => {
            if (!module.href) return null
            return (
              <article className="rounded-2xl border border-borderSoft bg-[#faf7ff] p-5" key={module.key}>
                <h3 className="font-serifTC text-xl font-semibold text-deepPurple">{module.label}</h3>
                <p className="mt-2 text-sm leading-7 text-textMuted">{module.description}</p>
                <Link
                  className="focus-ring mt-4 inline-flex rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple"
                  href={module.href}
                >
                  查看唯讀紀錄
                </Link>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="existing-tools" className="rounded-2xl border border-[#ead9a6] bg-[#fffaf0] p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="existing-tools" className="font-serifTC text-2xl font-semibold text-deepPurple">既有營運工具</h2>
            <p className="mt-2 text-sm leading-7 text-textMuted">
              預約時段工具包含既有資料寫入能力；本次只保留並整合入口，不擴充其流程。
            </p>
          </div>
          <AdminStatusBadge tone="tool">含資料寫入</AdminStatusBadge>
        </div>
        {toolModules.map((module) => {
          if (!module.href) return null
          return (
            <Link
              className="focus-ring mt-5 inline-flex rounded-lg bg-[#7d5a00] px-5 py-3 font-semibold text-white"
              href={module.href}
              key={module.key}
            >
              進入{module.label}
            </Link>
          )
        })}
      </section>

      {linePayTestEnvironment ? <LinePaySandboxE2ePanel environment={linePayTestEnvironment} /> : null}

      <section aria-labelledby="unavailable-modules" className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="unavailable-modules" className="font-serifTC text-2xl font-semibold text-deepPurple">尚未啟用</h2>
            <p className="mt-2 text-sm leading-7 text-textMuted">以下只記錄能力狀態，不提供按鈕、API 或假操作流程。</p>
          </div>
          <AdminStatusBadge tone="unavailable">無操作入口</AdminStatusBadge>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {unavailableModules.map((module) => (
            <li className="rounded-xl border border-dashed border-borderSoft bg-[#faf9fb] p-4 text-sm text-textMuted" key={module.key}>
              <span className="font-semibold text-textDark">{module.label}</span>
              <span className="mt-1 block">尚未啟用</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
