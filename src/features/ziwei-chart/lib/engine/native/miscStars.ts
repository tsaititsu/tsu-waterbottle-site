/**
 * Phase 4 + 4b + 4c + 4d: 雜曜（本命版）
 *
 * Phase 4（2026-05-04）：17 顆，7/7 案例完整驗證通過
 * Phase 4b（2026-05-04）：新增 16 顆 dreamkinin 獨有星曜（從 dreamkinin bundle 公式萃取）
 * Phase 4c（2026-05-05）：新增 3 顆：咸池、天德、華蓋
 * Phase 4d（2026-05-05）：新增 長生十二神（12 顆，每宮一顆，依五行局 + 年干陰陽）
 *
 * 公式來源：
 *   - dreamkinin app bundle（main.e1103a8a.chunk.js）JSON position table
 *   - 2002-05-21 命盤視覺驗證（壬午年四月初十 子時）
 *
 * ⚠️ 2026-05-04 修正：蜚廉公式全面更新（原記錄「申子辰→巳」係錯誤）
 */

import { BRANCHES, type Branch } from './lunarConverter';

export interface MiscStarPosition {
  name: string;
  branchIdx: number;  // 0=子 system
  group?: 'doctor' | 'suiqian' | 'nianzhi';
}

// ── 博士十二神（Phase 4e）────────────────────────────────────────────────────
// 博士 = 年干祿存，逆行（地支遞減）
// 驗證：庚年祿存=申(8)，博士→申 力士→未 … 全部 12 宮截圖一致（2026-05-18）
const BO_SHI_12 = ['博士','力士','青龍','小耗','將軍','奏書','蜚廉','喜神','病符','大耗','伏兵','官符'] as const;
// 年干→祿存地支（同 luckyStars.ts）
const LU_CUN_MS = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];

// ── 長生十二神（Phase 4d）────────────────────────────────────────────────────
// 12 位置名稱（index = 循環位）
const CHANG_SHENG_12 = ['長生', '沐浴', '冠帶', '臨官', '帝旺', '衰', '病', '死', '墓', '絕', '胎', '養'] as const;

// 五行局 → 長生起始地支（index 0=子 系統）
// 水二局: 申(8), 木三局: 亥(11), 金四局: 巳(5), 土五局: 申(8), 火六局: 寅(2)
// 方向：isForward = (isMale === isYangStem)，同大限方向
// 驗證（2026-05-19）：
//   陽男庚干 火六局 寅起 → 順行 ✓（case-3：命宮子=胎）
//   陰女癸干 土五局 申起 → 順行 ✓（case-2：官祿申=長生，酉=沐浴）
//   陽女庚干 火六局 寅起 → 逆行 ✓（case-4：命宮丑=沐浴）
//   陰男己干 土五局 申起 → 逆行 ✓（case-8：全盤一致）
const JU_START_BRANCH: Record<number, number> = { 2: 8, 3: 11, 4: 5, 5: 8, 6: 2 };

// ── 截空（年干起）──────────────────────────────────────────────────────────
// 年干 index: 甲=0 乙=1 丙=2 丁=3 戊=4 己=5 庚=6 辛=7 壬=8 癸=9
// 與 jiekong.ts 及 dreamkinin bundle 完全一致（學會版）：
//   甲乙丙丁戊組：申→午→辰→寅→子
//   己庚辛壬癸組：酉→未→巳→卯→丑
// ⚠️ 本實作截空公式以學會版（dreamkinin）為準。
const JIEKONG_BY_YS: number[] = [8, 6, 4, 2, 0, 9, 7, 5, 3, 1];
// 甲(0)=申(8), 乙(1)=午(6), 丙(2)=辰(4), 丁(3)=寅(2), 戊(4)=子(0),
// 己(5)=酉(9), 庚(6)=未(7), 辛(7)=巳(5), 壬(8)=卯(3), 癸(9)=丑(1)

// ── 解神（農曆月份起）──────────────────────────────────────────────────────
// 正二月→申(8), 三四月→戌(10), 五六月→子(0), 七八月→寅(2), 九十月→辰(4), 十一十二月→午(6)
const JIESHEN: number[] = [8, 10, 0, 2, 4, 6]; // index 0=正二月，5=十一十二月

// ── 孤辰 / 寡宿（年支起）──────────────────────────────────────────────────
// 孤辰：亥子丑→寅(2), 寅卯辰→巳(5), 巳午未→申(8), 申酉戌→亥(11)
const GU_CHEN: number[]  = [2, 2, 5, 5, 5, 8, 8, 8, 11, 11, 11, 2];
// 寡宿：亥子丑→戌(10), 寅卯辰→丑(1), 巳午未→辰(4), 申酉戌→未(7)
const GUA_SU: number[]   = [10, 10, 1, 1, 1, 4, 4, 4, 7, 7, 7, 10];

// ── 咸池（年支起，三合）─────────────────────────────────────────────────────
// 申子辰→酉(9), 寅午戌→卯(3), 亥卯未→子(0), 巳酉丑→午(6)
// 驗證：壬午年 yb=6(午, 寅午戌)→卯(3)，dreamkinin 2002-05-21 癸卯夫妻宮: 咸池 ✓
const XIAN_CHI: number[] = [9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0];

// ── 華蓋（年支三合庫，用陽曆年支）────────────────────────────────────────────
// 子辰申(yb%4=0)→辰(4), 丑巳酉(yb%4=1)→丑(1), 寅午戌(yb%4=2)→戌(10), 卯未亥(yb%4=3)→未(7)
// 必須用 solarYearBranchIdx（非農曆年支），正月前出生者農曆/陽曆年支差1
const HUA_GAI_TABLE = [4, 1, 10, 7];

// ── 破碎（年支起）─────────────────────────────────────────────────────────
// 申子辰→巳(5), 丑卯巳酉→... 實際每3個循環 [5, 1, 9]
const PO_SUI: number[] = [5, 1, 9, 5, 1, 9, 5, 1, 9, 5, 1, 9];

// ── 蜚廉（年支起）─────────────────────────────────────────────────────────
// 從 dreamkinin bundle 萃取完整 position table（2026-05-04 修正，原記錄完全錯誤）：
//   子(0)→申(8), 丑(1)→酉(9), 寅(2)→戌(10), 卯(3)→巳(5),
//   辰(4)→午(6), 巳(5)→未(7), 午(6)→寅(2), 未(7)→卯(3),
//   申(8)→辰(4), 酉(9)→亥(11), 戌(10)→子(0), 亥(11)→丑(1)
// 驗證：壬午年(yb=6午)→寅(2)，dreamkinin 2002-05-21 壬寅子女宮: 蜚廉 ✓
const FEI_LIAN: number[] = [8, 9, 10, 5, 6, 7, 2, 3, 4, 11, 0, 1];

// ── 天月（農曆月份起）─────────────────────────────────────────────────────
// 固定查表（index 1–12，0 不用）
const TIAN_YUE_MONTH: number[] = [
  -1, // placeholder for index 0
  10, 5, 4, 2, 7, 3, 11, 7, 2, 6, 10, 2,
];

// ── Phase 4b：16 顆 dreamkinin 獨有雜曜 ────────────────────────────────────

// 天廚（年干起，dreamkinin bundle "no":"year" key=(ys+4)%10）
// key→位置：0(庚)→寅, 1(辛)→午, 2(壬)→酉, 3(癸)→亥, 4(甲)→巳,
//           5(乙)→午, 6(丙)→子, 7(丁)→巳, 8(戊)→午, 9(己)→申
// 轉換為 ys 索引（甲=0...癸=9）：
const TIAN_CHU: number[] = [5, 6, 0, 5, 6, 8, 2, 6, 9, 11];
// 甲(0)=巳(5), 乙(1)=午(6), 丙(2)=子(0), 丁(3)=巳(5), 戊(4)=午(6),
// 己(5)=申(8), 庚(6)=寅(2), 辛(7)=午(6), 壬(8)=酉(9), 癸(9)=亥(11)
// 驗證：壬(ys=8)→酉(9)，dreamkinin 2002-05-21 己酉官祿宮: 天廚 ✓

// 天官（年干起，dreamkinin bundle "no":"year" key=(ys+4)%10）
// key→位置：0(庚)→亥, 1(辛)→酉, 2(壬)→戌, 3(癸)→午,
//           4(甲)→未, 5(乙)→辰, 6(丙)→巳, 7(丁)→寅, 8(戊)→卯, 9(己)→酉
const TIAN_GUAN: number[] = [7, 4, 5, 2, 3, 9, 11, 9, 10, 6];
// 甲(0)=未(7), 乙(1)=辰(4), 丙(2)=巳(5), 丁(3)=寅(2), 戊(4)=卯(3),
// 己(5)=酉(9), 庚(6)=亥(11), 辛(7)=酉(9), 壬(8)=戌(10), 癸(9)=午(6)
// 驗證：壬(ys=8)→戌(10)，dreamkinin 2002-05-21 庚戌僕役宮: 天官 ✓

// 天福（年干起，dreamkinin bundle "no":"year" key=(ys+4)%10）
// key→位置：0(庚)→午, 1(辛)→巳, 2(壬)→午, 3(癸)→巳,
//           4(甲)→酉, 5(乙)→申, 6(丙)→子, 7(丁)→亥, 8(戊)→卯, 9(己)→寅
const TIAN_FU2: number[] = [9, 8, 0, 11, 3, 2, 6, 5, 6, 5];
// 甲(0)=酉(9), 乙(1)=申(8), 丙(2)=子(0), 丁(3)=亥(11), 戊(4)=卯(3),
// 己(5)=寅(2), 庚(6)=午(6), 辛(7)=巳(5), 壬(8)=午(6), 癸(9)=巳(5)
// 驗證：壬(ys=8)→午(6)，dreamkinin 2002-05-21 丙午父母宮: 天福 ✓

// 陰煞（農曆月起，每月逆2）
// 1月=寅(2), 2月=子(0), 3月=戌(10), 4月=申(8), 5月=午(6), 6月=辰(4),
// 7月=寅(2), 8月=子(0), 9月=戌(10), 10月=申(8), 11月=午(6), 12月=辰(4)
const YIN_SHA: number[] = [2, 0, 10, 8, 6, 4, 2, 0, 10, 8, 6, 4]; // index 0 = 正月
// 驗證：lm=4→申(8)，dreamkinin 2002-05-21 戊申田宅宮: 陰煞 ✓

// 天巫（農曆月起，巳申寅亥循環）
// 1月=巳(5), 2月=申(8), 3月=寅(2), 4月=亥(11), 5月=巳(5), 6月=申(8), ...
const TIAN_WU: number[] = [5, 8, 2, 11, 5, 8, 2, 11, 5, 8, 2, 11]; // index 0 = 正月
// 驗證：lm=4→亥(11)，dreamkinin 2002-05-21 辛亥遷移宮: 天巫 ✓

/** 取得干支在六十甲子中的序號（0=甲子…59=癸亥） */
function getPos60(ys: number, yb: number): number {
  for (let n = 0; n < 60; n++) {
    if (n % 10 === ys && n % 12 === yb) return n;
  }
  return 0;
}

/**
 * 排布本命雜曜（Phase 4 + 4b + 4c + 4d：共 48 顆）
 *
 * @param yearStemIdx       年天干 index（0=甲…9=癸）
 * @param yearBranchIdx     年地支 index（0=子…11=亥）
 * @param lunarMonth        農曆出生月（1–12）
 * @param lunarDay          農曆出生日（1–30）
 * @param timeIndex         時辰 index（0–11；晚子時 12 由呼叫方轉為 0）
 * @param mingBranchIdx     命宮地支 index（0=子 system）
 * @param shenBranchIdx     身宮地支 index（0=子 system）
 * @param zuoFuBranchIdx    左輔地支 index（三台由此起算）
 * @param wenChangBranchIdx 文昌地支 index（恩光由此起算）
 * @param wenQuBranchIdx    文曲地支 index（天貴由此起算）
 * @param youBiBranchIdx    右弼地支 index（八座由此起算）
 * @param fiveElementsJu    五行局數（2=水, 3=木, 4=金, 5=土, 6=火）
 * @param isMale            是否為男命（影響長生12/博士12方向）
 */
export function placeMiscStars(
  yearStemIdx:         number,
  yearBranchIdx:       number,
  solarYearBranchIdx:  number,
  lunarMonth:          number,
  lunarDay:          number,
  timeIndex:         number,
  mingBranchIdx:     number,
  shenBranchIdx:     number,
  zuoFuBranchIdx:    number,
  wenChangBranchIdx: number,
  wenQuBranchIdx:    number,
  youBiBranchIdx:    number,
  fiveElementsJu:    2 | 3 | 4 | 5 | 6,
  isMale:            boolean,
): MiscStarPosition[] {
  const _ti = timeIndex % 12; // 防禦

  // ── Phase 4 原有星曜 ─────────────────────────────────────────────────────

  // 截空（年干起）
  const jieKong = JIEKONG_BY_YS[yearStemIdx];

  // 解神（農曆月起）
  const jieShen = JIESHEN[Math.ceil(lunarMonth / 2) - 1];

  // 紅鸞（年支起，卯宮起子年，逆數）
  const hongLuan = ((3 - yearBranchIdx) % 12 + 12) % 12;

  // 天喜 = 紅鸞對宮 (+6)
  const tianXi = (hongLuan + 6) % 12;

  // 孤辰 / 寡宿（年支起）
  const guChen = GU_CHEN[yearBranchIdx];
  const guaSu  = GUA_SU[yearBranchIdx];

  // 破碎（年支起）
  const poSui = PO_SUI[yearBranchIdx];

  // 三台（左輔起，順數，農曆日 +1/日；日 1 在左輔宮）
  const sanTai = (zuoFuBranchIdx + lunarDay - 1) % 12;

  // 恩光（文昌前一宮起，順數，農曆日 +1/日）
  const enGuang = (wenChangBranchIdx + lunarDay - 2 + 12) % 12;

  // 天才（命宮 + 年支）
  const tianCai = (mingBranchIdx + yearBranchIdx) % 12;

  // 天壽（身宮 + 年支）
  const tianShou = (shenBranchIdx + yearBranchIdx) % 12;

  // 天月（農曆月查表）
  const tianYue = TIAN_YUE_MONTH[lunarMonth];

  // 天傷（僕役宮 = 命宮逆7步）
  const tianShang = ((mingBranchIdx - 7) % 12 + 12) % 12;

  // 天使（疾厄宮 = 命宮逆5步）
  const tianShi = ((mingBranchIdx - 5) % 12 + 12) % 12;

  // 蜚廉（年支起，dreamkinin bundle 完整 position table，2026-05-04 修正）
  const feiLian = FEI_LIAN[yearBranchIdx];

  // 天空（年支+1）
  const tianKong = (yearBranchIdx + 1) % 12;

  // 旬空（六十甲子旬空，取兩空中序數較小者）
  const pos60   = getPos60(yearStemIdx, yearBranchIdx);
  const xunIdx  = Math.floor(pos60 / 10);
  const xunKong = 10 - xunIdx * 2;

  // 咸池（陽曆年支起，三合）
  const xianChi = XIAN_CHI[solarYearBranchIdx];

  // 華蓋（陽曆年支三合庫）
  const huaGai = HUA_GAI_TABLE[solarYearBranchIdx % 4];

  // 天德（陽曆年支起）= (solarYb + 9) % 12
  const tianDe = (solarYearBranchIdx + 9) % 12;

  // ── Phase 4b：新增 16 顆星（dreamkinin 獨有，2026-05-04）──────────────────

  // 臺輔（時支起，午宮起子時，順數）
  // dreamkinin bundle: "begin":"wu","direction":"clockwise","no":"hour"
  const taiFu = (6 + _ti) % 12;
  // 驗證：ti=0(子時)→午(6)，dreamkinin 2002-05-21 丙午父母宮: 臺輔 ✓

  // 封誥（時支起，寅宮起子時，順數）
  // dreamkinin bundle: "begin":"yin","direction":"clockwise"（順行）
  // 正確公式：(2 + ti) % 12
  // ⚠️ 原公式 (2 - ti + 12) % 12 為逆行，ti=0/6 時兩式結果相同故未被發現
  // 驗證（2026-05-19）：ti=2(寅時)→辰(4)，case-3官祿辰: 封誥 ✓, case-8夫妻辰: 封誥 ✓
  const fengGao = (2 + _ti) % 12;

  // 天刑（農曆月起，酉宮起正月，順數）
  // dreamkinin bundle: "begin":"you","direction":"clockwise","no":"month"
  const tianXing = (8 + lunarMonth) % 12;
  // 驗證：lm=4→子(0)，dreamkinin 2002-05-21 壬子疾厄宮: 天刑 ✓

  // 天姚（農曆月起，丑宮起正月，順數）
  // dreamkinin bundle: "begin":"chou","direction":"clockwise","no":"month"
  const tianYao = lunarMonth % 12; // = (1 + lm - 1) % 12 = lm % 12
  // 驗證：lm=4→辰(4)，dreamkinin 2002-05-21 甲辰兄弟宮: 天姚 ✓

  // 陰煞（農曆月起，寅宮起正月，逆數 2/月）
  // dreamkinin bundle: "no":"month", 寅子戌申午辰循環
  const yinSha = YIN_SHA[lunarMonth - 1];
  // 驗證：lm=4→申(8)，dreamkinin 2002-05-21 戊申田宅宮: 陰煞 ✓

  // 天廚（年干起）
  const tianChu = TIAN_CHU[yearStemIdx];
  // 驗證：ys=8(壬)→酉(9)，dreamkinin 2002-05-21 己酉官祿宮: 天廚 ✓

  // 天哭（年支起，午宮起子年，逆數）
  // dreamkinin bundle: "begin":"wu","direction":"counterclock","no":"zodiac"
  const tianKu = (6 - yearBranchIdx + 12) % 12;
  // 驗證：yb=6(午)→子(0)，dreamkinin 2002-05-21 壬子疾厄宮: 天哭 ✓

  // 天虛（年支起，午宮起子年，順數）
  // dreamkinin bundle: "begin":"wu","direction":"clockwise","no":"zodiac"
  const tianXu = (6 + yearBranchIdx) % 12;
  // 驗證：yb=6(午)→子(0)，dreamkinin 2002-05-21 壬子疾厄宮: 天虛 ✓

  // 天官（年干起）
  const tianGuan = TIAN_GUAN[yearStemIdx];
  // 驗證：ys=8(壬)→戌(10)，dreamkinin 2002-05-21 庚戌僕役宮: 天官 ✓

  // 天福（年干起）
  const tianFu2 = TIAN_FU2[yearStemIdx];
  // 驗證：ys=8(壬)→午(6)，dreamkinin 2002-05-21 丙午父母宮: 天福 ✓

  // 龍池（年支起，辰宮起子年，順數）
  // dreamkinin bundle: "begin":"chen","direction":"clockwise","no":"zodiac"
  const longChi = (4 + yearBranchIdx) % 12;
  // 驗證：yb=6(午)→戌(10)，dreamkinin 2002-05-21 庚戌僕役宮: 龍池 ✓

  // 鳳閣（年支起，戌宮起子年，逆數）
  // dreamkinin bundle: "begin":"xu","direction":"counterclock","no":"zodiac"
  const fengGe = (10 - yearBranchIdx + 12) % 12;
  // 驗證：yb=6(午)→辰(4)，dreamkinin 2002-05-21 甲辰兄弟宮: 鳳閣 ✓

  // 天巫（農曆月起，巳申寅亥循環）
  const tianWu = TIAN_WU[lunarMonth - 1];
  // 驗證：lm=4→亥(11)，dreamkinin 2002-05-21 辛亥遷移宮: 天巫 ✓

  // 八座（右弼起，逆數，農曆日 -1/日；日 1 在右弼宮）
  // dreamkinin bundle: "begin":"youBi","direction":"counterclock","no":"day"
  const baZuo = (youBiBranchIdx - lunarDay + 1 + 12 * 3) % 12;
  // 驗證：youBi=7(未), ld=10 → (7-10+1+36)%12=34%12=10=戌
  //        dreamkinin 2002-05-21 庚戌僕役宮: 八座 ✓

  // 天貴（文曲前一宮起，順數，農曆日 +1/日）
  // dreamkinin bundle: "begin":"wenQu","direction":"clockwise","no":"day"
  // 同恩光模式：(wenQu + ld - 2) % 12
  const tianGui = (wenQuBranchIdx + lunarDay - 2 + 12) % 12;
  // 驗證：wenQu=4(辰), ld=10 → (4+10-2)%12=0=子
  //        dreamkinin 2002-05-21 壬子疾厄宮: 天貴 ✓

  // 月德（年支起）= (yb + 5) % 12
  // 驗證：己未年(yb=7)→子(0) ✓, 庚午年(yb=6)→亥(11) ✓, 己巳年(yb=5)→戌(10) ✓
  // ⚠️ 2026-05-16 根本修正：舊 (lm-1+12)%12 基於農曆月，實應用年支
  const yueDe = (yearBranchIdx + 5) % 12;

  // ── Phase 4d：長生十二神（12 顆，每宮一顆）────────────────────────────────
  // 方向：isForward = (isMale === isYangStem)，同大限方向
  // ✅ VERIFIED 2026-05-19（6 筆）：
  //   陽男庚干→順行（case-3）、陰女癸干→順行（case-2）、
  //   陽女庚干→逆行（case-4）、陰男己干→逆行（case-8/case-5）
  const isYangStem = yearStemIdx % 2 === 0;
  const isForward  = (isMale === isYangStem);
  const changShengStart = JU_START_BRANCH[fiveElementsJu] ?? 2;
  const changSheng12: MiscStarPosition[] = CHANG_SHENG_12.map((name, i) => ({
    name,
    branchIdx: isForward
      ? (changShengStart + i) % 12
      : ((changShengStart - i) % 12 + 12) % 12,
  }));

  // ── Phase 4e：博士十二神（12顆，從年干祿存起，同長生12方向）──────────────
  // 方向：同 isForward = (isMale === isYangStem)
  // ✅ VERIFIED 2026-05-19（6 筆）：
  //   陽男庚干→順行（case-3：命宮子=將軍）、陰女癸干→順行（case-2：財帛子=博士起點）
  //   陽女庚干→逆行（case-4：全盤一致）、陰男己干→逆行（case-8/case-5：全盤一致）
  const boShiStart = LU_CUN_MS[yearStemIdx];
  const boShi12: MiscStarPosition[] = BO_SHI_12.map((name, i) => ({
    name,
    branchIdx: isForward
      ? (boShiStart + i) % 12
      : ((boShiStart - i) % 12 + 12) % 12,
    group: 'doctor' as const,
  }));

  return [
    // ── Phase 4 原有（17顆）──
    { name: '截空', branchIdx: jieKong   },
    { name: '解神', branchIdx: jieShen   },
    { name: '紅鸞', branchIdx: hongLuan  },
    { name: '天喜', branchIdx: tianXi    },
    { name: '孤辰', branchIdx: guChen    },
    { name: '寡宿', branchIdx: guaSu     },
    { name: '破碎', branchIdx: poSui     },
    { name: '三台', branchIdx: sanTai    },
    { name: '恩光', branchIdx: enGuang   },
    { name: '天才', branchIdx: tianCai   },
    { name: '天壽', branchIdx: tianShou  },
    { name: '天月', branchIdx: tianYue   },
    { name: '天傷', branchIdx: tianShang },
    { name: '天使', branchIdx: tianShi   },
    { name: '蜚廉', branchIdx: feiLian   },
    { name: '天空', branchIdx: tianKong  },
    { name: '旬空', branchIdx: xunKong   },
    // ── Phase 4b 新增（16顆）──
    { name: '臺輔', branchIdx: taiFu     },
    { name: '封誥', branchIdx: fengGao   },
    { name: '天刑', branchIdx: tianXing  },
    { name: '天姚', branchIdx: tianYao   },
    { name: '陰煞', branchIdx: yinSha    },
    { name: '天廚', branchIdx: tianChu   },
    { name: '天哭', branchIdx: tianKu    },
    { name: '天虛', branchIdx: tianXu    },
    { name: '天官', branchIdx: tianGuan  },
    { name: '天福', branchIdx: tianFu2   },
    { name: '龍池', branchIdx: longChi   },
    { name: '鳳閣', branchIdx: fengGe    },
    { name: '天巫', branchIdx: tianWu    },
    { name: '八座', branchIdx: baZuo     },
    { name: '天貴', branchIdx: tianGui   },
    { name: '月德', branchIdx: yueDe     },
    // ── Phase 4c 新增（3顆）：咸池/天德/華蓋（2026-05-05）── group: 年支/歲前
    { name: '咸池', branchIdx: xianChi, group: 'nianzhi' as const },
    { name: '天德', branchIdx: tianDe,  group: 'suiqian' as const },
    { name: '華蓋', branchIdx: huaGai,  group: 'nianzhi' as const },
    // ── Phase 4d 新增（12顆）：長生十二神（2026-05-05）──
    ...changSheng12,
    // ── Phase 4e 新增（12顆）：博士十二神（2026-05-16）──
    ...boShi12,
    // ── Phase 4f 新增（2026-05-18）：歲前十二神 + 年支十二神 ──────────────────
    // 歲前十二神（從年支順行，天德 +9 已實作於上方）
    // 序列：歲建(+0) 晦氣(+1) 喪門(+2) 貫索(+3) 官符(+4) 小耗(+5) 大耗(+6)
    //       龍德(+7) 白虎(+8) [天德(+9)] 弔客(+10) 病符(+11)
    { name: '歲建', branchIdx: solarYearBranchIdx,                group: 'suiqian' as const },
    { name: '晦氣', branchIdx: (solarYearBranchIdx +  1) % 12,   group: 'suiqian' as const },
    { name: '喪門', branchIdx: (solarYearBranchIdx +  2) % 12,   group: 'suiqian' as const },
    { name: '貫索', branchIdx: (solarYearBranchIdx +  3) % 12,   group: 'suiqian' as const },
    { name: '官符', branchIdx: (solarYearBranchIdx +  4) % 12,   group: 'suiqian' as const },
    { name: '小耗', branchIdx: (solarYearBranchIdx +  5) % 12,   group: 'suiqian' as const },
    { name: '大耗', branchIdx: (solarYearBranchIdx +  6) % 12,   group: 'suiqian' as const },
    { name: '龍德', branchIdx: (solarYearBranchIdx +  7) % 12,   group: 'suiqian' as const },
    { name: '白虎', branchIdx: (solarYearBranchIdx +  8) % 12,   group: 'suiqian' as const },
    { name: '弔客', branchIdx: (solarYearBranchIdx + 10) % 12,   group: 'suiqian' as const },
    { name: '病符', branchIdx: (solarYearBranchIdx + 11) % 12,   group: 'suiqian' as const },
    // 年支十二神：從 huaGai（三合庫）順行，非從陽曆年支
    // 序列：華蓋(+0) 劫煞(+1) ... 咸池(+5) ... 息神(+11)
    // 起點 huaGai 已於上方計算，確保 huaGai+5 == XIAN_CHI[solarYb]（三合桃花一致）
    { name: '劫煞', branchIdx: (huaGai +  1) % 12,   group: 'nianzhi' as const },
    { name: '災煞', branchIdx: (huaGai +  2) % 12,   group: 'nianzhi' as const },
    { name: '天煞', branchIdx: (huaGai +  3) % 12,   group: 'nianzhi' as const },
    { name: '指背', branchIdx: (huaGai +  4) % 12,   group: 'nianzhi' as const },
    { name: '月煞', branchIdx: (huaGai +  6) % 12,   group: 'nianzhi' as const },
    { name: '亡神', branchIdx: (huaGai +  7) % 12,   group: 'nianzhi' as const },
    { name: '將星', branchIdx: (huaGai +  8) % 12,   group: 'nianzhi' as const },
    { name: '攀鞍', branchIdx: (huaGai +  9) % 12,   group: 'nianzhi' as const },
    { name: '歲驛', branchIdx: (huaGai + 10) % 12,   group: 'nianzhi' as const },
    { name: '息神', branchIdx: (huaGai + 11) % 12,   group: 'nianzhi' as const },
  ];
}

/** 便利函式：回傳 { 星名: Branch } map */
export function miscStarsToBranchMap(
  yearStemIdx:         number,
  yearBranchIdx:       number,
  solarYearBranchIdx:  number,
  lunarMonth:          number,
  lunarDay:            number,
  timeIndex:           number,
  mingBranchIdx:       number,
  shenBranchIdx:       number,
  zuoFuBranchIdx:      number,
  wenChangBranchIdx:   number,
  wenQuBranchIdx:      number,
  youBiBranchIdx:      number,
  fiveElementsJu:      2 | 3 | 4 | 5 | 6,
  isMale:              boolean,
): Record<string, Branch> {
  return Object.fromEntries(
    placeMiscStars(
      yearStemIdx, yearBranchIdx, solarYearBranchIdx, lunarMonth, lunarDay,
      timeIndex, mingBranchIdx, shenBranchIdx,
      zuoFuBranchIdx, wenChangBranchIdx,
      wenQuBranchIdx, youBiBranchIdx,
      fiveElementsJu, isMale,
    ).map(({ name, branchIdx }) => [name, BRANCHES[branchIdx]])
  );
}
