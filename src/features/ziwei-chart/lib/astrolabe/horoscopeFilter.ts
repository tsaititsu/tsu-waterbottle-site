import type { ZiweiHoroscope, ZiweiPalace, EarthlyBranch, HeavenlyStem } from '../../types/ziwei';
import { getCurrentDecadal } from './decadal';
import { getCurrentMinorLimit } from './minorLimit';
import { buildYearlyHoroscope, buildMonthlyHoroscope, buildDailyHoroscope, buildMinorLimitOverlay } from '../engine/native/horoscope';

/** 精簡宮位參考（供 horoscope.ts 使用） */
interface PalaceRef {
  index: number;
  name: string;
  earthlyBranch: string;
}

export function buildZiweiHoroscope(
  palaces: ZiweiPalace[],
  birthDate: string,
  lunarBirthYear: number,
  gender: 'male' | 'female',
  queryDate: Date = new Date(),
): ZiweiHoroscope {
  // 精簡宮位參考
  const palaceRefs: PalaceRef[] = palaces.map(p => ({
    index:         p.index,
    name:          p.name,
    earthlyBranch: p.earthlyBranch,
  }));

  // ── 流年（自主計算）──────────────────────────────────────────────────────
  const yearly = buildYearlyHoroscope(queryDate, palaceRefs);

  // ── 流月（自主計算）──────────────────────────────────────────────────────
  const monthly = buildMonthlyHoroscope(queryDate, palaceRefs);

  // ── 流日（自主計算）──────────────────────────────────────────────────────
  const daily = buildDailyHoroscope(queryDate, palaceRefs);

  // ── 大限（自主計算）──────────────────────────────────────────────────────
  const decadal = getCurrentDecadal(palaces, birthDate, queryDate, lunarBirthYear);

  // ── 小限（自主計算）──────────────────────────────────────────────────────
  const minorLimitBase = getCurrentMinorLimit(palaces, birthDate, gender, queryDate, lunarBirthYear);
  const minorLimitPalace = palaces.find(p => p.index === minorLimitBase.palaceIndex);
  const minorLimitOverlay = buildMinorLimitOverlay(
    minorLimitPalace?.heavenlyStem ?? '甲',
    palaceRefs,
  );
  const minorLimit = {
    ...minorLimitBase,
    heavenlyStem: minorLimitOverlay.heavenlyStem,
    mutagen:      minorLimitOverlay.mutagen,
    stars:        minorLimitOverlay.stars,
  };

  return {
    decadal,
    minorLimit,
    yearly: {
      palaceIndex:   yearly.palaceIndex,
      palaceName:    yearly.palaceName,
      heavenlyStem:  yearly.heavenlyStem as HeavenlyStem,
      earthlyBranch: yearly.earthlyBranch as EarthlyBranch,
      mutagen:       yearly.mutagen as string[],
      stars:         yearly.stars,
    },
    monthly: {
      palaceIndex:   monthly.palaceIndex,
      palaceName:    monthly.palaceName,
      heavenlyStem:  monthly.heavenlyStem as HeavenlyStem,
      earthlyBranch: monthly.earthlyBranch as EarthlyBranch,
      mutagen:       monthly.mutagen as string[],
      stars:         monthly.stars,
    },
    daily: {
      palaceIndex:   daily.palaceIndex,
      palaceName:    daily.palaceName,
      heavenlyStem:  daily.heavenlyStem as HeavenlyStem,
      earthlyBranch: daily.earthlyBranch as EarthlyBranch,
      mutagen:       daily.mutagen as string[],
      stars:         daily.stars,
    },
  };
}
