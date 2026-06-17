'use client'

import { useMemo, useState } from 'react'
import type { ZiweiChart as PackageZiweiChart } from '../package'
import type { ZiweiChart, ZiweiHoroscope } from '../lib'
import { LangContext } from '../contexts/LangContext'
import { AstrolabeChart } from './AstrolabeChart'
import { DecadalTimeline } from './DecadalTimeline'
import { YearlyTimeline } from './YearlyTimeline'

type OriginalZiweiChartViewProps = {
  chart: PackageZiweiChart
}

function getBirthYear(chart: ZiweiChart) {
  const lunarYear = chart.birthInfo.lunarDate.match(/\d{4}/)?.[0]
  return Number(lunarYear ?? chart.birthInfo.solarDate.slice(0, 4))
}

function dateForDecadal(birthSolarDate: string, ageRangeStart: number): Date {
  const [year, month, day] = birthSolarDate.split('-').map(Number)
  return new Date(year + ageRangeStart + 1, month - 1, day + 1)
}

export function OriginalZiweiChartView({ chart }: OriginalZiweiChartViewProps) {
  const [showPinyin, setShowPinyin] = useState(false)
  const [selectedPalaceIdx, setSelectedPalaceIdx] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [clickedPalaceIdx, setClickedPalaceIdx] = useState<number | null>(null)
  const [isMinorLimitMode, setIsMinorLimitMode] = useState(false)

  const displayChart = chart as unknown as ZiweiChart
  const isNatalMode = selectedPalaceIdx === null && selectedYear === null
  const selectedDecadalRange = useMemo(() => {
    if (selectedPalaceIdx === null || selectedPalaceIdx === -1) return undefined
    return displayChart.palaces.find((palace) => palace.index === selectedPalaceIdx)?.decadal.range
  }, [displayChart.palaces, selectedPalaceIdx])

  const queryDate = useMemo(() => {
    if (selectedYear !== null) return new Date(selectedYear, 6, 1)
    if (selectedPalaceIdx === -1) {
      const birthYear = Number(displayChart.birthInfo.solarDate.slice(0, 4))
      return new Date(birthYear, 6, 1)
    }
    if (selectedPalaceIdx !== null && selectedDecadalRange) {
      return dateForDecadal(displayChart.birthInfo.solarDate, selectedDecadalRange[0])
    }
    return undefined
  }, [displayChart.birthInfo.solarDate, selectedDecadalRange, selectedPalaceIdx, selectedYear])

  const horoscope = useMemo(
    () => chart.horoscope(queryDate) as ZiweiHoroscope,
    [chart, queryDate]
  )
  const originPalaceIdx = clickedPalaceIdx !== null
    ? clickedPalaceIdx
    : selectedPalaceIdx !== null && selectedYear === null
      ? horoscope.decadal.palaceIndex
      : selectedYear !== null
        ? horoscope.yearly.palaceIndex
        : displayChart.palaces.find((palace) => palace.isOriginalPalace)?.index ?? 0

  const handleDecadalSelect = (palaceIdx: number | null) => {
    setSelectedPalaceIdx(palaceIdx)
    setSelectedYear(null)
    setClickedPalaceIdx(null)
    setIsMinorLimitMode(false)
  }

  const handleYearSelect = (year: number | null) => {
    if (year === null && selectedPalaceIdx === null) {
      const inferredIdx = horoscope.decadal.isChildhood ? -1 : horoscope.decadal.palaceIndex
      setSelectedPalaceIdx(inferredIdx)
    }
    setSelectedYear(year)
    setClickedPalaceIdx(null)
    setIsMinorLimitMode(false)
  }

  return (
    <LangContext.Provider
      value={{
        locale: 'zh-TW',
        showPinyin,
        setLocale: () => {},
        togglePinyin: () => setShowPinyin((current) => !current)
      }}
    >
      <div className="original-ziwei-view" data-locale="zh-TW" data-show-pinyin={showPinyin ? 'true' : 'false'}>
        <AstrolabeChart
          chart={displayChart}
          horoscope={horoscope}
          isNatalMode={isNatalMode}
          isYearlyMode={selectedYear !== null}
          clickedPalaceIdx={clickedPalaceIdx}
          onPalaceClick={(idx) => {
            setClickedPalaceIdx((current) => (current === idx ? null : idx))
          }}
          originPalaceIdx={originPalaceIdx}
          onReset={() => {
            setClickedPalaceIdx(null)
            setSelectedPalaceIdx(null)
            setSelectedYear(null)
          }}
          multiBirthOrder={null}
          onPrevTime={() => {}}
          onNextTime={() => {}}
          isRectified={false}
          isMinorLimitMode={isMinorLimitMode && selectedYear !== null}
          onMinorLimitToggle={() => setIsMinorLimitMode((current) => !current)}
          childhoodOverride={
            selectedPalaceIdx === -1
              ? [1, Math.min(...displayChart.palaces.map((palace) => palace.decadal.range[0])) - 1] as [number, number]
              : undefined
          }
        />
        <DecadalTimeline
          chart={displayChart}
          horoscope={horoscope}
          selectedPalaceIdx={selectedPalaceIdx}
          isNatalMode={isNatalMode}
          onSelect={handleDecadalSelect}
        />
        <YearlyTimeline
          chart={displayChart}
          horoscope={horoscope}
          selectedYear={selectedYear}
          onSelect={handleYearSelect}
          decadalRange={
            selectedPalaceIdx === -1
              ? [1, Math.min(...displayChart.palaces.map((palace) => palace.decadal.range[0])) - 1] as [number, number]
              : selectedDecadalRange
          }
          isChildhood={selectedPalaceIdx === -1 ? true : undefined}
        />
      </div>
    </LangContext.Provider>
  )
}
