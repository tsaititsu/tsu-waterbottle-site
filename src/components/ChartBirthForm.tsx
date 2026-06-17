'use client'

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActionButton } from './ActionButton'
import { savePendingChartInput } from '@/lib/mockPayment'
import { createZiweiGptPayload, type ChartInput, type ZiweiGptPayload } from '@/features/ziwei-chart/package'
import { OriginalZiweiChartView } from '@/features/ziwei-chart/components/OriginalZiweiChartView'

const timeOptions = [
  { label: '早子時　00:00-00:59', value: 0 },
  { label: '丑時　01:00-02:59', value: 1 },
  { label: '寅時　03:00-04:59', value: 2 },
  { label: '卯時　05:00-06:59', value: 3 },
  { label: '辰時　07:00-08:59', value: 4 },
  { label: '巳時　09:00-10:59', value: 5 },
  { label: '午時　11:00-12:59', value: 6 },
  { label: '未時　13:00-14:59', value: 7 },
  { label: '申時　15:00-16:59', value: 8 },
  { label: '酉時　17:00-18:59', value: 9 },
  { label: '戌時　19:00-20:59', value: 10 },
  { label: '亥時　21:00-22:59', value: 11 },
  { label: '晚子時　23:00-23:59', value: 12 }
]

const birthOrders = ['第二胎', '第三胎', '第四胎']

const analysisPlans = [
  { title: '命盤分析｜個性分析', amount: 100 }
]

type ChartInputResult = { input: ChartInput } | { error: string }
type SavedChart = {
  id: string
  label: string
  input: ChartInput
  payload: ZiweiGptPayload
}

type StoredSavedChart = {
  id: string
  input: ChartInput
}

type StoredChartState = {
  categories: string[]
  selectedCategory: string
  selectedChartId?: string
  charts: Record<string, StoredSavedChart[] | ChartInput>
}

const CHART_STORAGE_KEY = 'waterbottle-chart-categories'

function normalizeCategories(categories: string[]) {
  const unique = Array.from(new Set(['自己', ...categories.map((category) => category.trim()).filter(Boolean)]))
  return unique
}

function chartId(input: ChartInput) {
  return `${input.name || '未命名'}-${input.solarDate}-${input.timeIndex}-${input.gender}`
}

function chartLabel(input: ChartInput) {
  const displayName = input.name || '未命名'
  return `${displayName}｜${input.solarDate}`
}

function toSavedChart(input: ChartInput, id = chartId(input)): SavedChart {
  return {
    id,
    label: chartLabel(input),
    input,
    payload: createZiweiGptPayload(input)
  }
}

function restoreSavedCharts(storedCharts: StoredChartState['charts']) {
  return Object.entries(storedCharts).reduce<Record<string, SavedChart[]>>((result, [category, stored]) => {
    const records = Array.isArray(stored) ? stored : [{ id: chartId(stored), input: stored }]
    const savedCharts = records.reduce<SavedChart[]>((items, record) => {
      try {
        items.push(toSavedChart(record.input, record.id))
      } catch {
        // Skip corrupted records so one bad saved chart does not break the form.
      }
      return items
    }, [])
    if (savedCharts.length > 0) result[category] = savedCharts
    return result
  }, {})
}

export function ChartBirthForm() {
  const [gender, setGender] = useState<'female' | 'male'>('female')
  const [name, setName] = useState('')
  const [categories, setCategories] = useState(['自己'])
  const [selectedCategory, setSelectedCategory] = useState('自己')
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingValue, setEditingValue] = useState('')
  const [selectedBirthOrder, setSelectedBirthOrder] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(analysisPlans[0])
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [timeIndex, setTimeIndex] = useState(0)
  const [formError, setFormError] = useState('')
  const [chartPayload, setChartPayload] = useState<ZiweiGptPayload | null>(null)
  const [chartInput, setChartInput] = useState<ChartInput | null>(null)
  const [selectedChartId, setSelectedChartId] = useState('')
  const [chartsByCategory, setChartsByCategory] = useState<Record<string, SavedChart[]>>({})
  const [hasLoadedSavedCharts, setHasLoadedSavedCharts] = useState(false)

  const applyChartToForm = (input: ChartInput) => {
    const [year, month, day] = input.solarDate.split('-')
    setBirthYear(year ?? '')
    setBirthMonth(month ? String(Number(month)) : '')
    setBirthDay(day ? String(Number(day)) : '')
    setGender(input.gender)
    setName(input.name ?? '')
    setTimeIndex(input.timeIndex)
  }

  const chooseCategory = (category: string) => {
    setSelectedCategory(category)
    const saved = chartsByCategory[category]?.[0]
    if (saved) {
      setSelectedChartId(saved.id)
      setChartPayload(saved.payload)
      setChartInput(saved.input)
      applyChartToForm(saved.input)
      setFormError('')
    } else {
      setSelectedChartId('')
    }
  }

  const chooseSavedChart = (id: string) => {
    const saved = chartsByCategory[selectedCategory]?.find((item) => item.id === id)
    if (!saved) return
    setSelectedChartId(saved.id)
    setChartPayload(saved.payload)
    setChartInput(saved.input)
    applyChartToForm(saved.input)
    setFormError('')
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHART_STORAGE_KEY)
      if (!raw) {
        setHasLoadedSavedCharts(true)
        return
      }

      const stored = JSON.parse(raw) as StoredChartState
      const nextCategories = normalizeCategories(stored.categories ?? [])
      const nextCharts = restoreSavedCharts(stored.charts ?? {})
      const nextSelectedCategory = nextCategories.includes(stored.selectedCategory) ? stored.selectedCategory : '自己'
      const selectedList = nextCharts[nextSelectedCategory] ?? []
      const selfList = nextCharts['自己'] ?? []
      const saved = selectedList.find((item) => item.id === stored.selectedChartId) ?? selectedList[0] ?? selfList[0]
      const savedCategory = saved
        ? Object.entries(nextCharts).find(([, items]) => items.some((item) => item.id === saved.id))?.[0] ?? nextSelectedCategory
        : nextSelectedCategory

      setCategories(nextCategories)
      setChartsByCategory(nextCharts)
      setSelectedCategory(savedCategory)

      if (saved) {
        setSelectedChartId(saved.id)
        setChartPayload(saved.payload)
        setChartInput(saved.input)
        applyChartToForm(saved.input)
      }
    } catch {
      window.localStorage.removeItem(CHART_STORAGE_KEY)
    } finally {
      setHasLoadedSavedCharts(true)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedSavedCharts) return

    const charts: StoredChartState['charts'] = Object.fromEntries(
      Object.entries(chartsByCategory).map(([category, savedCharts]) => [
        category,
        savedCharts.map((saved) => ({
          id: saved.id,
          input: saved.input
        }))
      ])
    )

    const stored: StoredChartState = {
      categories,
      selectedCategory,
      selectedChartId,
      charts
    }

    window.localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(stored))
  }, [categories, chartsByCategory, hasLoadedSavedCharts, selectedCategory, selectedChartId])

  const addCategory = () => {
    const value = newCategory.trim()
    if (!value || categories.includes(value)) return
    setCategories((current) => [...current, value])
    chooseCategory(value)
    setNewCategory('')
  }

  const startEditCategory = (category: string) => {
    setEditingCategory(category)
    setEditingValue(category)
  }

  const saveCategoryName = () => {
    const value = editingValue.trim()
    if (!value || value === '自己') return
    const isDuplicate = categories.some((category) => category === value && category !== editingCategory)
    if (isDuplicate) return

    setCategories((current) => current.map((category) => (category === editingCategory ? value : category)))
    if (selectedCategory === editingCategory) setSelectedCategory(value)
    setChartsByCategory((current) => {
      const next = { ...current }
      if (next[editingCategory]) {
        next[value] = next[editingCategory]
        delete next[editingCategory]
      }
      return next
    })
    setEditingCategory('')
    setEditingValue('')
  }

  const deleteCategory = (category: string) => {
    setCategories((current) => current.filter((item) => item !== category))
    setChartsByCategory((current) => {
      const next = { ...current }
      delete next[category]
      return next
    })
    if (selectedCategory === category) chooseCategory('自己')
    if (editingCategory === category) {
      setEditingCategory('')
      setEditingValue('')
    }
  }

  const canAnalyze = birthYear.trim() !== '' && birthMonth.trim() !== '' && birthDay.trim() !== ''

  const buildChartInput = (): ChartInputResult => {
    if (!canAnalyze) {
      return { error: '請先填寫陽曆生日的年、月、日，才能產生命盤。' }
    }
    const year = Number(birthYear)
    const month = Number(birthMonth)
    const day = Number(birthDay)
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return { error: '請確認陽曆生日的年、月、日格式正確。' }
    }

    return {
      input: {
      solarDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      timeIndex,
      gender,
        name: name.trim()
      }
    }
  }

  const generateChart = () => {
    const result = buildChartInput()
    if ('error' in result) {
      setFormError(result.error)
      setChartPayload(null)
      setChartInput(null)
      return
    }

    try {
      const payload = createZiweiGptPayload(result.input)
      const id = chartId(result.input)
      const savedChart: SavedChart = {
        id,
        label: chartLabel(result.input),
        input: result.input,
        payload
      }
      setChartPayload(payload)
      setChartInput(result.input)
      setSelectedChartId(id)
      setChartsByCategory((current) => {
        const existing = current[selectedCategory] ?? []
        const savedCharts = existing.some((item) => item.id === id)
          ? existing.map((item) => (item.id === id ? savedChart : item))
          : [...existing, savedChart]

        return {
          ...current,
          [selectedCategory]: savedCharts
        }
      })
      setFormError('')
    } catch (error) {
      setChartPayload(null)
      setChartInput(null)
      setFormError(error instanceof Error ? `命盤產生失敗：${error.message}` : '命盤產生失敗，請確認資料後再試一次。')
    }
  }

  const preparePaidInterpretation = () => {
    const result = buildChartInput()
    if ('error' in result) {
      setFormError(result.error)
      return false
    }
    if (!chartPayload || !chartInput || JSON.stringify(result.input) !== JSON.stringify(chartInput)) {
      setFormError('請先用目前填寫的資料產生命盤，再選擇付費解讀。')
      return false
    }

    savePendingChartInput({
      ...result.input,
      category: selectedCategory,
      birthOrder: selectedBirthOrder,
      analysisTitle: selectedPlan.title
    })
    setFormError('')
    return true
  }

  const currentSavedCharts = chartsByCategory[selectedCategory] ?? []

  return (
    <form className="grid gap-6 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">新增命盤</h2>
        <button type="button" className="rounded-full border border-lightGold bg-white px-4 py-2 text-sm font-semibold text-darkGold">
          隨機
        </button>
      </div>

      <div className="grid gap-3">
        <span className="text-sm font-semibold text-textDark">
          性別 <span className="text-deepPurple">*</span>
        </span>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`focus-ring rounded-lg border px-4 py-3 font-semibold ${
              gender === 'female' ? 'border-deepPurple bg-softPurple text-deepPurple' : 'border-borderSoft bg-white text-textDark'
            }`}
            onClick={() => setGender('female')}
          >
            ♀ 女
          </button>
          <button
            type="button"
            className={`focus-ring rounded-lg border px-4 py-3 font-semibold ${
              gender === 'male' ? 'border-deepPurple bg-softPurple text-deepPurple' : 'border-borderSoft bg-white text-textDark'
            }`}
            onClick={() => setGender('male')}
          >
            ♂ 男
          </button>
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-textDark">
          姓名 <span className="font-normal text-textMuted">(選填)</span>
        </span>
        <input className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3" onChange={(event) => setName(event.target.value)} placeholder="請輸入姓名" type="text" value={name} />
      </label>

      <div className="grid gap-3">
        <span className="text-sm font-semibold text-textDark">
          分類 <span className="font-normal text-textMuted">(選填)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <div className="flex items-center gap-1" key={category}>
              {editingCategory === category ? (
                <div className="flex items-center gap-1 rounded-full border border-deepPurple bg-white p-1">
                  <input
                    className="w-24 bg-transparent px-3 py-1 text-sm font-semibold text-deepPurple outline-none"
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        saveCategoryName()
                      }
                      if (event.key === 'Escape') {
                        setEditingCategory('')
                        setEditingValue('')
                      }
                    }}
                    value={editingValue}
                  />
                  <button aria-label="儲存分類名稱" className="grid h-7 w-7 place-items-center rounded-full text-deepPurple hover:bg-softPurple" onClick={saveCategoryName} type="button">
                    <Check size={15} />
                  </button>
                  <button
                    aria-label="取消編輯分類"
                    className="grid h-7 w-7 place-items-center rounded-full text-textMuted hover:bg-softPurple"
                    onClick={() => {
                      setEditingCategory('')
                      setEditingValue('')
                    }}
                    type="button"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold ${
                      selectedCategory === category ? 'border-deepPurple bg-softPurple text-deepPurple' : 'border-borderSoft bg-white text-textMuted'
                    }`}
                    onClick={() => chooseCategory(category)}
                    type="button"
                  >
                    {category}
                  </button>
                  {category !== '自己' && (
                    <div className="flex rounded-full border border-borderSoft bg-white p-1">
                      <button aria-label={`修改${category}分類`} className="grid h-7 w-7 place-items-center rounded-full text-textMuted hover:bg-softPurple hover:text-deepPurple" onClick={() => startEditCategory(category)} type="button">
                        <Pencil size={14} />
                      </button>
                      <button aria-label={`刪除${category}分類`} className="grid h-7 w-7 place-items-center rounded-full text-textMuted hover:bg-softPurple hover:text-deepPurple" onClick={() => deleteCategory(category)} type="button">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addCategory()
              }
            }}
            placeholder="新增分類，例如：客戶、朋友"
            type="text"
            value={newCategory}
          />
          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-deepPurple bg-white px-5 py-3 font-semibold text-deepPurple" onClick={addCategory} type="button">
            <Plus size={18} />
            新增分類
          </button>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-textDark">已儲存命盤</span>
          <select
            className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
            disabled={currentSavedCharts.length === 0}
            onChange={(event) => chooseSavedChart(event.target.value)}
            value={selectedChartId}
          >
            <option value="">{currentSavedCharts.length > 0 ? '請選擇已儲存命盤' : '此分類尚未儲存命盤'}</option>
            {currentSavedCharts.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {saved.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-textMuted">
            產生命盤後會儲存在目前分類；之後點分類，再從這裡選人。
          </span>
        </label>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-textDark">
          陽曆生日 <span className="text-deepPurple">*</span>
        </span>
        <div className="grid grid-cols-[1.4fr_auto_1fr_auto_1fr_auto] items-center gap-2">
          <input
            className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
            inputMode="numeric"
            max="2100"
            min="1900"
            onChange={(event) => setBirthYear(event.target.value)}
            placeholder="1981"
            required
            type="number"
            value={birthYear}
          />
          <span className="font-semibold text-textMuted">年</span>
          <input
            className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
            inputMode="numeric"
            max="12"
            min="1"
            onChange={(event) => setBirthMonth(event.target.value)}
            placeholder="8"
            required
            type="number"
            value={birthMonth}
          />
          <span className="font-semibold text-textMuted">月</span>
          <input
            className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
            inputMode="numeric"
            max="31"
            min="1"
            onChange={(event) => setBirthDay(event.target.value)}
            placeholder="27"
            required
            type="number"
            value={birthDay}
          />
          <span className="font-semibold text-textMuted">日</span>
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-textDark">
          時辰 <span className="text-deepPurple">*</span>
        </span>
        <select className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3" onChange={(event) => setTimeIndex(Number(event.target.value))} value={timeIndex}>
          {timeOptions.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-borderSoft bg-softPurple/55 p-4">
        <button type="button" className="text-sm font-semibold text-deepPurple">
          多胞胎功能 · 測試中 Beta
        </button>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {birthOrders.map((order) => (
            <button
              className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
                selectedBirthOrder === order ? 'border-deepPurple bg-white text-deepPurple' : 'border-borderSoft bg-white text-textMuted'
              }`}
              key={order}
              onClick={() => setSelectedBirthOrder((current) => (current === order ? '' : order))}
              type="button"
            >
              {order}
            </button>
          ))}
        </div>
      </div>

      <button className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white" onClick={generateChart} type="button">
        產生命盤
      </button>

      {formError && <p className="text-sm font-semibold text-deepPurple">{formError}</p>}

      {chartPayload && (
        <div className="chart-workspace grid gap-4 rounded-[24px] border border-borderSoft bg-softPurple p-3 shadow-soft md:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-serifTC text-2xl font-semibold text-deepPurple">完整命盤</h3>
              <p className="mt-1 text-sm text-textMuted">命盤已產生，可以先確認命盤，再選擇是否付費解讀。</p>
            </div>
            <p className="text-sm font-semibold text-darkGold">陽曆 {chartPayload.chart.birthInfo.solarDate}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-textMuted">命盤分類</span>
            {categories.map((category) => (
              <button
                className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold ${
                  selectedCategory === category ? 'border-deepPurple bg-white text-deepPurple' : 'border-borderSoft bg-white/70 text-textMuted'
                }`}
                key={`chart-tab-${category}`}
                onClick={() => chooseCategory(category)}
                type="button"
              >
                {category}
                {chartsByCategory[category]?.length ? `・${chartsByCategory[category].length}筆` : ''}
              </button>
            ))}
          </div>

          <div className="rounded-[18px] border border-white/70 bg-white/70 p-1 md:p-2">
            <OriginalZiweiChartView chart={chartPayload.chart} />
          </div>
        </div>
      )}

      {chartPayload && (
        <div className="grid gap-3 rounded-xl border border-borderSoft bg-softPurple/55 p-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-deepPurple">付費解讀項目</span>
            <select
              className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3 font-semibold text-textDark"
              onChange={(event) => {
                const plan = analysisPlans.find((item) => item.title === event.target.value)
                if (plan) setSelectedPlan(plan)
              }}
              value={selectedPlan.title}
            >
              {analysisPlans.map((plan) => (
                <option key={plan.title} value={plan.title}>
                  {plan.title}　NT${plan.amount}
                </option>
              ))}
            </select>
          </label>
          <ActionButton
            amount={selectedPlan.amount}
            className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white"
            itemName={selectedPlan.title}
            itemType="ai-chart"
            beforeStart={preparePaidInterpretation}
          >
            付費解讀
          </ActionButton>
        </div>
      )}
    </form>
  )
}
