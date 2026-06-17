import { useRef, useLayoutEffect } from 'react';
import type { ZiweiPalace, ZiweiHoroscope, StarInfo } from '../lib';
import { getPalaceDisplay, getStarDisplay, getDecadalOverlay, getYearlyOverlay, getMonthlyOverlay, getDailyOverlay, STEM_PINYIN, BRANCH_PINYIN } from '../i18n';
import { useLang } from '../contexts/LangContext';

// Display-only 主星排序調整（不動排盤引擎）：太陰與天同同宮時，太陰排前面（中文左／英文上）。
// 引擎輸出順序為紫微系（含天同）在前、天府系（含太陰）在後，此處僅為呈現對調這一對。
function orderMajorForDisplay(stars: StarInfo[]): StarInfo[] {
  const ti = stars.findIndex(s => s.name === '太陰');
  const td = stars.findIndex(s => s.name === '天同');
  if (ti > -1 && td > -1 && td < ti) {
    const copy = [...stars];
    [copy[td], copy[ti]] = [copy[ti], copy[td]];
    return copy;
  }
  return stars;
}

interface Props {
  palace: ZiweiPalace;
  horoscope: ZiweiHoroscope;
  isNatalMode?: boolean;
  isYearlyMode?: boolean;
  isMinorLimitMode?: boolean;
  onMinorLimitToggle?: () => void;
  style?: React.CSSProperties;
  isClicked?: boolean;
  onClick?: () => void;
  minorLimitAges?: number[];
  /** Advanced 模式：明確指定要疊哪些 overlay 層（以焦點為中心的 3 層視窗）。未提供＝沿用 legacy flags。 */
  advLayers?: { natal: boolean; decadal: boolean; yearly: boolean; monthly: boolean; daily: boolean; minorLimit: boolean };
  /** Advanced 模式焦點層：命宮高亮跟著焦點走 */
  advFocus?: 'natal' | 'decadal' | 'yearly' | 'monthly' | 'daily';
}

const MUTAGEN_CHARS = ['祿', '權', '科', '忌'] as const;
const MUTAGEN_PINYIN: Record<string, string> = { '祿':'Lu', '權':'Quan', '科':'Ke', '忌':'Ji' };
const MUTAGEN_ABBR:  Record<string, string> = { '祿':'Lu', '權':'Qn',   '科':'Ke', '忌':'Ji' };

// 十二長生神 — 獨立區塊，放在星耀區左下角
const CHANG_SHENG = new Set([
  '長生','沐浴','冠帶','臨官','帝旺','衰','病','死','墓','絕','胎','養',
]);

// 祿羊陀（本命 + 運限 + 流年 + 流月 + 流日）— 加標記
const FRAMED_STARS = new Set([
  '限祿', '限羊', '限陀',         // 大限
  '年祿', '年羊', '年陀',         // 流年祿羊陀
  '年鸞', '年喜',               // 流年鸞喜
  '月祿', '月羊', '月陀',         // 流月祿羊陀
  '日祿', '日羊', '日陀',         // 流日祿羊陀
  '小祿', '小羊', '小陀',         // 小限祿羊陀
]);

// Stars listed in CLAUDE.md — full size
const FULL_SIZE_STARS = new Set([
  '紫微','天機','太陽','太陰','武曲','天同','廉貞','天梁','天府','天相','七殺','破軍','貪狼','巨門',
  '陀羅','擎羊','火星','鈴星',
  '祿存','文昌','文曲','天鉞','天魁','左輔','右弼','地空','地劫','天馬','紅鸞','天喜',
]);

// CLAUDE.md 輔/煞星 (not major) → black
const CLAUDE_MINOR_STARS = new Set([
  '陀羅','擎羊','火星','鈴星',
  '祿存','文昌','文曲','天鉞','天魁','左輔','右弼','地空','地劫','天馬','紅鸞','天喜',
]);

// 博士/歲前/年支十二神 — tiny（底部三行，不用 StarChip 渲染，此 Set 供其他路徑備用）
// 注意：「蜚廉」刻意不列入 —— 它同時是獨立雜曜（年支起），若列入會被 .star-tiny
// 的灰色覆寫，導致雜曜蜚廉誤顯為灰色（應為淺藍）。博士十二神的蜚廉走 doctor-label
// 渲染、不經 starSizeClass，故不受影響。
const TINY_STARS = new Set([
  '博士','力士','青龍','小耗','將軍','奏書','喜神','病符','大耗','伏兵','官符',
]);

function starSizeClass(name: string): string {
  if (TINY_STARS.has(name)) return 'star-tiny';
  if (!FULL_SIZE_STARS.has(name)) return 'star-small';
  return '';
}

const FLOWER_STARS = new Set(['紅鸞', '天喜']);

function starColorClass(type: string, name: string, scope: MutagenScope = 'origin'): string {
  if (scope === 'decadal')    return 'star-decadal';
  if (scope === 'yearly')     return 'star-yearly';
  if (scope === 'monthly')    return 'star-monthly';
  if (scope === 'daily')      return 'star-daily';
  if (scope === 'minorLimit') return 'star-minorLimit';
  if (type === 'major') return 'star-red';
  if (FLOWER_STARS.has(name)) return 'star-lightblue';
  if (CLAUDE_MINOR_STARS.has(name)) return 'star-black';
  return 'star-lightblue';
}

type MutagenScope = 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'minorLimit';

function MutagenBadge({ char, scope }: { char: string; scope: MutagenScope }) {
  return (
    <span className={`mutagen-badge mutagen-${scope}`}>
      <span className="badge-zh">{char}</span>
      <span className="badge-pinyin badge-pinyin-full">{MUTAGEN_PINYIN[char] ?? ''}</span>
      <span className="badge-pinyin badge-pinyin-abbr">{MUTAGEN_ABBR[char] ?? ''}</span>
    </span>
  );
}

function StarChip({
  star,
  decadalMutagen,
  yearlyMutagen,
  monthlyMutagen,
  dailyMutagen,
  minorLimitMutagen,
  scope = 'origin',
  showOrigin = true,
}: {
  star: StarInfo | any;
  decadalMutagen?: string;
  yearlyMutagen?: string;
  monthlyMutagen?: string;
  dailyMutagen?: string;
  minorLimitMutagen?: string;
  scope?: MutagenScope;
  showOrigin?: boolean;
}) {
  const { locale } = useLang();
  const display = getStarDisplay(star.name, locale);
  // Engine returns '祿'/'權'/'科'/'忌'; guard against '化祿' long-form just in case
  const originMutagenChar: string | null = star.mutagen
    ? (star.mutagen.startsWith('化') ? star.mutagen.slice(1) : star.mutagen)
    : null;
  const colorClass = starColorClass(star.type ?? 'adjective', star.name, scope);
  const sizeClass = scope === 'origin' ? starSizeClass(star.name) : '';
  const isFramed = FRAMED_STARS.has(star.name);
  // Always render star-pinyin for non-tiny stars so CSS can toggle it in pinyin mode
  const renderPinyin = sizeClass !== 'star-tiny';

  return (
    <span className={`star ${colorClass} ${sizeClass}${isFramed ? ' star-framed' : ''}`}>
      <span className="star-zh">
        {locale === 'en' && display.abbr
          ? <><span className="star-full">{display.primary}</span><span className="star-abbr">{display.abbr}</span></>
          : display.primary}
      </span>
      {star.brightness && <sup className="brightness">{star.brightness}</sup>}
      {renderPinyin && <span className="star-pinyin">{display.pinyin}</span>}
      {scope === 'origin' && showOrigin && originMutagenChar && (
        <MutagenBadge char={originMutagenChar} scope="origin" />
      )}
      {scope === 'origin' && decadalMutagen && (
        <MutagenBadge char={decadalMutagen} scope="decadal" />
      )}
      {scope === 'origin' && yearlyMutagen && (
        <MutagenBadge char={yearlyMutagen} scope="yearly" />
      )}
      {scope === 'origin' && monthlyMutagen && (
        <MutagenBadge char={monthlyMutagen} scope="monthly" />
      )}
      {scope === 'origin' && dailyMutagen && (
        <MutagenBadge char={dailyMutagen} scope="daily" />
      )}
      {scope === 'origin' && minorLimitMutagen && (
        <MutagenBadge char={minorLimitMutagen} scope="minorLimit" />
      )}
      {scope === 'decadal' && originMutagenChar && (
        <MutagenBadge char={originMutagenChar} scope="decadal" />
      )}
      {scope === 'yearly' && originMutagenChar && (
        <MutagenBadge char={originMutagenChar} scope="yearly" />
      )}
      {scope === 'monthly' && originMutagenChar && (
        <MutagenBadge char={originMutagenChar} scope="monthly" />
      )}
      {scope === 'daily' && originMutagenChar && (
        <MutagenBadge char={originMutagenChar} scope="daily" />
      )}
      {scope === 'minorLimit' && originMutagenChar && (
        <MutagenBadge char={originMutagenChar} scope="minorLimit" />
      )}
    </span>
  );
}


export function PalaceCell({ palace, horoscope, isNatalMode = false, isYearlyMode = false, isMinorLimitMode = false, onMinorLimitToggle, style, isClicked, onClick, minorLimitAges = [], advLayers, advFocus }: Props) {
  const { locale, showPinyin } = useLang();
  const isZh = locale.startsWith('zh') && !showPinyin;

  // 有效 overlay 層：Advanced 模式用 advLayers（3 層視窗）；否則沿用 legacy flags
  const pro = !!advLayers;
  const showDecadalLayer = pro ? advLayers!.decadal : !isNatalMode;
  const showYearlyLayer  = pro ? advLayers!.yearly  : isYearlyMode;
  const showMonthlyLayer = pro ? advLayers!.monthly : false;
  const showDailyLayer   = pro ? advLayers!.daily   : false;
  // 生年(本命)四化：本命層在焦點視窗內才顯示（焦點為 本命/大限 時）。
  const showOriginMutagen = pro ? advLayers!.natal : true;

  const isMinorLimit = horoscope.minorLimit.palaceIndex === palace.index;
  // 命宮 highlight：Advanced 模式跟著「焦點層」走；legacy 沿用原邏輯
  const activeHighlightClass = pro
    ? (advFocus === 'daily'   ? (horoscope.daily.palaceIndex   === palace.index ? 'active-daily'   : null)
      : advFocus === 'monthly' ? (horoscope.monthly.palaceIndex === palace.index ? 'active-monthly' : null)
      : advFocus === 'yearly'  ? (horoscope.yearly.palaceIndex  === palace.index ? 'active-yearly'  : null)
      : advFocus === 'decadal' ? (horoscope.decadal.palaceIndex === palace.index ? 'active-decadal' : null)
      : null)
    : !isNatalMode && (
      isMinorLimitMode && isMinorLimit ? 'active-minor-limit'
      : isYearlyMode ? (horoscope.yearly.palaceIndex  === palace.index ? 'active-yearly'  : null)
      :                (horoscope.decadal.palaceIndex === palace.index ? 'active-decadal' : null)
    );
  const nameDisplay = getPalaceDisplay(palace.name, locale);

  const decadalOverlay = getDecadalOverlay(palace.index, horoscope.decadal.palaceIndex, locale);
  const yearlyOverlay  = getYearlyOverlay(palace.index, horoscope.yearly.palaceIndex, locale);
  const monthlyOverlay = getMonthlyOverlay(palace.index, horoscope.monthly.palaceIndex, locale);
  const dailyOverlay   = getDailyOverlay(palace.index, horoscope.daily.palaceIndex, locale);

  const decadalMutagenMap: Record<string, string> = {};
  (horoscope.decadal.mutagen ?? []).forEach((name, i) => {
    if (name) decadalMutagenMap[name] = MUTAGEN_CHARS[i];
  });
  const yearlyMutagenMap: Record<string, string> = {};
  (horoscope.yearly.mutagen ?? []).forEach((name, i) => {
    if (name) yearlyMutagenMap[name] = MUTAGEN_CHARS[i];
  });
  const minorLimitMutagenMap: Record<string, string> = {};
  (horoscope.minorLimit.mutagen ?? []).forEach((name, i) => {
    if (name) minorLimitMutagenMap[name] = MUTAGEN_CHARS[i];
  });
  const monthlyMutagenMap: Record<string, string> = {};
  (horoscope.monthly.mutagen ?? []).forEach((name, i) => {
    if (name) monthlyMutagenMap[name] = MUTAGEN_CHARS[i];
  });
  const dailyMutagenMap: Record<string, string> = {};
  (horoscope.daily.mutagen ?? []).forEach((name, i) => {
    if (name) dailyMutagenMap[name] = MUTAGEN_CHARS[i];
  });

  // Native stars split into CLAUDE.md stars vs other adjective stars
  const allMinor = [
    ...(palace.minorStars ?? []),
    ...(palace.adjectiveStars ?? []),
  ];

  const claudeMinor    = allMinor.filter(s => CLAUDE_MINOR_STARS.has(s.name));
  const otherAll       = allMinor.filter(s => !CLAUDE_MINOR_STARS.has(s.name));
  const changShengStar = otherAll.filter(s =>  CHANG_SHENG.has(s.name));
  const doctorStar     = otherAll.filter(s => s.group === 'doctor');
  const suiqianStar    = otherAll.filter(s => s.group === 'suiqian');
  const nianzhiStar    = otherAll.filter(s => s.group === 'nianzhi');
  const otherMinor     = otherAll.filter(s =>
    !CHANG_SHENG.has(s.name) && !s.group
  );

  // Decadal overlay stars (Row 3) — engine generates 限祿/限羊/限陀 directly
  const decadalStars: any[] = Array.isArray((horoscope.decadal.stars as any)[palace.index])
    ? (horoscope.decadal.stars as any)[palace.index]
    : [];

  // Yearly overlay stars (Row 3 combined with decadal) — engine generates 年祿/年羊/年陀/年鸞/年喜 directly
  const yearlyStars: StarInfo[] =
    horoscope.yearly.stars.find(g => g.palaceIndex === palace.index)?.stars ?? [];
  const minorLimitStars: StarInfo[] =
    (horoscope.minorLimit.stars ?? []).find(g => g.palaceIndex === palace.index)?.stars ?? [];
  const monthlyStars: StarInfo[] =
    horoscope.monthly.stars.find(g => g.palaceIndex === palace.index)?.stars ?? [];
  const dailyStars: StarInfo[] =
    horoscope.daily.stars.find(g => g.palaceIndex === palace.index)?.stars ?? [];

  // 小限：跟 legacy 一樣要點「限」按鈕(isMinorLimitMode)才顯示，非一直顯示。
  // Advanced 模式：toggle on 且流年在視窗內(年/月/日，advLayers.minorLimit) → 顯示為第四層。
  const showMinorLimitOverlay = pro
    ? (advLayers!.minorLimit && isMinorLimitMode)
    : (isMinorLimitMode && isYearlyMode);

  const hasOverlay = (showDecadalLayer && decadalStars.length > 0)
    || (showYearlyLayer       && yearlyStars.length     > 0)
    || (showMonthlyLayer      && monthlyStars.length     > 0)
    || (showDailyLayer        && dailyStars.length       > 0)
    || (showMinorLimitOverlay && minorLimitStars.length > 0);

  // 本命星上的各層四化 badge（依啟用層 gate）
  const originMutagenProps = (name: string) => ({
    decadalMutagen:    showDecadalLayer    ? decadalMutagenMap[name]    : undefined,
    yearlyMutagen:     showYearlyLayer     ? yearlyMutagenMap[name]     : undefined,
    monthlyMutagen:    showMonthlyLayer    ? monthlyMutagenMap[name]    : undefined,
    dailyMutagen:      showDailyLayer      ? dailyMutagenMap[name]      : undefined,
    minorLimitMutagen: showMinorLimitOverlay ? minorLimitMutagenMap[name] : undefined,
  });

  const starContentRef = useRef<HTMLDivElement>(null);
  const otherMinorRef  = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container    = starContentRef.current;
    const otherMinorEl = otherMinorRef.current;
    if (!container || !otherMinorEl || otherMinor.length === 0) return;

    const isClipped = () => {
      const stars = otherMinorEl.querySelectorAll('.star');
      if (stars.length === 0) return false;
      const cRect = container.getBoundingClientRect();
      for (let i = 0; i < stars.length; i++) {
        const sRect = (stars[i] as HTMLElement).getBoundingClientRect();
        if (sRect.bottom > cRect.bottom + 1 || sRect.right > cRect.right + 1) return true;
      }
      return false;
    };

    const adjust = () => {
      otherMinorEl.style.removeProperty('--fs-small');
      otherMinorEl.style.removeProperty('--fs-zh-small');
      if (!isClipped()) return;
      const minPx = 8;
      const starZhEl = otherMinorEl.querySelector('.star-zh') as HTMLElement | null;
      let fs = starZhEl ? parseFloat(getComputedStyle(starZhEl).fontSize) : 14;
      while (isClipped() && fs > minPx) {
        fs -= 0.5;
        otherMinorEl.style.setProperty('--fs-small', `${fs}px`);
        otherMinorEl.style.setProperty('--fs-zh-small', `${fs}px`);
      }
    };

    adjust();
    const ro = new ResizeObserver(adjust);
    ro.observe(container);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherMinor.length, claudeMinor.length, hasOverlay, locale, showPinyin, isNatalMode, isYearlyMode, showMinorLimitOverlay]);

  return (
    <div
      className={`palace-cell${activeHighlightClass ? ` ${activeHighlightClass}` : ''}${isClicked ? ' clicked-palace' : ''}`}
      style={style}
      onClick={onClick}
    >

      {/* Star content: flex:1 so it takes available space, leaving room for palace-bottom */}
      <div className="star-content" ref={starContentRef}>
        {/* Row 1: 主星 */}
        <div className="star-group">
          {orderMajorForDisplay(palace.majorStars ?? []).map((star, i) => (
            <StarChip key={i} star={star} scope="origin" showOrigin={showOriginMutagen} {...originMutagenProps(star.name)} />
          ))}
        </div>

        {/* Row 2: 輔/煞星 */}
        {claudeMinor.length > 0 && (
          <div className="star-group minor">
            {claudeMinor.map((star, i) => (
              <StarChip key={i} star={star} scope="origin" showOrigin={showOriginMutagen} {...originMutagenProps(star.name)} />
            ))}
          </div>
        )}

        {/* Row 3: 雜曜（空間不足時自動縮小字體） */}
        {otherMinor.length > 0 && (
          <div className="star-group other-minor" ref={otherMinorRef}>
            {otherMinor.map((star, i) => (
              <StarChip key={i} star={star} scope="origin" showOrigin={showOriginMutagen} {...originMutagenProps(star.name)} />
            ))}
          </div>
        )}

        {/* Row 4: 運線 overlay（雜曜之後）— Advanced 模式依 3 層視窗 gate */}
        {hasOverlay && (
          <div className="star-group overlay-combined">
            {showDecadalLayer && decadalStars.map((star: any, i: number) => (
              <StarChip key={`d${i}`} star={star} scope="decadal" />
            ))}
            {showYearlyLayer && yearlyStars.map((star, i) => (
              <StarChip key={`y${i}`} star={star} scope="yearly" />
            ))}
            {showMonthlyLayer && monthlyStars.map((star, i) => (
              <StarChip key={`m${i}`} star={star} scope="monthly" />
            ))}
            {showDailyLayer && dailyStars.map((star, i) => (
              <StarChip key={`dd${i}`} star={star} scope="daily" />
            ))}
            {showMinorLimitOverlay && minorLimitStars.map((star, i) => (
              <StarChip key={`ml${i}`} star={star} scope="minorLimit" />
            ))}
          </div>
        )}

      </div>

      {/* Bottom: 左欄=小限年紀+博士+大限年；右欄=宮名+[長生12+干支合組] */}
      <div className="palace-bottom">
        <div className="palace-blc">
          {isNatalMode && minorLimitAges.length > 0 && (
            <div className="minor-limit-ages">
              {minorLimitAges.map(a => <span key={a} className="ml-age">{a}</span>)}
            </div>
          )}
          <div className="palace-bl-row">
            <div className="palace-bl">
              {[suiqianStar[0], nianzhiStar[0], doctorStar[0]].map((star, i) => {
                if (!star) return null;
                const d = getStarDisplay(star.name, locale);
                return (
                  <span key={i} className="doctor-label">
                    <span className="star-zh">
                      {locale === 'en' && d.abbr
                        ? <><span className="star-full">{d.primary}</span><span className="star-abbr">{d.abbr}</span></>
                        : d.primary}
                    </span>
                    <span className="star-pinyin">{d.pinyin}</span>
                  </span>
                );
              })}
            </div>
            {isNatalMode && (
              <span className="palace-age palace-age-center">{palace.decadal.range[0]}-{palace.decadal.range[1]}</span>
            )}
          </div>
        </div>
        <div className="palace-br">
          <div className="name-stem">
            <div className="name-col">
              {isMinorLimit && isYearlyMode && (
                <div className="id-row minor-limit-id">
                  <span
                    className={`badge badge-minor${isMinorLimitMode ? ' badge-minor-on' : ''}`}
                    onClick={e => { e.stopPropagation(); onMinorLimitToggle?.(); }}
                    style={{ cursor: 'pointer' }}
                  >{isZh ? '限' : 'Minor'}</span>
                </div>
              )}
              {isNatalMode && (
                <span className="palace-age palace-age-top">{palace.decadal.range[0]}-{palace.decadal.range[1]}</span>
              )}
              {showDailyLayer && (
                <div className="id-row daily-id">
                  <span className="id-zh">
                    {dailyOverlay.abbr
                      ? <><span className="ov-full">{dailyOverlay.primary}</span><span className="ov-abbr">{dailyOverlay.abbr}</span></>
                      : dailyOverlay.primary}
                  </span>
                  <span className="id-en">{dailyOverlay.secondary}</span>
                </div>
              )}
              {showMonthlyLayer && (
                <div className="id-row monthly-id">
                  <span className="id-zh">
                    {monthlyOverlay.abbr
                      ? <><span className="ov-full">{monthlyOverlay.primary}</span><span className="ov-abbr">{monthlyOverlay.abbr}</span></>
                      : monthlyOverlay.primary}
                  </span>
                  <span className="id-en">{monthlyOverlay.secondary}</span>
                </div>
              )}
              {showYearlyLayer && (
                <div className="id-row yearly-id">
                  <span className="id-zh">
                    {yearlyOverlay.abbr
                      ? <><span className="ov-full">{yearlyOverlay.primary}</span><span className="ov-abbr">{yearlyOverlay.abbr}</span></>
                      : yearlyOverlay.primary}
                  </span>
                  <span className="id-en">{yearlyOverlay.secondary}</span>
                </div>
              )}
              {showDecadalLayer && (
                <div className="id-row decadal-id">
                  <span className="id-zh">
                    {decadalOverlay.abbr
                      ? <><span className="ov-full">{decadalOverlay.primary}</span><span className="ov-abbr">{decadalOverlay.abbr}</span></>
                      : decadalOverlay.primary}
                  </span>
                  <span className="id-en">{decadalOverlay.secondary}</span>
                </div>
              )}
              <div className="id-row native-id">
                <span className="id-zh">
                  {palace.isBodyPalace && isZh
                    ? <>{nameDisplay.primary[0]}<span className="shen-char">身</span></>
                    : nameDisplay.abbr
                      ? <><span className="name-full">{nameDisplay.primary}</span><span className="name-abbr">{nameDisplay.abbr}</span></>
                      : nameDisplay.primary}
                </span>
                <span className="id-en">{nameDisplay.secondary}</span>
                {palace.isBodyPalace && !isZh && (
                  <span className="badge badge-body">
                    {showPinyin ? 'Shen' : locale === 'en' ? 'Will' : '身'}
                  </span>
                )}
              </div>
            </div>
            {/* stem-cs-col: 長生12 固定在宮干正上方，兩者為同一縱向容器 */}
            <div className="stem-cs-col">
              {changShengStar.length > 0 && (
                <div className="chang-sheng-group">
                  <div className="star-group chang-sheng">
                    {changShengStar.map((star, i) => (
                      <StarChip key={i} star={star} scope="origin" />
                    ))}
                  </div>
                </div>
              )}
              <div className="stem-col">
                {palace.isBodyPalace && !isZh && (
                  <span className="badge badge-body badge-body-stem">
                    {showPinyin ? 'Shen' : locale === 'en' ? 'Will' : '身'}
                  </span>
                )}
                <span className="sb-zh">{palace.decadal.heavenlyStem}{palace.decadal.earthlyBranch}</span>
                {(() => {
                  const s = STEM_PINYIN[palace.decadal.heavenlyStem] ?? palace.decadal.heavenlyStem;
                  const b = BRANCH_PINYIN[palace.decadal.earthlyBranch] ?? palace.decadal.earthlyBranch;
                  const stemPy = s.charAt(0).toUpperCase() + s.slice(1);
                  return <>
                    <span className="sb-pinyin sb-stem">{stemPy}</span>
                    <span className="sb-pinyin sb-branch">{b}</span>
                  </>;
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
