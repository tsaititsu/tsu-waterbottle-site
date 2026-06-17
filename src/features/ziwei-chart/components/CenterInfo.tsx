import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ZiweiChart, ZiweiHoroscope } from '../lib';
import { TIME_LABELS, TIME_HOURS, BRANCH_PINYIN, lunarToArabic, stemBranchPinyin, SUPPORTED_LOCALES } from '../i18n';
import { useLang } from '../contexts/LangContext';
import { getAnonName, isRandomName } from '../lib/anonName';

const MULTI_BIRTH_LABEL = {
  'zh-TW': { 2: '同時辰第二胎 Twin 2', 3: '同時辰第三胎 Triplet 3', 4: '同時辰第四胎 Quadruplet 4' },
  'zh-CN': { 2: '同时辰第二胎 Twin 2', 3: '同时辰第三胎 Triplet 3', 4: '同时辰第四胎 Quadruplet 4' },
  'en':    { 2: 'Twin 2',              3: 'Triplet 3',              4: 'Quadruplet 4' },
} as const;

interface Props {
  chart: ZiweiChart;
  horoscope: ZiweiHoroscope;
  isNatalMode: boolean;
  onReset: () => void;
  multiBirthOrder: 2 | 3 | 4 | null;
  onPrevTime: () => void;
  onNextTime: () => void;
  isRectified: boolean;
  /** When the user is viewing 童限, selecting a boundary year makes `horoscope`
   *  recompute to the first real decade. This override keeps the label/range
   *  showing the childhood span, consistent with the timeline. */
  childhoodOverride?: [number, number];
  advMode?: boolean;
  onAdvToggle?: () => void;
  notes?: string;
  onSaveNotes?: (text: string) => void;
  chartId?: string;   // 命盤唯一 id，併入匿名代號 hash（區分同性別雙胞胎）
  alias?: string;             // 隱藏分享時的自訂外號（取代隨機代號）
  onSaveAlias?: (text: string) => void;
}

const NOTES_MAX = 1000;

// 純文字筆記中的 http(s) 網址自動轉可點連結（非 markdown，只偵測 URL）
function linkifyNotes(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} className="notes-link" href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : <span key={i}>{part}</span>
  );
}

// 陽男/陽女: 陽年出生，陰男/陰女: 陰年出生（標籤直接用年干，男女相同，不翻轉）
// dreamkinin 確認：戊戌年女=陽女(逆行), 己丑年女=陰女(順行), 己未年男=陰男(逆行)
function getYinYang(lunarYear: number): '陽' | '陰' {
  const stemIdx = ((lunarYear - 4) % 10 + 10) % 10;
  return stemIdx % 2 === 0 ? '陽' : '陰';
}

export function CenterInfo({ chart, horoscope, isNatalMode, onReset, multiBirthOrder, onPrevTime, onNextTime, isRectified, childhoodOverride, advMode, onAdvToggle, notes, onSaveNotes, chartId, alias, onSaveAlias }: Props) {
  const { locale, setLocale, showPinyin, togglePinyin } = useLang();
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [hideMode, setHideMode] = useState(false); // 隱藏個資：遮蔽姓名與生日（用戶自行截圖分享用）
  // 彩蛋：隱藏狀態下點代號 → inline 改外號（取代隨機代號；空＝回隨機）
  const [aliasEditing, setAliasEditing] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');
  const ALIAS_MAX = 16;
  function openAliasEdit() {
    if (!onSaveAlias) return;        // 暫態盤（無存檔）不可編
    setAliasDraft(alias ?? '');
    setAliasEditing(true);
  }
  function commitAlias() {
    onSaveAlias?.(aliasDraft.trim().slice(0, ALIAS_MAX));
    setAliasEditing(false);
  }
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  function openNotes() { setNotesDraft(notes ?? ''); setNotesEditing(!notes); setNotesOpen(true); }
  function saveNotes() {
    const v = notesDraft.trim().slice(0, NOTES_MAX);
    onSaveNotes?.(v);
    if (v) setNotesEditing(false); // 存完回到檢視模式
    else setNotesOpen(false);      // 清空 → 直接關閉
  }
  function cancelEdit() {
    if (notes) { setNotesDraft(notes); setNotesEditing(false); } // 有舊筆記 → 退回檢視
    else setNotesOpen(false);                                    // 無 → 關閉
  }
  const [advInfoOpen, setAdvInfoOpen] = useState(false);
  const advInfoTimer = useRef<number | null>(null);
  function showAdvInfo() {
    if (advInfoTimer.current) clearTimeout(advInfoTimer.current);
    if (advInfoOpen) { setAdvInfoOpen(false); return; } // 再點一次 → 關閉
    setAdvInfoOpen(true);
    advInfoTimer.current = window.setTimeout(() => setAdvInfoOpen(false), 2000); // 或 2 秒後自動消失
  }
  useEffect(() => () => { if (advInfoTimer.current) clearTimeout(advInfoTimer.current); }, []);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!localeMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (!localeMenuRef.current?.contains(e.target as Node)) setLocaleMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [localeMenuOpen]);
  const isEn = locale === 'en';
  const { birthInfo, fiveElementsClass } = chart;
  const timeLabel = TIME_LABELS[birthInfo.timeIndex] ?? '？';
  const timeHours = TIME_HOURS[birthInfo.timeIndex] ?? '';
  const timePinyin = BRANCH_PINYIN[timeLabel] ?? '';
  const lunarDate = lunarToArabic(birthInfo.lunarDate);
  const lunarYear = parseInt(lunarDate.split('-')[0]);
  // 農曆出生年干支（供用戶與其他來源比對）
  const YEAR_STEMS    = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const YEAR_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const yStem   = YEAR_STEMS[((lunarYear - 4) % 10 + 10) % 10];
  const yBranch = YEAR_BRANCHES[((lunarYear - 4) % 12 + 12) % 12];
  const yearGZ  = yStem + yBranch;                       // 例：乙丑
  const yinYang = getYinYang(lunarYear);
  const yinYangEn = yinYang === '陽' ? 'Yang' : 'Yin';
  const genderChar = birthInfo.gender === 'female' ? '女' : '男';
  const genderEn = birthInfo.gender === 'female' ? 'Female' : 'Male';

  const BACK_LABEL: Record<string, string> = {
    'en': '← Charts', 'zh-TW': '← 命盤', 'zh-CN': '← 命盘',
  };
  const FIVE_ELEMENTS_EN: Record<string, string> = {
    '水二局': 'Water-2', '木三局': 'Wood-3', '金四局': 'Metal-4',
    '土五局': 'Earth-5', '火六局': 'Fire-6',
  };
  const useEnLabels   = isEn || showPinyin;
  const backLabel     = useEnLabels ? BACK_LABEL['en'] : (BACK_LABEL[locale] ?? BACK_LABEL['zh-TW']);
  const solarLabel    = useEnLabels ? 'Solar'  : '陽曆';
  const lunarLabel    = useEnLabels ? 'Lunar'  : '農曆';
  // 閏月：中文模式保留「閏」，英文/拼音模式翻成 Leap（如 2009-閏4-16 → 2009-Leap 4-16）
  const lunarDisplay  = useEnLabels ? lunarDate.replace('閏', 'Leap ') : lunarDate;
  const yearGZdisplay = useEnLabels ? stemBranchPinyin(yStem, yBranch) : yearGZ;
  // 大限序數：依年齡排序，顯示 一限/二限…（與底部 timeline 一致），取代籠統「大限」
  const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  const sortedDecades = [...chart.palaces].filter(p => p.decadal?.range).sort((a, b) => a.decadal.range[0] - b.decadal.range[0]);
  const decOrdinal = sortedDecades.findIndex(p => p.index === horoscope.decadal.palaceIndex) + 1;
  const decadeLabel   = decOrdinal >= 1
    ? (useEnLabels ? `Decade ${decOrdinal}` : `${CN_NUM[decOrdinal] ?? decOrdinal}限`)
    : (useEnLabels ? 'Decade' : '大限');
  const fiveDisplay   = useEnLabels ? (FIVE_ELEMENTS_EN[fiveElementsClass] ?? fiveElementsClass) : fiveElementsClass;
  // 隱藏模式顯示的代號：若姓名本身已是隨機匿名（隨機起盤）則直接沿用，不再換一個代號
  const hiddenName    = isRandomName(birthInfo.name)
    ? birthInfo.name
    : getAnonName({ ...birthInfo, uid: chartId }, useEnLabels);

  return (
    <div className="center-info">
      <div className="center-locale-wrap" ref={localeMenuRef}>
        <button className="center-locale-btn" onClick={() => setLocaleMenuOpen(p => !p)} title="Language">🌐</button>
        {localeMenuOpen && (
          <div className="center-locale-menu">
            {SUPPORTED_LOCALES.map(l => (
              <button
                key={l.code}
                className={`center-locale-item${locale === l.code ? ' active' : ''}`}
                onClick={() => { setLocale(l.code); setLocaleMenuOpen(false); }}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className={`center-hide-btn${hideMode ? ' active' : ''}`}
        onClick={() => setHideMode(v => !v)}
        title={hideMode
          ? (useEnLabels ? 'Show personal info' : '顯示個資')
          : (useEnLabels ? 'Hide personal info' : '隱藏個資')}
      >
        {hideMode ? '🙈' : '🙉'}
      </button>
      <div className="center-name">
        {hideMode
          ? (aliasEditing
              ? <input
                  className="center-alias-input"
                  autoFocus
                  maxLength={ALIAS_MAX}
                  value={aliasDraft}
                  placeholder={hiddenName}
                  onChange={e => setAliasDraft(e.target.value)}
                  onBlur={commitAlias}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitAlias();
                    else if (e.key === 'Escape') setAliasEditing(false);
                  }}
                />
              : <span
                  onClick={openAliasEdit}
                  style={onSaveAlias ? { cursor: 'text' } : undefined}
                >
                  {alias?.trim() || hiddenName}
                </span>)
          : (birthInfo.name || (isEn ? '(Unnamed)' : '（無名稱）'))}
      </div>

      <div className="center-time-row">
        {!hideMode && <button className="btn-time-arrow" onClick={onPrevTime} title="Previous hour">◀</button>}
        <div className={`center-time-inner${isRectified ? ' rectified' : ''}`}>
          <div className="center-time">
            {hideMode ? (
              <span className="center-time-main">———</span>
            ) : (
              <>
                {/* Line 1: time label — toggles between zh / pinyin / English */}
                {isEn ? (
                  <span className="center-time-main">{timePinyin} Hour</span>
                ) : (
                  <span className="center-time-main">
                    <span className="center-time-zh">{timeLabel}時</span>
                    <span className="center-time-pinyin"> {timePinyin} Hour</span>
                  </span>
                )}
                {/* Line 2: hour range — always visible in all modes */}
                <span className="center-time-hours">{timeHours}</span>
              </>
            )}
          </div>
        </div>
        {!hideMode && <button className="btn-time-arrow" onClick={onNextTime} title="Next hour">▶</button>}
      </div>

      {isEn ? (
        <div className="center-gender">
          <span className="center-gender-en">{yinYangEn} {genderEn}</span>
        </div>
      ) : (
        <div className="center-gender">
          <span className="center-gender-zh">{yinYang}{genderChar}</span>
          <span className="center-gender-divider"> · </span>
          <span className="center-gender-en">{yinYangEn} {genderEn}</span>
        </div>
      )}

      <div className="center-five">{fiveDisplay}</div>

      <div className="center-details">
        <div className="detail-row">
          <span className="detail-label">{solarLabel}</span>
          <span>{hideMode ? '———' : birthInfo.solarDate}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{lunarLabel}</span>
          <span>{hideMode ? '———' : <><span className="lunar-gz">{yearGZdisplay}</span> {lunarDisplay}</>}</span>
        </div>
        {!isNatalMode && (childhoodOverride || horoscope.decadal.palaceIndex >= 0) && (
          <div className="detail-row">
            <span className="detail-label">
              {(childhoodOverride || horoscope.decadal.isChildhood)
                ? (useEnLabels ? 'Childhood' : '童限')
                : decadeLabel}
            </span>
            <span>{(childhoodOverride ?? horoscope.decadal.ageRange)[0]}–{(childhoodOverride ?? horoscope.decadal.ageRange)[1]}</span>
          </div>
        )}
      </div>

      {multiBirthOrder && (
        <div className="center-twin2-label">{MULTI_BIRTH_LABEL[locale][multiBirthOrder]}</div>
      )}

      <div className="center-btn-row">
        <button className="btn-reset" onClick={onReset}>{backLabel}</button>
        <button className={`lang-toggle-inline${showPinyin ? ' active' : ''}`} onClick={togglePinyin}>
          Pinyin
        </button>
        {onAdvToggle && (
          <button className={`lang-toggle-inline${advMode ? ' active' : ''}`} onClick={onAdvToggle}>
            {useEnLabels ? 'Advanced' : '進階'}
          </button>
        )}
        {onSaveNotes && (
          <button
            className={`lang-toggle-inline center-notes-btn${notes ? ' has-notes' : ''}`}
            onClick={openNotes}
          >
            {useEnLabels ? 'Notes' : '筆記'}
          </button>
        )}
      </div>

      {advMode && (
        <div className="center-adv-beta">
          <span className="adv-beta-badge">Beta</span>
          <button className="adv-info-btn" onClick={showAdvInfo} aria-label="info">ⓘ</button>
          {advInfoOpen && (
            <div className="adv-info-pop" onClick={() => setAdvInfoOpen(false)}>
              {isEn ? 'Shows 3 transit layers at a time — tap a layer to switch' : '運線一次顯示 3 層，點各層可切換'}
            </div>
          )}
        </div>
      )}

      {notesOpen && createPortal((
        <div className="notes-overlay" onClick={() => setNotesOpen(false)}>
          <div className="notes-modal" onClick={e => e.stopPropagation()}>
            <div className="notes-modal-title">
              {useEnLabels ? 'Notes' : '筆記'}
              {notesEditing && <span className="notes-count">{notesDraft.length}/{NOTES_MAX}</span>}
            </div>

            {notesEditing ? (
              <>
                <textarea
                  className="notes-textarea"
                  value={notesDraft}
                  maxLength={NOTES_MAX}
                  autoFocus
                  placeholder={useEnLabels ? 'Reading notes, key events, links…' : '解盤心得、生活事件、連結…'}
                  onChange={e => setNotesDraft(e.target.value)}
                />
                <div className="notes-modal-btns">
                  <button className="notes-btn-cancel" onClick={cancelEdit}>
                    {useEnLabels ? 'Cancel' : '取消'}
                  </button>
                  <button className="notes-btn-save" onClick={saveNotes}>
                    {useEnLabels ? 'Save' : '儲存'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="notes-view">{linkifyNotes(notes ?? '')}</div>
                <div className="notes-modal-btns">
                  <button className="notes-btn-cancel" onClick={() => setNotesOpen(false)}>
                    {useEnLabels ? 'Close' : '關閉'}
                  </button>
                  <button className="notes-btn-save" onClick={() => { setNotesDraft(notes ?? ''); setNotesEditing(true); }}>
                    {useEnLabels ? 'Edit' : '編輯'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
