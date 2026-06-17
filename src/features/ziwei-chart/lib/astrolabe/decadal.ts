import type { DecadalPeriod, ZiweiPalace, HeavenlyStem, EarthlyBranch, StarInfo } from '../../types/ziwei';
import { calculateRealAge } from '../../utils/age';
import { MUTAGEN_TABLE } from '../engine/constants';
import { STEMS, BRANCHES } from '../engine/native/lunarConverter';

// ── 大限星曜查表 ────────────────────────────────────────────────────────────
// 大限祿存地支（天干起，同本命）
const LU_CUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]; // 甲→寅…癸→子

// 大限天馬地支（地支起）：寅午戌→亥, 巳酉丑→申, 申子辰→寅, 亥卯未→巳
// index: 子=0…亥=11

/**
 * 計算大限 overlay 星曜（大祿、大羊、大陀、大馬）
 * 回傳 StarInfo[][] 索引為 palace.index（ccwOffset 0–11）
 */
function buildDecadalStars(
  palaces: ZiweiPalace[],
  decadalStemIdx: number,
): StarInfo[][] {
  const stars: StarInfo[][] = Array.from({ length: 12 }, () => []);

  // 用 earthlyBranch → palace.index 建立對照表
  const branchToIdx: Record<string, number> = {};
  for (const p of palaces) {
    const bi = BRANCHES.indexOf(p.earthlyBranch as typeof BRANCHES[number]);
    if (bi >= 0) branchToIdx[bi] = p.index;
  }

  const place = (branchIdx: number, star: StarInfo) => {
    const palIdx = branchToIdx[branchIdx];
    if (palIdx !== undefined) stars[palIdx].push(star);
  };

  const luCun      = LU_CUN[decadalStemIdx];
  const qingYang   = (luCun + 1) % 12;
  const tuoLuo     = (luCun - 1 + 12) % 12;

  place(luCun,    { name: '限祿', type: 'lucun',  scope: 'decadal' });
  place(qingYang, { name: '限羊', type: 'tough',  scope: 'decadal' });
  place(tuoLuo,   { name: '限陀', type: 'tough',  scope: 'decadal' });

  return stars;
}

/**
 * 計算童限（第一大限前的幼年期）
 *
 * 童限宮位：
 *   順行（陽男陰女）→ 父母宮（palace.index === 11，命宮順時針退一步）
 *   逆行（陰男陽女）→ 兄弟宮（palace.index === 1，命宮逆時針退一步）
 *
 * 判斷順逆：比較兄弟宮(index 1)和父母宮(index 11)的大限起始歲數：
 *   兄弟 < 父母 → 順行（兄弟是二限）
 *   兄弟 > 父母 → 逆行（父母是二限）
 *
 * 年齡範圍：[1, fiveElementsJu - 1]（虛歲）
 */
export function getChildhoodPeriod(palaces: ZiweiPalace[]): DecadalPeriod {
  const fiveElementsJu = Math.min(...palaces.map(p => p.decadal.range[0]));
  const sib = palaces.find(p => p.index === 1)!;  // 兄弟宮
  const par = palaces.find(p => p.index === 11)!; // 父母宮
  const isForward = sib.decadal.range[0] < par.decadal.range[0];
  const cp = isForward ? par : sib; // 順行→父母, 逆行→兄弟

  const stemIdx = STEMS.indexOf(cp.decadal.heavenlyStem as typeof STEMS[number]);
  const mutagen = stemIdx >= 0 ? MUTAGEN_TABLE[stemIdx] : [];
  const stars   = buildDecadalStars(palaces, stemIdx);

  return {
    palaceIndex:   cp.index,
    palaceName:    cp.name,
    heavenlyStem:  cp.decadal.heavenlyStem as HeavenlyStem,
    earthlyBranch: cp.decadal.earthlyBranch as EarthlyBranch,
    mutagen:       [...mutagen],
    stars,
    ageRange:      [1, fiveElementsJu - 1] as [number, number],
    realAge:       null,
    isChildhood:   true,
  };
}

/**
 * 找出當前活躍大限宮位
 *
 * 大限 range 以「年差」表示：nominalAge = queryYear - lunarBirthYear
 * 若 lunarBirthYear 未提供，退而使用 solarBirthYear（實歲差）做近似。
 * 若 nominalAge < 一限起始歲 → 回傳童限
 */
export function getCurrentDecadal(
  palaces: ZiweiPalace[],
  birthDate: string,
  queryDate: Date,
  lunarBirthYear?: number,
): DecadalPeriod {
  const birthYear      = parseInt(birthDate.split('-')[0]);
  // 大限年差：以農曆出生年為基準（與 YearlyTimeline 一致）
  const nominalAge     = lunarBirthYear !== undefined
    ? queryDate.getFullYear() - lunarBirthYear
    : queryDate.getFullYear() - birthYear; // fallback 不加 1（實歲差）
  const fiveElementsJu = Math.min(...palaces.map(p => p.decadal.range[0]));

  // 童限偵測：虛歲未到一限起點
  if (nominalAge < fiveElementsJu) {
    return { ...getChildhoodPeriod(palaces), realAge: calculateRealAge(birthDate, queryDate) };
  }

  const palace = palaces.find(p =>
    nominalAge >= p.decadal.range[0] && nominalAge <= p.decadal.range[1]
  ) ?? palaces[0];

  const stemIdx   = STEMS.indexOf(palace.decadal.heavenlyStem as typeof STEMS[number]);
  const mutagen   = stemIdx >= 0 ? MUTAGEN_TABLE[stemIdx] : [];
  const stars     = buildDecadalStars(palaces, stemIdx);

  return {
    palaceIndex:   palace.index,
    palaceName:    palace.name,
    heavenlyStem:  palace.decadal.heavenlyStem as HeavenlyStem,
    earthlyBranch: palace.decadal.earthlyBranch as EarthlyBranch,
    mutagen:       [...mutagen],
    stars,
    ageRange:      palace.decadal.range,
    realAge:       calculateRealAge(birthDate, queryDate),
  };
}

/**
 * 回傳全部 12 個大限期間（供 DecadalTimeline 使用）
 */
export function getAllDecadalPeriods(palaces: ZiweiPalace[]): DecadalPeriod[] {
  return palaces.map(p => {
    const stemIdx   = STEMS.indexOf(p.decadal.heavenlyStem as typeof STEMS[number]);
    const mutagen   = stemIdx >= 0 ? MUTAGEN_TABLE[stemIdx] : [];
    const stars     = buildDecadalStars(palaces, stemIdx);
    return {
      palaceIndex:   p.index,
      palaceName:    p.name,
      heavenlyStem:  p.decadal.heavenlyStem as HeavenlyStem,
      earthlyBranch: p.decadal.earthlyBranch as EarthlyBranch,
      mutagen:       [...mutagen],
      stars,
      ageRange:      p.decadal.range,
      realAge:       null,
    };
  });
}
