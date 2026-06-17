import type { ZiweiChart, ZiweiHoroscope } from '../lib';
import { yearStemBranch, stemBranchPinyin, lunarToArabic } from '../i18n';
import { useLang } from '../contexts/LangContext';

function withHyphen(text: string) {
  const parts = text.split('-');
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => i === 0 ? p : <><span className="yl-dash">-</span>{p}</>)}</>;
}

interface Props {
  chart: ZiweiChart;
  horoscope: ZiweiHoroscope;
  selectedYear: number | null;
  onSelect: (year: number | null) => void;
  /** When a decade is explicitly selected, lock the year list to that decade's
   *  range so clicking a boundary year doesn't jump to the next decade. */
  decadalRange?: [number, number];
  /** Explicit childhood override. When the user is viewing 童限, selecting a
   *  boundary year makes `horoscope` recompute to the first real decade
   *  (isChildhood flips to false), which would wrongly pad the range to 10
   *  years. Pass this so the range stays the exact childhood span. */
  isChildhood?: boolean;
  /** Advanced 模式：點擊一律送年值（不 toggle 成 null），讓上層判斷切焦點 */
  advMode?: boolean;
}

export function YearlyTimeline({ chart, horoscope, selectedYear, onSelect, decadalRange, isChildhood: isChildhoodProp, advMode }: Props) {
  const { locale, showPinyin } = useLang();
  // Pinyin mode is same as English for unit display
  const ageUnit = (locale.startsWith('zh') && !showPinyin) ? '歲' : 'yr';
  const birthYear = parseInt(lunarToArabic(chart.birthInfo.lunarDate).split('-')[0]);
  const [start, end] = decadalRange ?? horoscope.decadal.ageRange;

  // 童限：使用精確範圍，不補足 10 年
  // 顯式 prop 優先（避免選童限邊界年份時 horoscope 重算導致 isChildhood 翻 false）
  const isChildhood = isChildhoodProp ?? (horoscope.decadal.isChildhood === true);
  const rangeLen = end - start + 1;
  const adjStart = isChildhood ? start : (rangeLen >= 5 ? start : Math.max(0, end - 9));
  const adjEnd   = isChildhood ? end   : (rangeLen >= 5 ? end   : adjStart + 9);

  const solarBirthYear = parseInt(chart.birthInfo.solarDate.split('-')[0]);
  const years: number[] = [];
  for (let age = adjStart; age <= adjEnd; age++) {
    const year = birthYear + age;
    if (year < solarBirthYear) continue; // 不顯示出生年前的流年
    years.push(year);
  }

  return (
    <div className="yearly-timeline">
      {years.map(year => {
        const isActive = year === selectedYear;
        const nominalAge = year - birthYear;
        const sb = yearStemBranch(year);
        const pinyin = stemBranchPinyin(sb[0], sb[1]);
        return (
          <div
            key={year}
            className={`yearly-cell${isActive ? ' yearly-active' : ''}`}
            onClick={() => onSelect(advMode ? year : (isActive ? null : year))}
            title="點擊切換流年"
          >
            <div className="yl-stem">{sb}</div>
            <div className="yl-pinyin">{withHyphen(pinyin)}</div>
            <div className="yl-year">{year}</div>
            <div className="yl-age">{nominalAge} {ageUnit}</div>
          </div>
        );
      })}
    </div>
  );
}
