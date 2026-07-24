type AdminPaginationProps = {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export default function AdminPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) {
    return <p className="text-sm text-textMuted">共 {total} 筆</p>
  }

  return (
    <nav aria-label="資料分頁" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-textMuted">
        第 {page}／{totalPages} 頁，共 {total} 筆
      </p>
      <div className="flex gap-2">
        <button
          className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple disabled:cursor-not-allowed disabled:opacity-45"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          上一頁
        </button>
        <button
          className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple disabled:cursor-not-allowed disabled:opacity-45"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          下一頁
        </button>
      </div>
    </nav>
  )
}
