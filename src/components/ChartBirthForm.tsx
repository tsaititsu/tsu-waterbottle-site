'use client'

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActionButton } from './ActionButton'
import { savePendingChartInput } from '@/lib/mockPayment'
import { createZiweiGptPayload, type ChartInput, type ZiweiGptPayload } from '@/features/ziwei-chart/package'
import { OriginalZiweiChartView } from '@/features/ziwei-chart/components/OriginalZiweiChartView'
import { randomAnonName, RANDOM_NAME_PREFIX } from '@/features/ziwei-chart/lib/anonName'

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
  { title: '紫微命盤完整分析｜完整解析命盤個性分析', amount: 100 }
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
const CHART_NOTES_STORAGE_KEY = 'waterbottle-chart-notes'

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

function randomDefaults() {
  const today = new Date()
  const minMs = new Date(1950, 0, 1).getTime()
  const randomDate = new Date(minMs + Math.random() * (today.getTime() - minMs))
  return {
    year: randomDate.getFullYear(),
    month: randomDate.getMonth() + 1,
    day: randomDate.getDate(),
    timeIndex: Math.floor(Math.random() * timeOptions.length),
    gender: Math.random() < 0.5 ? 'male' : 'female' as 'male' | 'female'
  }
}

function randomName() {
  return `${RANDOM_NAME_PREFIX}${randomAnonName()}`
}

function adjustSolarDate(solarDate: string, offsetDays: number) {
  const [year, month, day] = solarDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
  const selectedPlan = analysisPlans[0]
  const [hasAcceptedPaidNotice, setHasAcceptedPaidNotice] = useState(false)
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
  const [notesByChartId, setNotesByChartId] = useState<Record<string, string>>({})
  const [hasLoadedChartNotes, setHasLoadedChartNotes] = useState(false)

  const applyChartToForm = (input: ChartInput) => {
    const [year, month, day] = input.solarDate.split('-')
    setBirthYear(year ?? '')
    setBirthMonth(month ? String(Number(month)) : '')
    setBirthDay(day ? String(Number(day)) : '')
    setGender(input.gender)
    setName(input.name ?? '')
    setTimeIndex(input.timeIndex)
  }

  const rerollRandomChart = () => {
    const random = randomDefaults()
    setBirthYear(String(random.year))
    setBirthMonth(String(random.month))
    setBirthDay(String(random.day))
    setTimeIndex(random.timeIndex)
    setGender(random.gender)
    setName(randomName())
    setFormError('')
  }

  const shiftChartTime = (direction: -1 | 1) => {
    if (!chartInput) return

    const baseTimeIndex = chartInput.timeIndex
    const nextTimeIndex = (baseTimeIndex + direction + timeOptions.length) % timeOptions.length
    const nextSolarDate = direction === -1 && baseTimeIndex === 0
      ? adjustSolarDate(chartInput.solarDate, -1)
      : direction === 1 && baseTimeIndex === timeOptions.length - 1
        ? adjustSolarDate(chartInput.solarDate, 1)
        : chartInput.solarDate
    const nextInput: ChartInput = {
      ...chartInput,
      solarDate: nextSolarDate,
      timeIndex: nextTimeIndex
    }

    try {
      setChartPayload(createZiweiGptPayload(nextInput))
      setChartInput(nextInput)
      setSelectedChartId('')
      applyChartToForm(nextInput)
      setFormError('')
    } catch (error) {
      setFormError(error instanceof Error ? `命盤產生失敗：${error.message}` : '命盤產生失敗，請確認資料後再試一次。')
    }
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
    try {
      const raw = window.localStorage.getItem(CHART_NOTES_STORAGE_KEY)
      if (raw) setNotesByChartId(JSON.parse(raw) as Record<string, string>)
    } catch {
      window.localStorage.removeItem(CHART_NOTES_STORAGE_KEY)
    } finally {
      setHasLoadedChartNotes(true)
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

  useEffect(() => {
    if (!hasLoadedChartNotes) return
    window.localStorage.setItem(CHART_NOTES_STORAGE_KEY, JSON.stringify(notesByChartId))
  }, [hasLoadedChartNotes, notesByChartId])

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
      setFormError('請先用目前填寫的資料產生命盤，再進行付款。')
      return false
    }
    if (!hasAcceptedPaidNotice) {
      setFormError('請先閱讀並勾選同意 AI 命盤分析服務說明、付款與退款規則及服務條款。')
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

  const currentChartId = chartInput ? chartId(chartInput) : ''
  const currentChartNotes = currentChartId ? notesByChartId[currentChartId] ?? '' : undefined
  const saveChartNotes = (text: string) => {
    if (!currentChartId) return
    const value = text.trim()
    setNotesByChartId((current) => {
      const next = { ...current }
      if (value) next[currentChartId] = value
      else delete next[currentChartId]
      return next
    })
  }

  const currentSavedCharts = chartsByCategory[selectedCategory] ?? []

  return (
    <form className="grid gap-6 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">新增命盤</h2>
        <button
          type="button"
          className="rounded-full border border-lightGold bg-white px-4 py-2 text-sm font-semibold text-darkGold"
          onClick={rerollRandomChart}
        >
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
              <p className="mt-1 text-sm text-textMuted">命盤已產生，可以先確認命盤，再決定是否購買完整分析。</p>
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
            <OriginalZiweiChartView
              chart={chartPayload.chart}
              chartId={currentChartId}
              notes={currentChartNotes}
              onSaveNotes={saveChartNotes}
              onNextTime={() => shiftChartTime(1)}
              onPrevTime={() => shiftChartTime(-1)}
            />
          </div>
        </div>
      )}

      {chartPayload && (
        <div className="grid gap-3 rounded-xl border border-borderSoft bg-softPurple/55 p-4">
          <div>
            <p className="font-serifTC text-lg font-semibold text-deepPurple">AI 命盤分析同意確認</p>
            <p className="mt-1 text-sm text-textMuted">紫微命盤完整分析｜NT${selectedPlan.amount} / 份</p>
          </div>

          <details className="group rounded-xl border border-borderSoft bg-white p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-start gap-3 text-sm leading-7 text-textMuted">
                <input
                  checked={hasAcceptedPaidNotice}
                  className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
                  onChange={(event) => {
                    setHasAcceptedPaidNotice(event.target.checked)
                    if (event.target.checked) setFormError('')
                  }}
                  onClick={(event) => event.stopPropagation()}
                  type="checkbox"
                />
                <span>
                  我已詳細閱讀並同意《AI 命盤分析服務說明》、《付款與退款規則》及《服務條款》，並了解此服務為付款後產生命盤分析結果之數位內容服務。
                  <span className="ml-1 font-semibold text-darkGold underline underline-offset-4 group-open:hidden">點我查看</span>
                  <span className="ml-1 hidden font-semibold text-darkGold underline underline-offset-4 group-open:inline">收合內容</span>
                </span>
              </div>
            </summary>

            <div className="mt-4 max-h-72 space-y-5 overflow-y-auto rounded-lg bg-softPurple/60 p-4 text-sm leading-7 text-textMuted">
              <div>
                <p className="font-semibold text-deepPurple">AI 命盤分析服務說明</p>
                <ul className="mt-2 grid gap-1">
                  <li>服務名稱：紫微命盤完整分析</li>
                  <li>價格：NT$100 / 份</li>
                  <li>服務內容：完整解析命盤個性分析</li>
                  <li>交付方式：付款後於網站產生命盤分析結果</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-deepPurple">付款與退款規則</p>
                <ul className="mt-2 grid gap-2">
                  <li>本服務為數位內容服務。</li>
                  <li>使用者完成付款後，系統會依照使用者填寫的出生資料產生命盤分析結果。</li>
                  <li>付款完成並產生分析結果後，因服務已開始提供，原則上不接受取消或退款。</li>
                  <li>若因系統異常導致付款成功但沒有產生分析結果，可聯繫水瓶先生官方 LINE 協助處理。</li>
                  <li>若使用者填錯出生資料、日期、時間、性別或其他欄位，導致分析結果不符合期待，恕不提供退款。</li>
                  <li>使用者送出付款前，應自行確認填寫資料正確。</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-deepPurple">服務條款</p>
                <ul className="mt-2 grid gap-2">
                  <li>AI 命盤分析內容僅供命理參考，不作為醫療、法律、投資、重大人生決策之唯一依據。</li>
                  <li>使用者應自行判斷與承擔實際行動結果。</li>
                  <li>若有命盤資料、付款或系統問題，可聯繫水瓶先生官方 LINE。</li>
                </ul>
              </div>
            </div>
          </details>

          <ActionButton
            amount={selectedPlan.amount}
            className="focus-ring inline-flex w-full justify-center rounded-xl bg-deepPurple px-5 py-3 font-semibold text-white sm:w-auto"
            itemName={selectedPlan.title}
            itemType="ai-chart"
            beforeStart={preparePaidInterpretation}
          >
            前往付款 NT${selectedPlan.amount}
          </ActionButton>
        </div>
      )}
    </form>
  )
}
