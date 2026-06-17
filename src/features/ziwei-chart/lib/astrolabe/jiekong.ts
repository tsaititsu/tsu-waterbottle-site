// 截空排法：以生年干分兩組，各從申/酉起逆時針隔兩格
// 甲乙丙丁戊組：申→午→辰→寅→子
// 己庚辛壬癸組：酉→未→巳→卯→丑
// 每個干對應一個地支（一張盤只有一個截空宮）
const JIEKONG_BRANCH: Record<string, string> = {
  '甲': '申', '乙': '午', '丙': '辰', '丁': '寅', '戊': '子',
  '己': '酉', '庚': '未', '辛': '巳', '壬': '卯', '癸': '丑',
};

export function getJiekongBranch(yearStem: string): string {
  return JIEKONG_BRANCH[yearStem] ?? '';
}
