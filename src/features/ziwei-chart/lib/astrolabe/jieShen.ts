// 解神安星訣（月解神）：正二申、三四戌、五六子、七八寅、九十辰、十一十二午
const JIESHEN_BRANCH: Record<number, string> = {
  1: '申', 2: '申',
  3: '戌', 4: '戌',
  5: '子', 6: '子',
  7: '寅', 8: '寅',
  9: '辰', 10: '辰',
  11: '午', 12: '午',
};

export function getJieShenBranch(lunarMonth: number): string {
  return JIESHEN_BRANCH[lunarMonth] ?? '';
}
