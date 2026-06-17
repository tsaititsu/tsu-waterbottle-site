/**
 * createZiweiChart — 自主排盤引擎
 *
 * 模組分工：
 *   - 宮位結構（名/干支/大限/小限）→ nativePalaces.ts
 *   - 農曆字串 → nativePalaces.ts formatLunarDate
 *   - 星曜（主星/吉煞/雜曜）→ mainStars / luckyStars / miscStars
 *   - 流年/流月 → horoscope.ts
 *   - 大限偵測 → decadal.ts
 */

import { buildZiweiHoroscope } from './horoscopeFilter';
import { solarToLunar, BRANCHES, STEMS } from '../engine/native/lunarConverter';
import { computeMingGong } from '../engine/native/mingGong';
import { placeMainStars } from '../engine/native/mainStars';
import { placeLuckyStars } from '../engine/native/luckyStars';
import { placeMiscStars } from '../engine/native/miscStars';
import { createNativePalaces, formatLunarDate } from '../engine/native/nativePalaces';
import { MUTAGEN_TABLE } from '../engine/constants';
import type { ZiweiChart, ZiweiPalace, StarInfo, MutagenType, HeavenlyStem, EarthlyBranch } from '../../types/ziwei';

export interface ChartInput {
  solarDate: string;
  timeIndex: number;
  gender: 'male' | 'female';
  name?: string;
  fixLeap?: boolean;
}

// ── 星曜 type 對照 ──────────────────────────────────────────────────────────
const LUCKY_STAR_TYPE: Record<string, StarInfo['type']> = {
  '天魁': 'soft', '天鉞': 'soft',
  '左輔': 'soft', '右弼': 'soft',
  '文昌': 'soft', '文曲': 'soft',
  '祿存': 'lucun',
  '天馬': 'tianma',
  '擎羊': 'tough', '陀羅': 'tough',
  '地空': 'tough', '地劫': 'tough',
  '火星': 'tough', '鈴星': 'tough',
};

// 雜曜：紅鸞/天喜=flower，其餘=adjective
const FLOWER_MISC = new Set(['紅鸞', '天喜']);

export function createZiweiChart(input: ChartInput): ZiweiChart {
  const isMale = input.gender === 'male';

  // ── 晚子時處理 ─────────────────────────────────────────────────────────────
  let calcDate      = input.solarDate;
  let calcTimeIndex = input.timeIndex;
  if (input.timeIndex === 12) {
    const [y, m, d] = input.solarDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    calcDate = `${next.getFullYear()}-${next.getMonth() + 1}-${next.getDate()}`;
    calcTimeIndex = 0;
  }

  // ── 陽曆年支（Jan 1 為界，用於歲前/年支/華蓋/咸池/天德） ──────────────────────
  const [solarYear] = calcDate.split('-').map(Number);
  const solarYb = ((solarYear - 4) % 12 + 12) % 12;

  // ── Native：農曆資料 ────────────────────────────────────────────────────────
  const lunar = solarToLunar(calcDate, calcTimeIndex);
  const ys  = STEMS.indexOf(lunar.yearStem as typeof STEMS[number]);     // 年干 index 0–9
  const yb  = BRANCHES.indexOf(lunar.yearBranch as typeof BRANCHES[number]); // 年支 index 0–11
  const lm  = lunar.month;   // 農曆月 1–12
  const ld  = lunar.day;     // 農曆日 1–30

  // ── Native：命宮/身宮/五行局 ────────────────────────────────────────────────
  const mingResult     = computeMingGong(lm, calcTimeIndex, ys);
  const mingBranchIdx  = BRANCHES.indexOf(mingResult.mingGongBranch as typeof BRANCHES[number]);
  const shenBranchIdx  = BRANCHES.indexOf(mingResult.shenGongBranch as typeof BRANCHES[number]);
  const fiveElementsJu = mingResult.fiveElementsJu;

  // ── Native：宮位結構（名/干支/大限/小限） ──────────────────────────────────
  // 小限起始地支用農曆年支（yb），正月前出生者農曆年支與陽曆年支不同，必須用農曆
  const nativePalaces = createNativePalaces(
    mingBranchIdx, shenBranchIdx,
    ys, fiveElementsJu,
    isMale, yb,
  );

  // ── Native：星曜計算 ────────────────────────────────────────────────────────
  // 天馬用節氣月地支（不同於農曆月），晚子時時 calcDate 已 +1，所以節氣月已正確
  const solarTermMonthBranchIdx = BRANCHES.indexOf(lunar.solarTermMonthBranch as typeof BRANCHES[number]);
  const mainList  = placeMainStars(fiveElementsJu, ld);
  const luckyList = placeLuckyStars(ys, yb, lm, calcTimeIndex, solarTermMonthBranchIdx);

  const zuoFuIdx    = luckyList.find(s => s.name === '左輔')!.branchIdx;
  const wenChangIdx = luckyList.find(s => s.name === '文昌')!.branchIdx;
  const wenQuIdx    = luckyList.find(s => s.name === '文曲')!.branchIdx;
  const youBiIdx    = luckyList.find(s => s.name === '右弼')!.branchIdx;

  const miscList = placeMiscStars(
    ys, yb, solarYb, lm, ld, calcTimeIndex,
    mingBranchIdx, shenBranchIdx,
    zuoFuIdx, wenChangIdx, wenQuIdx, youBiIdx,
    fiveElementsJu, isMale,
  );

  // ── 生年四化標記 ────────────────────────────────────────────────────────────
  const mutagenArr = MUTAGEN_TABLE[ys];
  const MUTAGEN_KEYS: MutagenType[] = ['化祿', '化權', '化科', '化忌'];
  function getMutagen(name: string): MutagenType | undefined {
    const idx = mutagenArr.indexOf(name);
    return idx >= 0 ? MUTAGEN_KEYS[idx] : undefined;
  }

  // ── 按地支分類星曜 ──────────────────────────────────────────────────────────
  type SlotStars = { major: StarInfo[]; minor: StarInfo[]; adjective: StarInfo[] };
  const slots: SlotStars[] = Array.from({ length: 12 }, () => ({
    major: [], minor: [], adjective: [],
  }));

  for (const { name, branchIdx } of mainList) {
    const mutagen = getMutagen(name);
    slots[branchIdx].major.push({
      name, type: 'major', scope: 'origin',
      ...(mutagen && { mutagen }),
    });
  }

  for (const { name, branchIdx } of luckyList) {
    const mutagen = getMutagen(name);
    const type = LUCKY_STAR_TYPE[name] ?? 'helper';
    slots[branchIdx].minor.push({
      name, type, scope: 'origin',
      ...(mutagen && { mutagen }),
    });
  }

  for (const { name, branchIdx, group } of miscList) {
    const mutagen = getMutagen(name);
    const type: StarInfo['type'] = FLOWER_MISC.has(name) ? 'flower' : 'adjective';
    slots[branchIdx].adjective.push({
      name, type, scope: 'origin',
      ...(group   && { group }),
      ...(mutagen && { mutagen }),
    });
  }

  // ── 組裝 ZiweiPalace 陣列 ────────────────────────────────────────────────────
  const palaces: ZiweiPalace[] = nativePalaces.map(p => {
    const slot = slots[BRANCHES.indexOf(p.earthlyBranch as typeof BRANCHES[number])];
    return {
      index:            p.index,
      name:             p.name,
      isBodyPalace:     p.isBodyPalace,
      isOriginalPalace: p.isOriginalPalace,
      heavenlyStem:     p.heavenlyStem  as HeavenlyStem,
      earthlyBranch:    p.earthlyBranch as EarthlyBranch,
      majorStars:       slot.major,
      minorStars:       slot.minor,
      adjectiveStars:   slot.adjective,
      decadal: {
        range:         p.decadal.range,
        heavenlyStem:  p.decadal.heavenlyStem  as HeavenlyStem,
        earthlyBranch: p.decadal.earthlyBranch as EarthlyBranch,
      },
      ages: p.ages,
    };
  });

  // ── 農曆日期字串 ─────────────────────────────────────────────────────────────
  // 閏月十五分界法：ld≥16 時 lm 已 +1（如閏四月廿 → lm=5）
  // 顯示需還原回 absMonth：isLeap && ld>=16 → absMonth = lm-1，其餘 = lm
  const displayMonth = (lunar.isLeap && ld >= 16) ? lm - 1 : lm;
  const lunarDateStr = formatLunarDate(lunar.year, displayMonth, ld, lunar.isLeap);

  return {
    birthInfo: {
      solarDate: input.solarDate,
      lunarDate: lunarDateStr,
      timeIndex: input.timeIndex,
      gender:    input.gender,
      name:      input.name ?? '',
    },
    fiveElementsClass: mingResult.fiveElementsClass,
    palaces,
    horoscope: (queryDate?: Date) =>
      buildZiweiHoroscope(palaces, input.solarDate, lunar.year, input.gender, queryDate ?? new Date()),
  };
}
