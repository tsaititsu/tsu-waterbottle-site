export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type MutagenType = '化祿' | '化權' | '化科' | '化忌';

export interface StarInfo {
  name: string;
  type: 'major' | 'soft' | 'tough' | 'adjective' | 'flower' | 'helper' | 'lucun' | 'tianma';
  scope: 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily';
  brightness?: string;
  mutagen?: MutagenType;
  group?: 'doctor' | 'suiqian' | 'nianzhi';
}

export interface DecadalPeriod {
  palaceIndex: number;
  palaceName: string;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  mutagen: string[];
  stars: StarInfo[][];
  ageRange: [number, number];
  realAge: number | null;
  isChildhood?: boolean;
}

export interface MinorLimitPeriod {
  palaceIndex: number;
  palaceName: string;
  nominalAge: number;
  ages: number[];
  heavenlyStem: HeavenlyStem;
  mutagen: readonly string[];
  stars: FilteredStarGroup[];
}

export interface FilteredStarGroup {
  palaceIndex: number;
  stars: StarInfo[];
}

export interface ZiweiHoroscope {
  decadal: DecadalPeriod;
  minorLimit: MinorLimitPeriod;
  yearly: {
    palaceIndex: number;
    palaceName: string;
    heavenlyStem: HeavenlyStem;
    earthlyBranch: EarthlyBranch;
    mutagen: string[];
    stars: FilteredStarGroup[];
  };
  monthly: {
    palaceIndex: number;
    palaceName: string;
    heavenlyStem: HeavenlyStem;
    earthlyBranch: EarthlyBranch;
    mutagen: string[];
    stars: FilteredStarGroup[];
  };
  daily: {
    palaceIndex: number;
    palaceName: string;
    heavenlyStem: HeavenlyStem;
    earthlyBranch: EarthlyBranch;
    mutagen: string[];
    stars: FilteredStarGroup[];
  };
}

export interface ZiweiPalace {
  index: number;
  name: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  majorStars: StarInfo[];
  minorStars: StarInfo[];
  adjectiveStars: StarInfo[];
  decadal: {
    range: [number, number];
    heavenlyStem: HeavenlyStem;
    earthlyBranch: EarthlyBranch;
  };
  ages: number[];
}

export interface ZiweiChart {
  birthInfo: {
    solarDate: string;
    lunarDate: string;
    timeIndex: number;
    gender: 'male' | 'female';
    name: string;
  };
  fiveElementsClass: string;
  palaces: ZiweiPalace[];
  horoscope: (queryDate?: Date) => ZiweiHoroscope;
}
