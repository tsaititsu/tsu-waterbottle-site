import { useState } from 'react';
import type { ZiweiChart, ZiweiHoroscope } from '../lib';
import { ORDINALS, ORDINALS_EN, stemBranchPinyin } from '../i18n';
import { getChildhoodPeriod } from '../lib/astrolabe/decadal';
import { useLang } from '../contexts/LangContext';

function withHyphen(text: string) {
  const parts = text.split('-');
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => i === 0 ? p : <><span className="tl-dash">-</span>{p}</>)}</>;
}

interface Props {
  chart: ZiweiChart;
  horoscope: ZiweiHoroscope;
  selectedPalaceIdx: number | null;
  isNatalMode: boolean;
  onSelect: (palaceIdx: number | null) => void;
  /** Advanced 模式：點擊一律送值（不 toggle 成 null），讓上層判斷切焦點 */
  advMode?: boolean;
}

export function DecadalTimeline({ chart, horoscope, selectedPalaceIdx, isNatalMode, onSelect, advMode }: Props) {
  const { locale, showPinyin } = useLang();
  const isEn = locale === 'en';
  const useLatin = isEn || showPinyin; // pinyin mode also uses Chd/Ext labels
  const sorted = [...chart.palaces].sort((a, b) => a.decadal.range[0] - b.decadal.range[0]);
  const main     = sorted.slice(0, 10);   // 一限–十限（永遠顯示）
  const extended = sorted.slice(10);      // 十一、十二限
  const activeDecadalIdx = horoscope.decadal.palaceIndex;

  // 童限：若目前正值童限則預設展開
  const childhood = getChildhoodPeriod(chart.palaces);
  const isCurrentlyChildhood = horoscope.decadal.isChildhood === true;
  // -1 是童限 sentinel（避免跟十二限的實際 palaceIndex 撞）
  const isChildhoodSelected = selectedPalaceIdx === -1;

  // 已明確選大限時不顯示推算的「當前大限」highlight，避免同時亮兩個
  const hasExplicitDecade = selectedPalaceIdx !== null;

  const [showChildhood, setShowChildhood] = useState(isCurrentlyChildhood);
  const [showExtended,  setShowExtended]  = useState(false);

  function renderCell(
    palaceIdx: number,
    heavenlyStem: string,
    earthlyBranch: string,
    ageRange: [number, number],
    ordinalLabel: string,
    ordinalLabelEn: string,
    isChildhoodCell = false,
  ) {
    const isInferred = !isNatalMode && !hasExplicitDecade && (isChildhoodCell
      ? isCurrentlyChildhood
      : (palaceIdx === activeDecadalIdx && !isCurrentlyChildhood));
    const isSelected = isChildhoodCell ? isChildhoodSelected : (palaceIdx === selectedPalaceIdx);
    const isActive = isSelected || isInferred;
    const pinyin = stemBranchPinyin(heavenlyStem, earthlyBranch);

    return (
      <div
        key={isChildhoodCell ? 'childhood' : palaceIdx}
        className={`timeline-cell${isActive ? ' timeline-active' : ''}${isChildhoodCell ? ' timeline-childhood' : ''}`}
        onClick={() => onSelect(advMode ? (isChildhoodCell ? -1 : palaceIdx) : (isSelected ? null : (isChildhoodCell ? -1 : palaceIdx)))}
        title={isChildhoodCell ? '童限' : '點擊切換大限'}
      >
        <div className="tl-label">
          <span className="tl-label-zh">{ordinalLabel}</span>
          <span className="tl-label-en"> {ordinalLabelEn}</span>
        </div>
        <div className="tl-stem">
          <span className="tl-stem-zh">{heavenlyStem}{earthlyBranch}</span>
          <span className="tl-stem-pinyin"> {withHyphen(pinyin)}</span>
        </div>
        <div className="tl-age">{ageRange[0]}<span className="tl-dash">–</span>{ageRange[1]}</div>
      </div>
    );
  }

  return (
    <div className="decadal-timeline">

      {/* ── 童限展開按鈕（左） ─────────────────────────────────── */}
      <button
        className={`timeline-expand-btn timeline-expand-left${showChildhood ? ' expanded' : ''}`}
        onClick={() => setShowChildhood(v => !v)}
        title={showChildhood ? (useLatin ? 'Collapse childhood' : '收起童限') : (useLatin ? 'Childhood' : '展開童限')}
      >
        {showChildhood ? '◂' : (useLatin ? '▸Chd' : '▸童')}
      </button>

      {/* ── 童限格（展開後顯示） ───────────────────────────────── */}
      {showChildhood && renderCell(
        childhood.palaceIndex,
        childhood.heavenlyStem,
        childhood.earthlyBranch,
        childhood.ageRange,
        '童限',
        'Chd',
        true,
      )}

      {/* ── 一限–十限（永遠顯示） ─────────────────────────────── */}
      {main.map((palace, i) => {
        const pinyin = stemBranchPinyin(palace.decadal.heavenlyStem, palace.decadal.earthlyBranch);
        const [start, end] = palace.decadal.range;
        const isInferred = !isNatalMode && !hasExplicitDecade && palace.index === activeDecadalIdx && !isCurrentlyChildhood;
        const isSelected = palace.index === selectedPalaceIdx;
        const isActive = isSelected || isInferred;

        return (
          <div
            key={palace.index}
            className={`timeline-cell${isActive ? ' timeline-active' : ''}`}
            onClick={() => onSelect(advMode ? palace.index : (isSelected ? null : palace.index))}
            title="點擊切換大限"
          >
            <div className="tl-label">
              <span className="tl-label-zh">{ORDINALS[i]}限</span>
              <span className="tl-label-en"> {ORDINALS_EN[i]}</span>
            </div>
            <div className="tl-stem">
              <span className="tl-stem-zh">{palace.decadal.heavenlyStem}{palace.decadal.earthlyBranch}</span>
              <span className="tl-stem-pinyin"> {withHyphen(pinyin)}</span>
            </div>
            <div className="tl-age">{start}<span className="tl-dash">–</span>{end}</div>
          </div>
        );
      })}

      {/* ── 十一/十二限展開按鈕（右） ─────────────────────────── */}
      {extended.length > 0 && (
        <button
          className={`timeline-expand-btn timeline-expand-right${showExtended ? ' expanded' : ''}`}
          onClick={() => setShowExtended(v => !v)}
          title={showExtended ? (useLatin ? 'Collapse extended' : '收起延伸大限') : (useLatin ? 'Extended' : '展開十一、十二限')}
        >
          {showExtended ? '▸' : (useLatin ? '◂Ext' : '◂延')}
        </button>
      )}

      {/* ── 十一/十二限格（展開後顯示） ───────────────────────── */}
      {showExtended && extended.map((palace, i) =>
        renderCell(
          palace.index,
          palace.decadal.heavenlyStem,
          palace.decadal.earthlyBranch,
          palace.decadal.range,
          `${ORDINALS[10 + i]}限`,
          ORDINALS_EN[10 + i],
        ),
      )}

    </div>
  );
}
