'use client'

import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createZiweiGptPayload, type ChartInput, type ZiweiGptPayload } from '@/features/ziwei-chart/package'
import { randomAnonName, RANDOM_NAME_PREFIX } from '@/features/ziwei-chart/lib/anonName'
import {
  getAiChartDraftWorkspace,
  setAiChartDraftSession,
  setAiChartDraftWorkspace,
  type AiChartDraftWorkspace,
} from '@/lib/ai-chart/chartDraftMemory'
import {
  deleteMemberAiChartProfile,
  loadMemberAiChartProfiles,
  saveMemberAiChartProfile,
} from '@/lib/ai-chart/chartProfilesClient'
import {
  normalizeAiChartProfileId,
  type MemberAiChartProfile,
} from '@/lib/ai-chart/chartProfiles'
import { subscribeAuthChange } from '@/lib/mockAuth'

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

type ChartInputResult = { input: ChartInput } | { error: string }
type SavedChart = {
  id: string
  label: string
  input: ChartInput
  payload: ZiweiGptPayload
}

type ChartBirthFormProps = {
  resetKey?: string
}

function normalizeCategories(categories: string[]) {
  const unique = Array.from(new Set(['自己', ...categories.map((category) => category.trim()).filter(Boolean)]))
  return unique
}

function chartId(input: ChartInput) {
  return `${input.name || '未命名'}-${input.solarDate}-${input.timeIndex}-${input.gender}-${input.birthPlace || '未填出生地'}`
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

function restoreSavedCharts(storedCharts: AiChartDraftWorkspace['charts']) {
  return Object.entries(storedCharts).reduce<Record<string, SavedChart[]>>((result, [category, stored]) => {
    const savedCharts = stored.reduce<SavedChart[]>((items, record) => {
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

function restoreMemberProfiles(profiles: MemberAiChartProfile[]) {
  return profiles.reduce<Record<string, SavedChart[]>>((result, profile) => {
    const current = result[profile.category] ?? []
    result[profile.category] = [...current, toSavedChart(profile.input, profile.id)]
    return result
  }, {})
}

function toMemberBirthInput(input: ChartInput) {
  if (!input.birthPlace?.trim()) throw new Error('birth_place_required')
  return {
    solarDate: input.solarDate,
    timeIndex: input.timeIndex,
    gender: input.gender,
    ...(input.name ? { name: input.name } : {}),
    birthPlace: input.birthPlace.trim(),
    ...(typeof input.fixLeap === 'boolean' ? { fixLeap: input.fixLeap } : {}),
  }
}

export function ChartBirthForm({ resetKey = '' }: ChartBirthFormProps) {
  const router = useRouter()
  const [gender, setGender] = useState<'female' | 'male'>('female')
  const [name, setName] = useState('')
  const [categories, setCategories] = useState(['自己'])
  const [selectedCategory, setSelectedCategory] = useState('自己')
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingValue, setEditingValue] = useState('')
  const [selectedBirthOrder, setSelectedBirthOrder] = useState('')
  const [isTwinOptionsOpen, setIsTwinOptionsOpen] = useState(false)
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [timeIndex, setTimeIndex] = useState(0)
  const [formError, setFormError] = useState('')
  const [selectedChartId, setSelectedChartId] = useState('')
  const [chartsByCategory, setChartsByCategory] = useState<Record<string, SavedChart[]>>({})
  const [hasLoadedSavedCharts, setHasLoadedSavedCharts] = useState(false)
  const [memberStorageStatus, setMemberStorageStatus] = useState<
    'checking' | 'temporary' | 'ready' | 'error'
  >('checking')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const applyChartToForm = (input: ChartInput) => {
    const [year, month, day] = input.solarDate.split('-')
    setBirthYear(year ?? '')
    setBirthMonth(month ? String(Number(month)) : '')
    setBirthDay(day ? String(Number(day)) : '')
    setGender(input.gender)
    setName(input.name ?? '')
    setBirthPlace(input.birthPlace ?? '')
    setTimeIndex(input.timeIndex)
  }

  const resetFormToBlank = useCallback(() => {
    setGender('female')
    setName('')
    setSelectedCategory('自己')
    setNewCategory('')
    setEditingCategory('')
    setEditingValue('')
    setSelectedBirthOrder('')
    setIsTwinOptionsOpen(false)
    setBirthYear('')
    setBirthMonth('')
    setBirthDay('')
    setBirthPlace('')
    setTimeIndex(0)
    setFormError('')
    setSelectedChartId('')
  }, [])

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

  const chooseCategory = (category: string) => {
    setSelectedCategory(category)
    const saved = chartsByCategory[category]?.[0]
    if (saved) {
      setSelectedChartId(saved.id)
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
    applyChartToForm(saved.input)
    setFormError('')
  }

  const deleteSelectedSavedChart = async () => {
    if (!selectedChartId) return
    const confirmed = window.confirm(
      memberStorageStatus === 'ready'
        ? '確定要刪除這張會員命盤嗎？'
        : '確定要刪除這張命盤嗎？此動作只會刪除目前分頁中的資料。',
    )
    if (!confirmed) return

    if (
      memberStorageStatus === 'ready' &&
      normalizeAiChartProfileId(selectedChartId)
    ) {
      setIsSavingProfile(true)
      try {
        await deleteMemberAiChartProfile(selectedChartId)
      } catch {
        setFormError('會員命盤刪除失敗，請稍後再試。')
        setIsSavingProfile(false)
        return
      }
      setIsSavingProfile(false)
    }

    setChartsByCategory((current) => {
      const existing = current[selectedCategory] ?? []
      return {
        ...current,
        [selectedCategory]: existing.filter((item) => item.id !== selectedChartId)
      }
    })
    setSelectedChartId('')
    setFormError('')
  }

  useEffect(() => {
    try {
      const stored = getAiChartDraftWorkspace()
      const nextCategories = normalizeCategories(stored.categories)
      const nextCharts = restoreSavedCharts(stored.charts)

      setCategories(nextCategories)
      setChartsByCategory(nextCharts)
      setSelectedCategory('自己')
      setSelectedChartId('')
    } catch {
      setCategories(['自己'])
      setChartsByCategory({})
    } finally {
      setHasLoadedSavedCharts(true)
    }
  }, [])

  useEffect(() => {
    let active = true

    const syncMemberProfiles = async () => {
      setMemberStorageStatus('checking')
      try {
        const result = await loadMemberAiChartProfiles()
        if (!active) return

        if (!result.authenticated) {
          setMemberStorageStatus('temporary')
          return
        }

        const nextCharts = restoreMemberProfiles(result.profiles)
        const nextCategories = normalizeCategories(
          result.profiles.map((profile) => profile.category),
        )
        setCategories(nextCategories)
        setChartsByCategory(nextCharts)
        setSelectedCategory('自己')
        setSelectedChartId('')
        setMemberStorageStatus('ready')
      } catch {
        if (active) setMemberStorageStatus('error')
      }
    }

    void syncMemberProfiles()
    const unsubscribe = subscribeAuthChange(() => {
      void syncMemberProfiles()
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    resetFormToBlank()
  }, [resetKey, resetFormToBlank])

  useEffect(() => {
    if (!hasLoadedSavedCharts) return

    const charts: AiChartDraftWorkspace['charts'] = Object.fromEntries(
      Object.entries(chartsByCategory).map(([category, savedCharts]) => [
        category,
        savedCharts.map((saved) => ({
          id: saved.id,
          input: saved.input
        }))
      ])
    )

    const stored: AiChartDraftWorkspace = {
      categories,
      selectedCategory,
      selectedChartId,
      charts
    }

    setAiChartDraftWorkspace(stored)
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

  const saveCategoryName = async () => {
    const value = editingValue.trim()
    if (!value || value === '自己') return
    const isDuplicate = categories.some((category) => category === value && category !== editingCategory)
    if (isDuplicate) return

    const categoryCharts = chartsByCategory[editingCategory] ?? []
    if (memberStorageStatus === 'ready' && categoryCharts.length > 0) {
      setIsSavingProfile(true)
      try {
        await Promise.all(
          categoryCharts.map((chart) =>
            saveMemberAiChartProfile({
              id: chart.id,
              category: value,
              birthInput: toMemberBirthInput(chart.input),
            }),
          ),
        )
      } catch {
        setFormError('分類名稱同步失敗，請稍後再試。')
        setIsSavingProfile(false)
        return
      }
      setIsSavingProfile(false)
    }

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

  const deleteCategory = async (category: string) => {
    const categoryCharts = chartsByCategory[category] ?? []
    const confirmed = window.confirm(
      categoryCharts.length > 0
        ? `確定要刪除「${category}」分類與其中的會員命盤嗎？`
        : `確定要刪除「${category}」分類嗎？`,
    )
    if (!confirmed) return

    if (memberStorageStatus === 'ready' && categoryCharts.length > 0) {
      setIsSavingProfile(true)
      try {
        await Promise.all(
          categoryCharts.map((chart) => deleteMemberAiChartProfile(chart.id)),
        )
      } catch {
        setFormError('分類刪除失敗，請稍後再試。')
        setIsSavingProfile(false)
        return
      }
      setIsSavingProfile(false)
    }

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

  const canAnalyze =
    birthYear.trim() !== '' &&
    birthMonth.trim() !== '' &&
    birthDay.trim() !== '' &&
    birthPlace.trim() !== ''

  const buildChartInput = (): ChartInputResult => {
    if (!canAnalyze) {
      return { error: '請先填寫陽曆生日與出生地點，才能產生命盤。' }
    }
    const year = Number(birthYear)
    const month = Number(birthMonth)
    const day = Number(birthDay)
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return { error: '請確認陽曆生日的年、月、日格式正確。' }
    }
    if (Array.from(birthPlace.trim()).length > 120) {
      return { error: '出生地點請控制在 120 個字以內。' }
    }

    return {
      input: {
        solarDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        timeIndex,
        gender,
        name: name.trim(),
        birthPlace: birthPlace.trim(),
      },
    }
  }

  const generateChart = async () => {
    const result = buildChartInput()
    if ('error' in result) {
      setFormError(result.error)
      return
    }

    try {
      const payload = createZiweiGptPayload(result.input)
      const localId = chartId(result.input)
      let id = localId
      let savedInput = result.input

      if (memberStorageStatus === 'error') {
        setFormError('會員命盤服務暫時無法使用，請稍後再試。')
        return
      }

      if (memberStorageStatus === 'ready') {
        setIsSavingProfile(true)
        const currentProfileId = normalizeAiChartProfileId(selectedChartId)
        const savedProfile = await saveMemberAiChartProfile({
          ...(currentProfileId ? { id: currentProfileId } : {}),
          category: selectedCategory,
          birthInput: toMemberBirthInput(result.input),
        })
        id = savedProfile.id
        savedInput = savedProfile.input
      }

      const savedChart: SavedChart = {
        id,
        label: chartLabel(savedInput),
        input: savedInput,
        payload
      }
      const existing = chartsByCategory[selectedCategory] ?? []
      const existingId = normalizeAiChartProfileId(selectedChartId)
        ? selectedChartId
        : localId
      const savedCharts = existing.some((item) => item.id === existingId)
        ? existing.map((item) => (item.id === existingId ? savedChart : item))
        : [...existing, savedChart]
      const nextChartsByCategory = {
        ...chartsByCategory,
        [selectedCategory]: savedCharts
      }
      const storedCharts: AiChartDraftWorkspace['charts'] = Object.fromEntries(
        Object.entries(nextChartsByCategory).map(([category, charts]) => [
          category,
          charts.map((chart) => ({
            id: chart.id,
            input: chart.input
          }))
        ])
      )
      const storedState: AiChartDraftWorkspace = {
        categories,
        selectedCategory,
        selectedChartId: id,
        charts: storedCharts
      }
      setSelectedChartId(id)
      setChartsByCategory(nextChartsByCategory)
      setAiChartDraftWorkspace(storedState)
      setAiChartDraftSession({
        input: savedInput,
        chartId: id,
        selectedCategory,
        birthOrder: selectedBirthOrder
      })
      setFormError('')
      router.push('/ai-chart/result')
    } catch {
      setFormError(
        memberStorageStatus === 'ready'
          ? '會員命盤儲存失敗，請稍後再試。'
          : '命盤產生失敗，請確認資料後再試一次。',
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  const currentSavedCharts = chartsByCategory[selectedCategory] ?? []

  return (
    <form className="chart-birth-form grid min-w-0 max-w-full gap-6 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
      <div className="flex min-w-0 items-center justify-between gap-4">
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
        <input className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3" onChange={(event) => setName(event.target.value)} placeholder="請輸入姓名" type="text" value={name} />
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
                        void saveCategoryName()
                      }
                      if (event.key === 'Escape') {
                        setEditingCategory('')
                        setEditingValue('')
                      }
                    }}
                    value={editingValue}
                  />
                  <button aria-label="儲存分類名稱" className="grid h-7 w-7 place-items-center rounded-full text-deepPurple hover:bg-softPurple" onClick={() => void saveCategoryName()} type="button">
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
                      <button aria-label={`刪除${category}分類`} className="grid h-7 w-7 place-items-center rounded-full text-textMuted hover:bg-softPurple hover:text-deepPurple" onClick={() => void deleteCategory(category)} type="button">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3"
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
          <button className="focus-ring inline-flex min-w-0 max-w-full items-center justify-center gap-2 rounded-lg border border-deepPurple bg-white px-5 py-3 font-semibold text-deepPurple" onClick={addCategory} type="button">
            <Plus size={18} />
            新增分類
          </button>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-textDark">已儲存命盤</span>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_auto]">
            <select
              className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3"
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
            <button
              className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3 text-sm font-semibold text-textMuted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedChartId}
              onClick={() => void deleteSelectedSavedChart()}
              type="button"
            >
              刪除命盤
            </button>
          </div>
          <span className="text-xs text-textMuted">
            {memberStorageStatus === 'checking' && '正在確認會員命盤儲存空間…'}
            {memberStorageStatus === 'ready' && '已登入：命盤會安全儲存在會員帳號；之後點分類，再從這裡選人。'}
            {memberStorageStatus === 'temporary' && '未登入：命盤只保留在目前分頁；登入會員後可永久儲存。'}
            {memberStorageStatus === 'error' && '會員命盤載入失敗，請稍後重新整理。'}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-textDark">
          陽曆生日 <span className="text-deepPurple">*</span>
        </span>
        <div className="grid min-w-0 grid-cols-[1.4fr_auto_1fr_auto_1fr_auto] items-center gap-2">
          <input
            className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3"
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
            className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3"
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
            className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3"
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
        <select className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3" onChange={(event) => setTimeIndex(Number(event.target.value))} value={timeIndex}>
          {timeOptions.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-textDark">
          出生地點 <span className="text-deepPurple">*</span>
        </span>
        <input
          className="focus-ring min-w-0 max-w-full rounded-lg border border-borderSoft bg-white px-4 py-3"
          maxLength={120}
          onChange={(event) => setBirthPlace(event.target.value)}
          placeholder="例如：台灣彰化、美國紐約、大陸北京"
          required
          type="text"
          value={birthPlace}
        />
      </label>

      <div className="rounded-xl border border-borderSoft bg-softPurple/45">
        <button
          aria-controls="twin-birth-order-options"
          aria-expanded={isTwinOptionsOpen}
          className="focus-ring flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left"
          onClick={() => setIsTwinOptionsOpen((current) => !current)}
          type="button"
        >
          <span className="grid min-w-0 gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-deepPurple">雙胞胎／多胞胎命盤請點這裡</span>
              <span className="rounded-full border border-borderSoft bg-white px-2 py-0.5 text-[11px] font-semibold text-textMuted">Beta</span>
            </span>
            <span className="text-xs leading-5 text-textMuted">
              若為第二胎以上，請選擇出生順序；第一胎與非多胞胎可直接略過。
            </span>
            {selectedBirthOrder && !isTwinOptionsOpen && (
              <span className="text-xs font-semibold text-deepPurple">已選擇：{selectedBirthOrder}</span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`mt-0.5 shrink-0 text-textMuted transition-transform ${isTwinOptionsOpen ? 'rotate-180' : ''}`}
            size={20}
          />
        </button>
        {isTwinOptionsOpen && (
          <div className="border-t border-borderSoft px-4 pb-4 pt-3" id="twin-birth-order-options">
            <p className="mb-3 text-sm font-semibold text-textDark">請選擇出生順序</p>
            <div className="grid grid-cols-3 gap-2">
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
        )}
      </div>

      <button
        className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSavingProfile || memberStorageStatus === 'checking'}
        onClick={() => void generateChart()}
        type="button"
      >
        {isSavingProfile ? '儲存命盤中…' : memberStorageStatus === 'checking' ? '確認會員資料中…' : '產生命盤'}
      </button>

      {formError && <p className="text-sm font-semibold text-deepPurple">{formError}</p>}
    </form>
  )
}
