import { useMemo } from 'react';
import type { ZiweiChart, ZiweiHoroscope } from '../lib';
import { BRANCH_GRID } from '../i18n';
import { PalaceCell } from './PalaceCell';
import { CenterInfo } from './CenterInfo';
import { ThreeSideLine } from './ThreeSideLine';
interface Props {
  chart: ZiweiChart;
  horoscope: ZiweiHoroscope;
  isNatalMode: boolean;
  isYearlyMode: boolean;
  clickedPalaceIdx: number | null;
  onPalaceClick: (idx: number) => void;
  originPalaceIdx: number;
  onReset: () => void;
  multiBirthOrder: 2 | 3 | 4 | null;
  onPrevTime: () => void;
  onNextTime: () => void;
  isRectified: boolean;
  isMinorLimitMode?: boolean;
  onMinorLimitToggle?: () => void;
  childhoodOverride?: [number, number];
  advMode?: boolean;
  onAdvToggle?: () => void;
  advLayers?: { natal: boolean; decadal: boolean; yearly: boolean; monthly: boolean; daily: boolean; minorLimit: boolean };
  advFocus?: 'natal' | 'decadal' | 'yearly' | 'monthly' | 'daily';
  notes?: string;
  onSaveNotes?: (text: string) => void;
  chartId?: string;
  alias?: string;
  onSaveAlias?: (text: string) => void;
}

export function AstrolabeChart({ chart, horoscope, isNatalMode, isYearlyMode, clickedPalaceIdx, onPalaceClick, originPalaceIdx, onReset, multiBirthOrder, onPrevTime, onNextTime, isRectified, isMinorLimitMode, onMinorLimitToggle, childhoodOverride, advMode, onAdvToggle, advLayers, advFocus, notes, onSaveNotes, chartId, alias, onSaveAlias }: Props) {
  const minorLimitAgesMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    chart.palaces.forEach(p => { map[p.index] = p.ages; });
    return map;
  }, [chart]);

  return (
    <div className="chart-wrapper">
      <div className="chart-grid">
        {chart.palaces.map(palace => {
          const pos = BRANCH_GRID[palace.earthlyBranch];
          if (!pos) return null;
          return (
            <PalaceCell
              key={palace.index}
              palace={palace}
              horoscope={horoscope}
              isNatalMode={isNatalMode}
              isYearlyMode={isYearlyMode}
              style={{ gridRow: pos[0] + 1, gridColumn: pos[1] + 1 }}
              isClicked={clickedPalaceIdx === palace.index}
              onClick={() => onPalaceClick(palace.index)}
              minorLimitAges={isNatalMode ? (minorLimitAgesMap[palace.index] ?? []) : []}
              isMinorLimitMode={isMinorLimitMode}
              onMinorLimitToggle={onMinorLimitToggle}
              advLayers={advLayers}
              advFocus={advFocus}
            />
          );
        })}

        <div className="center-cell" style={{ gridRow: '2/4', gridColumn: '2/4' }}>
          <CenterInfo chart={chart} horoscope={horoscope} isNatalMode={isNatalMode} onReset={onReset} multiBirthOrder={multiBirthOrder} onPrevTime={onPrevTime} onNextTime={onNextTime} isRectified={isRectified} childhoodOverride={childhoodOverride} advMode={advMode} onAdvToggle={onAdvToggle} notes={notes} onSaveNotes={onSaveNotes} chartId={chartId} alias={alias} onSaveAlias={onSaveAlias} />
        </div>

        {(!isNatalMode || clickedPalaceIdx !== null) && (
          <ThreeSideLine palaces={chart.palaces} originPalaceIdx={originPalaceIdx} />
        )}
      </div>
    </div>
  );
}
