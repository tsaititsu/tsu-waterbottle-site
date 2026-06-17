import type { MinorLimitPeriod, ZiweiPalace } from '../../types/ziwei';

const BRANCH_ORDER = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

/** Return the list of 虛歲 at which 小限 lands in the palace with the given earthly branch */
export function getMinorLimitAgesForPalace(
  palaceBranch: string,
  solarDate: string,
  gender: 'male' | 'female',
): number[] {
  const startBranch = MINOR_START[birthBranch(solarDate)];
  const startIdx = BRANCH_ORDER.indexOf(startBranch);
  const pIdx     = BRANCH_ORDER.indexOf(palaceBranch);
  const isMale   = gender === 'male';
  const r = isMale
    ? ((pIdx - startIdx + 1) % 12 + 12) % 12
    : ((startIdx - pIdx + 1) % 12 + 12) % 12;
  const firstAge = r === 0 ? 12 : r;
  const ages: number[] = [];
  for (let a = firstAge; a <= 100; a += 12) ages.push(a);
  return ages;
}

// Three-harmony group → 小限 age-1 starting branch (四馬地 + clockwise 2)
// 亥卯未→丑, 申子辰→戌, 巳酉丑→未, 寅午戌→辰
const MINOR_START: Record<string, string> = {
  '亥':'丑','卯':'丑','未':'丑',
  '申':'戌','子':'戌','辰':'戌',
  '巳':'未','酉':'未','丑':'未',
  '寅':'辰','午':'辰','戌':'辰',
};

function birthBranch(solarDate: string): string {
  const year = parseInt(solarDate.split('-')[0]);
  return BRANCH_ORDER[((year - 4) % 12 + 12) % 12];
}

// Traditional 虛歲: queryYear − lunarBirthYear + 1 (must use lunar year for 正月前生人)
function nominalAge(lunarBirthYear: number, queryDate: Date): number {
  return queryDate.getFullYear() - lunarBirthYear + 1;
}

export function getCurrentMinorLimit(
  palaces: ZiweiPalace[],
  _birthDate: string,
  _gender: 'male' | 'female',
  queryDate: Date,
  lunarBirthYear: number,
): Omit<MinorLimitPeriod, 'heavenlyStem' | 'mutagen' | 'stars'> {
  const age = nominalAge(lunarBirthYear, queryDate);

  // 找 ages 陣列包含目前虛歲的宮位
  const palace = palaces.find(p => p.ages.includes(age)) ?? palaces[0];

  return {
    palaceIndex: palace.index,
    palaceName:  palace.name,
    nominalAge:  age,
    ages:        palace.ages,
  };
}
