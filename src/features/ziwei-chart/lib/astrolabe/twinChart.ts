import type { ZiweiChart, ZiweiPalace, ZiweiHoroscope, StarInfo, HeavenlyStem } from '../../types/ziwei';
import { calculateRealAge } from '../../utils/age';
import { getChildhoodPeriod } from './decadal';

const PALACE_NAMES: string[] = [
  '命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','僕役','官祿','田宅','福德','父母',
];

// Full 四化 table (學會版本 — 庚 matches CUSTOM_MUTAGENS)
const MUTAGEN_TABLE: Record<string, [string,string,string,string]> = {
  '甲': ['廉貞','破軍','武曲','太陽'],
  '乙': ['天機','天梁','紫微','太陰'],
  '丙': ['天同','天機','文昌','廉貞'],
  '丁': ['太陰','天同','天機','巨門'],
  '戊': ['貪狼','太陰','右弼','天機'],
  '己': ['武曲','貪狼','天梁','文曲'],
  '庚': ['太陽','武曲','天同','天相'],
  '辛': ['巨門','太陽','文曲','文昌'],
  '壬': ['天梁','紫微','左輔','武曲'],
  '癸': ['破軍','巨門','太陰','貪狼'],
};

// 祿存所在地支 by heavenly stem
const LU_BRANCH: Record<string, string> = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
  '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
  '壬': '亥', '癸': '子',
};

const BRANCH_ORDER = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// Returns StarInfo[][] indexed by palace index (0-11)
function computeDecadalStars(stem: string, palaces: ZiweiPalace[]): StarInfo[][] {
  const arr: StarInfo[][] = Array.from({ length: 12 }, () => []);
  const luBranch = LU_BRANCH[stem];
  if (!luBranch) return arr;
  const luIdx = BRANCH_ORDER.indexOf(luBranch);
  const yangBranch = BRANCH_ORDER[(luIdx + 1) % 12];
  const tuoBranch  = BRANCH_ORDER[(luIdx + 11) % 12];
  for (const p of palaces) {
    if (p.earthlyBranch === luBranch)   arr[p.index].push({ name: '限祿', type: 'adjective', scope: 'origin' });
    if (p.earthlyBranch === yangBranch) arr[p.index].push({ name: '限羊', type: 'adjective', scope: 'origin' });
    if (p.earthlyBranch === tuoBranch)  arr[p.index].push({ name: '限陀', type: 'adjective', scope: 'origin' });
  }
  return arr;
}

// 大限 direction: compare CW vs CCW neighbor ranges
// 順行: CW neighbor = 二限 (step 1, range+10) < CCW neighbor (step 11, range+110) → true
// 逆行: CW neighbor = 12限 (step 11, range+110) > CCW neighbor (step 1, range+10) → false
// 注意：只比較命宮 range 是錯的（CW 鄰宮不管順逆都比命宮大），必須比較 CW vs CCW 鄰宮
function computeIsForward(original: ZiweiChart): boolean {
  const mingGong = original.palaces.find(p => p.name === '命宮');
  if (!mingGong) return true;
  const mingBranchIdx = BRANCH_ORDER.indexOf(mingGong.earthlyBranch);
  const cwBranch  = BRANCH_ORDER[(mingBranchIdx + 1) % 12];
  const ccwBranch = BRANCH_ORDER[(mingBranchIdx - 1 + 12) % 12];
  const cwPalace  = original.palaces.find(p => p.earthlyBranch === cwBranch);
  const ccwPalace = original.palaces.find(p => p.earthlyBranch === ccwBranch);
  return (cwPalace?.decadal.range[0] ?? Infinity) < (ccwPalace?.decadal.range[0] ?? 0);
}

// 各胎次以老大哪個宮為命宮
const BIRTH_ORDER_PALACE: Record<number, string> = {
  2: '遷移',
  3: '兄弟',
  4: '僕役',
};

export function createTwinChart(original: ZiweiChart, birthOrder: 2 | 3 | 4 = 2): ZiweiChart {
  // Find target palace by name — engine returns palaces in branch order, NOT palace-name order
  const targetPalaceName = BIRTH_ORDER_PALACE[birthOrder];
  const targetIdx = original.palaces.findIndex(p => p.name === targetPalaceName);
  const mingGong  = original.palaces.find(p => p.name === '命宮');

  // Rotate so that the target palace becomes new 命宮 (index 0)
  const rotated = [...original.palaces.slice(targetIdx), ...original.palaces.slice(0, targetIdx)];

  // 大限 starting age from 五行局 (same for both twins — same birth)
  const startAge = mingGong?.decadal.range[0] ?? 2;

  // Direction derived from engine's palace data (handles solar/lunar year boundary correctly)
  const isForward = computeIsForward(original);

  // Build twin palaces with new indices, names, isOriginalPalace, and decadal ranges
  const twinPalaces: ZiweiPalace[] = rotated.map((p, newIdx) => {
    // 順行：大限往 CW 方向走（branch 遞增），在 CCW-indexed rotated 中為反向 (12-newIdx)%12
    // 逆行：大限往 CCW 方向走（branch 遞減），在 CCW-indexed rotated 中為同向 newIdx
    const periodNum = isForward ? (12 - newIdx) % 12 : newIdx;
    const rangeStart = startAge + periodNum * 10;
    return {
      ...p,
      index: newIdx,
      name: PALACE_NAMES[newIdx],
      isOriginalPalace: newIdx === 0,
      decadal: {
        ...p.decadal,
        range: [rangeStart, rangeStart + 9] as [number, number],
      },
    };
  });

  function twinHoroscope(queryDate: Date = new Date()): ZiweiHoroscope {
    const origH = original.horoscope(queryDate);
    const realAge = calculateRealAge(original.birthInfo.solarDate, queryDate);
    // 大限 ranges are in 虛歲; use virtual age for active palace detection
    const virtualAge = queryDate.getFullYear() - parseInt(original.birthInfo.solarDate.split('-')[0]) + 1;

    // Re-index yearly palace via earthly branch
    const twinYearlyIdx = twinPalaces.find(
      p => p.earthlyBranch === origH.yearly.earthlyBranch
    )?.index ?? 0;

    // Re-index minor limit palace via earthly branch
    const origMinorBranch = original.palaces[origH.minorLimit.palaceIndex]?.earthlyBranch;
    const twinMinorIdx = origMinorBranch
      ? (twinPalaces.find(p => p.earthlyBranch === origMinorBranch)?.index ?? 0)
      : 0;

    // Re-index yearly stars
    const twinYearlyStars = origH.yearly.stars.map((g: { palaceIndex: number; stars: StarInfo[] }) => {
      const origBranch = original.palaces.find(p => p.index === g.palaceIndex)?.earthlyBranch;
      if (!origBranch) return g;
      const twinIdx = twinPalaces.find(p => p.earthlyBranch === origBranch)?.index;
      return twinIdx !== undefined ? { ...g, palaceIndex: twinIdx } : g;
    });

    const commonHoroscope = {
      minorLimit: {
        ...origH.minorLimit,
        palaceIndex: twinMinorIdx,
        palaceName:  PALACE_NAMES[twinMinorIdx],
      },
      yearly: { ...origH.yearly, palaceIndex: twinYearlyIdx, stars: twinYearlyStars },
      monthly: origH.monthly,
      daily: origH.daily,
    };

    // 童限：虛歲未到一限起點
    if (virtualAge < startAge) {
      const childhood = getChildhoodPeriod(twinPalaces);
      return { decadal: { ...childhood, realAge }, ...commonHoroscope };
    }

    // Find active decadal palace
    const activeP = twinPalaces.find(
      p => virtualAge >= p.decadal.range[0] && virtualAge <= p.decadal.range[1]
    );
    const palaceIdx = activeP?.index ?? -1;
    const activeStem = activeP?.heavenlyStem ?? '';

    return {
      decadal: {
        palaceIndex: palaceIdx,
        palaceName:  activeP?.name ?? '',
        heavenlyStem: activeStem as HeavenlyStem,
        earthlyBranch: activeP?.earthlyBranch ?? twinPalaces[0].earthlyBranch,
        mutagen: activeStem ? Array.from(MUTAGEN_TABLE[activeStem] ?? []) : [],
        stars: computeDecadalStars(activeStem, twinPalaces),
        ageRange: activeP?.decadal.range ?? [startAge, startAge + 9],
        realAge,
      },
      ...commonHoroscope,
    };
  }

  return {
    ...original,
    palaces: twinPalaces,
    horoscope: twinHoroscope,
  };
}
