// ─── Locale ─────────────────────────────────────────────────────────────────

export type Locale = 'zh-TW' | 'zh-CN' | 'en'

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en',    label: 'English'  },
]

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StarTranslation {
  en: string
  abbr?: string
  pinyin: string
  'zh-CN'?: string
}

// ─── Palace Names ───────────────────────────────────────────────────────────

export const PALACE_NAMES: Record<string, { en: string; pinyin: string; 'zh-CN'?: string }> = {
  '命':    { en: 'Self',         pinyin: 'Ming Gong' },
  '兄弟':  { en: 'Sibling',     pinyin: 'Xiong Di' },
  '夫妻':  { en: 'Romance',     pinyin: 'Fu Qi' },
  '子女':  { en: 'Children',    pinyin: 'Zi Nu' },
  '財帛':  { en: 'Wealth',      pinyin: 'Cai Bo',   'zh-CN': '财帛' },
  '疾厄':  { en: 'Health',      pinyin: 'Ji E' },
  '遷移':  { en: 'Reflection',  pinyin: 'Qian Yi',  'zh-CN': '迁移' },
  '僕役':  { en: 'Friends',     pinyin: 'Pu Yi',    'zh-CN': '仆役' },
  '官祿':  { en: 'Achievement', pinyin: 'Guan Lu',  'zh-CN': '官禄' },
  '田宅':  { en: 'Property',    pinyin: 'Tian Zhai' },
  '福德':  { en: 'Soul',        pinyin: 'Fu De' },
  '父母':  { en: 'Parent',      pinyin: 'Fu Mu' },
};

// ─── Stars ─────────────────────────────────────────────────────────────────

export const STAR_DICT: Record<string, StarTranslation> = {
  // 十四主星
  '紫微': { en: 'Star of Emperor',     abbr: 'Emprr',  pinyin: 'Zi Wei' },
  '天機': { en: 'Star of Calculating', abbr: 'Calc',   pinyin: 'Tian Ji',   'zh-CN': '天机' },
  '太陽': { en: 'The Sun',             abbr: 'Sun',    pinyin: 'Tai Yang',  'zh-CN': '太阳' },
  '太陰': { en: 'The Moon',            abbr: 'Moon',   pinyin: 'Tai Yin',   'zh-CN': '太阴' },
  '武曲': { en: 'Star of Finance',     abbr: 'Financ', pinyin: 'Wu Qu' },
  '天同': { en: 'Star of Innocence',   abbr: 'Innoce', pinyin: 'Tian Tong' },
  '廉貞': { en: 'Star of Confinement', abbr: 'Confin', pinyin: 'Lian Zhen', 'zh-CN': '廉贞' },
  '天梁': { en: 'Star of Blessing',    abbr: 'Bless',  pinyin: 'Tian Liang' },
  '天府': { en: 'Star of Lord',        abbr: 'Lord',   pinyin: 'Tian Fu' },
  '天相': { en: 'Star of Minister',    abbr: 'Minstr', pinyin: 'Tian Xiang' },
  '七殺': { en: 'Star of Persistence', abbr: 'Persis', pinyin: 'Qi Sha',    'zh-CN': '七杀' },
  '破軍': { en: 'Star of Passion',     abbr: 'Passn',  pinyin: 'Po Jun',    'zh-CN': '破军' },
  '貪狼': { en: 'Star of Desire',      abbr: 'Desir',  pinyin: 'Tan Lang',  'zh-CN': '贪狼' },
  '巨門': { en: 'Somber Star',         abbr: 'Somber', pinyin: 'Ju Men',    'zh-CN': '巨门' },
  // 煞星
  '陀羅': { en: 'Star of Thoughts',    abbr: 'Thots',  pinyin: 'Tuo Luo',   'zh-CN': '陀罗' },
  '擎羊': { en: 'Dagger Star',         abbr: 'Dagger', pinyin: 'Qing Yang' },
  '火星': { en: 'Fiery Star',          abbr: 'Fiery',  pinyin: 'Huo Xing' },
  '鈴星': { en: 'Wily Star',           abbr: 'Wily',   pinyin: 'Ling Xing', 'zh-CN': '铃星' },
  // 輔星
  '祿存': { en: 'Flow',                                 pinyin: 'Lu Cun',    'zh-CN': '禄存' },
  '文昌': { en: 'Intellect Star',      abbr: 'Intlct', pinyin: 'Wen Chang' },
  '文曲': { en: 'Intelligence Star',   abbr: 'Intlgn', pinyin: 'Wen Qu' },
  '天鉞': { en: 'Female Helper',       abbr: 'FHelpr', pinyin: 'Tian Yue',  'zh-CN': '天钺' },
  '天魁': { en: 'Male Helper',         abbr: 'MHelpr', pinyin: 'Tian Kui' },
  '左輔': { en: 'Left Aide',           abbr: 'L.Aide', pinyin: 'Zuo Fu',    'zh-CN': '左辅' },
  '右弼': { en: 'Right Aide',          abbr: 'R.Aide', pinyin: 'You Bi' },
  '地空': { en: 'Vanish Damage',       abbr: 'Vanish', pinyin: 'Di Kong' },
  '地劫': { en: 'Robbery Damage',      abbr: 'Robbd',  pinyin: 'Di Jie' },
  '天馬': { en: 'Sky Horse',           abbr: 'Horse',  pinyin: 'Tian Ma',   'zh-CN': '天马' },
  '紅鸞': { en: 'Romance Star',        abbr: 'Romnce', pinyin: 'Hong Luan', 'zh-CN': '红鸾' },
  '天喜': { en: 'Joy Star',            abbr: 'Joy',    pinyin: 'Tian Xi' },
  // 雜曜
  '三台': { en: 'Three Terrace',  abbr: 'ThTrrc', pinyin: 'San Tai' },
  '八座': { en: 'Eight Seats',    abbr: 'EtSeat', pinyin: 'Ba Zuo' },
  '天壽': { en: 'Longevity Star', abbr: 'Lngvty', pinyin: 'Tian Shou', 'zh-CN': '天寿' },
  '天姚': { en: 'Allure Star',    abbr: 'Allure', pinyin: 'Tian Yao' },
  '孤辰': { en: 'Lone Star',      abbr: 'Lone',   pinyin: 'Gu Chen' },
  '寡宿': { en: 'Widow Star',     abbr: 'Widow',  pinyin: 'Gua Su' },
  '天廚': { en: 'Feast Star',     abbr: 'Feast',  pinyin: 'Tian Chu',  'zh-CN': '天厨' },
  '天貴': { en: 'Noble Star',     abbr: 'Noble',  pinyin: 'Tian Gui',  'zh-CN': '天贵' },
  '天才': { en: 'Talent Star',    abbr: 'Talnt',  pinyin: 'Tian Cai' },
  '天哭': { en: 'Sorrow Star',    abbr: 'Sorrow', pinyin: 'Tian Ku' },
  '天巫': { en: 'Mystic Star',    abbr: 'Mystc',  pinyin: 'Tian Wu' },
  '天福': { en: 'Fortune Star',   abbr: 'Fortn',  pinyin: 'Tian Fu' },
  '陰煞': { en: 'Shadow Sha',     abbr: 'Shadow', pinyin: 'Yin Sha',   'zh-CN': '阴煞' },
  '封誥': { en: 'Decree Star',    abbr: 'Decre',  pinyin: 'Feng Gao',  'zh-CN': '封诰' },
  '台輔': { en: 'Pillar Star',    abbr: 'Pillar', pinyin: 'Tai Fu',    'zh-CN': '台辅' },
  '臺輔': { en: 'Pillar Star',    abbr: 'Pillar', pinyin: 'Tai Fu',    'zh-CN': '台辅' },
  '恩光': { en: 'Grace Star',     abbr: 'Grace',  pinyin: 'En Guang' },
  '天官': { en: 'Official Star',  abbr: 'Offcl',  pinyin: 'Tian Guan' },
  '天空': { en: 'Sky Void',       abbr: 'SkyVd',  pinyin: 'Tian Kong' },
  '天傷': { en: 'Injury Star',    abbr: 'Injry',  pinyin: 'Tian Shang','zh-CN': '天伤' },
  '天使': { en: 'Envoy Star',     abbr: 'Envoy',  pinyin: 'Tian Shi' },
  '破碎': { en: 'Shatter Star',   abbr: 'Shattr', pinyin: 'Po Sui' },
  '截路': { en: 'Cut Path',       abbr: 'CtPth',  pinyin: 'Jie Lu' },
  '旬空': { en: 'Cycle Void',     abbr: 'CyclVd', pinyin: 'Xun Kong' },
  '劫空': { en: 'Robbed Void',    abbr: 'RbdVd',  pinyin: 'Jie Kong' },
  '華蓋': { en: 'Canopy Star',    abbr: 'Canopy', pinyin: 'Hua Gai',   'zh-CN': '华盖' },
  '天德': { en: 'Sky Virtue',     abbr: 'SkyVtu', pinyin: 'Tian De' },
  '月德': { en: 'Moon Virtue',    abbr: 'MnVtu',  pinyin: 'Yue De' },
  '龍池': { en: 'Dragon Pool',    abbr: 'DrgnPl', pinyin: 'Long Chi',  'zh-CN': '龙池' },
  '鳳閣': { en: 'Phoenix Tower',  abbr: 'PhxTwr', pinyin: 'Feng Ge',   'zh-CN': '凤阁' },
  '蜚廉': { en: 'Rumour Star',    abbr: 'Rumour', pinyin: 'Fei Lian' },
  '天刑': { en: 'Punishment Star',abbr: 'Punsht', pinyin: 'Tian Xing' },
  '天虛': { en: 'Sky Empty',      abbr: 'SkyEmp', pinyin: 'Tian Xu',   'zh-CN': '天虚' },
  '天月': { en: 'Sky Moon',       abbr: 'SkyMn',  pinyin: 'Tian Yue' },
  '天池': { en: 'Sky Lake',       abbr: 'SkyLk',  pinyin: 'Tian Chi' },
  '咸池': { en: 'Lechery Pool',   abbr: 'Lchry',  pinyin: 'Xian Chi' },
  '截空': { en: 'Cut Void',       abbr: 'CtVoid', pinyin: 'Jie Kong' },
  // 歲前十二神
  '歲建': { en: 'Year Establish', abbr: 'YrEst',  pinyin: 'Sui Jian' },
  '晦氣': { en: 'Gloom Star',     abbr: 'Gloom',  pinyin: 'Hui Qi'   },
  '喪門': { en: 'Mourning Gate',  abbr: 'Mourn',  pinyin: 'Sang Men' },
  '貫索': { en: 'Rope Star',      abbr: 'Rope',   pinyin: 'Guan Suo' },
  '龍德': { en: 'Dragon Virtue',  abbr: 'DrgnVt', pinyin: 'Long De',  'zh-CN': '龙德' },
  '白虎': { en: 'White Tiger',    abbr: 'WhtTgr', pinyin: 'Bai Hu',   'zh-CN': '白虎' },
  '弔客': { en: 'Mourner Star',   abbr: 'Mrnr',   pinyin: 'Diao Ke'  },
  // 年支十二神
  '劫煞': { en: 'Robbery Sha',    abbr: 'RbSha',  pinyin: 'Jie Sha'  },
  '災煞': { en: 'Calamity Sha',   abbr: 'CalmSha',pinyin: 'Zai Sha'  },
  '天煞': { en: 'Sky Sha',        abbr: 'SkySha', pinyin: 'Tian Sha' },
  '指背': { en: 'Gossip Star',    abbr: 'Gossip', pinyin: 'Zhi Bei'  },
  '月煞': { en: 'Moon Sha',       abbr: 'MnSha',  pinyin: 'Yue Sha'  },
  '亡神': { en: 'Death God',      abbr: 'DthGd',  pinyin: 'Wang Shen' },
  '將星': { en: 'General Star',   abbr: 'Genrl',  pinyin: 'Jiang Xing', 'zh-CN': '将星' },
  '攀鞍': { en: 'Saddle Star',    abbr: 'Saddle', pinyin: 'Pan An'   },
  '歲驛': { en: 'Year Travel',    abbr: 'YrTrvl', pinyin: 'Sui Yi'   },
  '息神': { en: 'Rest God',       abbr: 'RestGd', pinyin: 'Xi Shen'  },
  // 長生十二神
  '長生': { en: 'Life Birth',    abbr: 'Lf­Brth', pinyin: 'Chang Sheng', 'zh-CN': '长生' },
  '沐浴': { en: 'Cleansing',     abbr: 'Clnsg',        pinyin: 'Mu Yu' },
  '冠帶': { en: 'Cap & Belt',    abbr: 'Cap­Blt',  pinyin: 'Guan Dai',    'zh-CN': '冠带' },
  '臨官': { en: 'Official Post', abbr: 'Ofc­Pst',  pinyin: 'Lin Guan',    'zh-CN': '临官' },
  '帝旺': { en: 'Peak Power',    abbr: 'Pk­Pwr',   pinyin: 'Di Wang' },
  '衰':   { en: 'Decline',       abbr: 'Declne', pinyin: 'Shuai' },
  '病':   { en: 'Sickness',      abbr: 'Sick',   pinyin: 'Bing' },
  '死':   { en: 'Death',                          pinyin: 'Si' },
  '墓':   { en: 'Tomb',                           pinyin: 'Mu' },
  '絕':   { en: 'Extinction',    abbr: 'Extnct', pinyin: 'Jue',         'zh-CN': '绝' },
  '胎':   { en: 'Embryo',                         pinyin: 'Tai' },
  '養':   { en: 'Nurturing',     abbr: 'Nurtrg', pinyin: 'Yang',        'zh-CN': '养' },
  '天牢': { en: 'Sky Prison',    abbr: 'SkyPrs', pinyin: 'Tian Lao' },
  '解神': { en: 'Relief Star',   abbr: 'Relief', pinyin: 'Jie Shen' },
  '宿存': { en: 'Lodge Star',    abbr: 'Lodge',  pinyin: 'Su Cun' },
  // 大限 overlay
  '限祿': { en: 'Dec. Flow',     abbr: 'Dec.Fl', pinyin: 'Xian Lu',   'zh-CN': '限禄' },
  '限羊': { en: 'Dec. Dagger',   abbr: 'Dec.Dg', pinyin: 'Xian Yang' },
  '限陀': { en: 'Dec. Thoughts', abbr: 'Dec.Th', pinyin: 'Xian Tuo' },
  // 流年 overlay
  '年祿': { en: 'Yr. Flow',      abbr: 'Yr.Fl',  pinyin: 'Nian Lu',   'zh-CN': '年禄' },
  '年羊': { en: 'Yr. Dagger',    abbr: 'Yr.Dg',  pinyin: 'Nian Yang' },
  '年陀': { en: 'Yr. Thoughts',  abbr: 'Yr.Th',  pinyin: 'Nian Tuo' },
  '年鸞': { en: 'Yr. Romance',   abbr: 'Yr.Rm',  pinyin: 'Nian Luan', 'zh-CN': '年鸾' },
  '年喜': { en: 'Yr. Joy',                        pinyin: 'Nian Xi' },
  '小祿': { en: 'ML. Flow',      abbr: 'ML.Fl',  pinyin: 'Xiao Lu',   'zh-CN': '小禄' },
  '小羊': { en: 'ML. Dagger',    abbr: 'ML.Dg',  pinyin: 'Xiao Yang' },
  '小陀': { en: 'ML. Thoughts',  abbr: 'ML.Th',  pinyin: 'Xiao Tuo' },
  // 流月 overlay
  '月祿': { en: 'Mo. Flow',      abbr: 'Mo.­Fl',  pinyin: 'Yue Lu',    'zh-CN': '月禄' },
  '月羊': { en: 'Mo. Dagger',    abbr: 'Mo.­Dg',  pinyin: 'Yue Yang' },
  '月陀': { en: 'Mo. Thoughts',  abbr: 'Mo.­Th',  pinyin: 'Yue Tuo' },
  // 流日 overlay
  '日祿': { en: 'Day Flow',      abbr: 'Day­Fl',  pinyin: 'Ri Lu',     'zh-CN': '日禄' },
  '日羊': { en: 'Day Dagger',    abbr: 'Day­Dg',  pinyin: 'Ri Yang' },
  '日陀': { en: 'Day Thoughts',  abbr: 'Day­Th',  pinyin: 'Ri Tuo' },
  // 博士十二神
  '博士': { en: 'Scholar',        abbr: 'Schol',  pinyin: 'Bo Shi' },
  '力士': { en: 'Strongman',      abbr: 'Strmn',  pinyin: 'Li Shi' },
  '青龍': { en: 'Green Dragon',   abbr: 'GrnDrg', pinyin: 'Qing Long',  'zh-CN': '青龙' },
  '小耗': { en: 'Minor Loss',     abbr: 'MinLss', pinyin: 'Xiao Hao' },
  '將軍': { en: 'General',        abbr: 'Genrl',  pinyin: 'Jiang Jun',  'zh-CN': '将军' },
  '奏書': { en: 'Memorial',       abbr: 'Memrl',  pinyin: 'Zou Shu',    'zh-CN': '奏书' },
  '喜神': { en: 'Joy Spirit',     abbr: 'JoySpt', pinyin: 'Xi Shen' },
  '病符': { en: 'Illness Sign',   abbr: 'IllSgn', pinyin: 'Bing Fu' },
  '大耗': { en: 'Major Loss',     abbr: 'MajLss', pinyin: 'Da Hao' },
  '伏兵': { en: 'Hidden Troops',  abbr: 'HdnTrp', pinyin: 'Fu Bing' },
  '官符': { en: 'Authority',      abbr: 'Auth',   pinyin: 'Guan Fu' },
};

// ─── Mutagen ────────────────────────────────────────────────────────────────

export const MUTAGEN_LABELS: Record<string, { zh: string; en: string }> = {
  '化祿': { zh: '祿', en: 'Lu' },
  '化權': { zh: '權', en: 'Quan' },
  '化科': { zh: '科', en: 'Ke' },
  '化忌': { zh: '忌', en: 'Ji' },
};

// ─── Palace short labels ─────────────────────────────────────────────────────

export const PALACE_SHORT    = ['命','兄','夫','子','財','疾','遷','僕','官','田','福','父'];
export const PALACE_SHORT_CN = ['命','兄','夫','子','财','疾','迁','仆','官','田','福','父'];
export const PALACE_SHORT_EN = ['Self','Sibling','Romance','Children','Wealth','Health','Reflection','Friends','Achievement','Property','Soul','Parent'];
// Abbreviated English labels for tight mobile slots (truncations of full names)
export const PALACE_ABBR_EN  = ['Self','Sibl','Rom','Chld','Wlth','Hlth','Refl','Frnd','Achv','Prop','Soul','Prnt'];

// Full palace keys in PALACE_SHORT order, used for pinyin lookup
const PALACE_SHORT_FULL = ['命','兄弟','夫妻','子女','財帛','疾厄','遷移','僕役','官祿','田宅','福德','父母'];
const PALACE_ABBR_EN_MAP: Record<string, string> = Object.fromEntries(
  PALACE_SHORT_FULL.map((k, i) => [k, PALACE_ABBR_EN[i]])
);

function getPalaceShortArray(locale: Locale): string[] {
  if (locale === 'zh-CN') return PALACE_SHORT_CN;
  if (locale === 'en')    return PALACE_SHORT_EN;
  return PALACE_SHORT;
}

function palaceShortPinyin(offset: number): string {
  const key = PALACE_SHORT_FULL[offset] ?? '';
  return formatPinyin(PALACE_NAMES[key]?.pinyin ?? '');
}

export function getDecadalOverlay(palaceIdx: number, decadalStartIdx: number, locale: Locale = 'zh-TW'): { primary: string; secondary: string; abbr?: string } {
  // 大限宮位從大限命宮起，順 CCW 排列（CCW = ccwOffset 遞增方向）
  // offset = 當前宮位距大限命宮的 CCW 步數
  const offset = (palaceIdx - decadalStartIdx + 12) % 12;
  const shortArray = getPalaceShortArray(locale);
  if (locale === 'en') return { primary: shortArray[offset], secondary: palaceShortPinyin(offset), abbr: PALACE_ABBR_EN[offset] };
  return { primary: '大' + shortArray[offset], secondary: palaceShortPinyin(offset) };
}

export function getYearlyOverlay(palaceIdx: number, yearlyStartIdx: number, locale: Locale = 'zh-TW'): { primary: string; secondary: string; abbr?: string } {
  // 流年宮位同理：CCW 方向從流年命宮起
  const offset = (palaceIdx - yearlyStartIdx + 12) % 12;
  const shortArray = getPalaceShortArray(locale);
  if (locale === 'en') return { primary: shortArray[offset], secondary: palaceShortPinyin(offset), abbr: PALACE_ABBR_EN[offset] };
  return { primary: '流' + shortArray[offset], secondary: palaceShortPinyin(offset) };
}

export function getMonthlyOverlay(palaceIdx: number, monthlyStartIdx: number, locale: Locale = 'zh-TW'): { primary: string; secondary: string; abbr?: string } {
  // 流月宮位：CCW 方向從流月命宮起，前綴「月」（月命/月財…）
  const offset = (palaceIdx - monthlyStartIdx + 12) % 12;
  const shortArray = getPalaceShortArray(locale);
  if (locale === 'en') return { primary: shortArray[offset], secondary: palaceShortPinyin(offset), abbr: PALACE_ABBR_EN[offset] };
  return { primary: '月' + shortArray[offset], secondary: palaceShortPinyin(offset) };
}

export function getDailyOverlay(palaceIdx: number, dailyStartIdx: number, locale: Locale = 'zh-TW'): { primary: string; secondary: string; abbr?: string } {
  // 流日宮位：CCW 方向從流日命宮起，前綴「日」（日命/日財…）
  const offset = (palaceIdx - dailyStartIdx + 12) % 12;
  const shortArray = getPalaceShortArray(locale);
  if (locale === 'en') return { primary: shortArray[offset], secondary: palaceShortPinyin(offset), abbr: PALACE_ABBR_EN[offset] };
  return { primary: '日' + shortArray[offset], secondary: palaceShortPinyin(offset) };
}

// ─── Stem / Branch pinyin ────────────────────────────────────────────────────

export const STEM_PINYIN: Record<string, string> = {
  '甲':'jia','乙':'yi','丙':'bing','丁':'ding','戊':'wu',
  '己':'ji','庚':'geng','辛':'xin','壬':'ren','癸':'gui',
};
export const BRANCH_PINYIN: Record<string, string> = {
  '子':'Zi','丑':'Chou','寅':'Yin','卯':'Mao','辰':'Chen',
  '巳':'Si','午':'Wu','未':'Wei','申':'Shen','酉':'You','戌':'Xu','亥':'Hai',
  '晚子':'Midnight Zi',
};

export function stemBranchPinyin(stem: string, branch: string): string {
  const s = (STEM_PINYIN[stem] ?? stem).toLowerCase();
  const b = (BRANCH_PINYIN[branch] ?? branch).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1) + '­' + b.charAt(0).toUpperCase() + b.slice(1);
}

// ─── Time / Ordinals ────────────────────────────────────────────────────────

export const TIME_LABELS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','晚子'];
export const TIME_HOURS = [
  '00:00–01:00','01:00–03:00','03:00–05:00','05:00–07:00',
  '07:00–09:00','09:00–11:00','11:00–13:00','13:00–15:00',
  '15:00–17:00','17:00–19:00','19:00–21:00','21:00–23:00',
  '23:00–00:00',
];
export const ORDINALS    = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
export const ORDINALS_EN = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th'];

/** Convert Chinese lunar date string to Arabic numerals, e.g. 一九七九年七月十九 → 1979-7-19 */
export function lunarToArabic(s: string): string {
  const digits: Record<string, string> = {
    '〇':'0','零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9',
  };
  let r = s.replace(/([〇零一二三四五六七八九]{4})年/, (_, y) =>
    [...y].map(c => digits[c] ?? c).join('') + '-'
  );
  const months = [
    ['十二月','12-'],['十一月','11-'],['十月','10-'],
    ['九月','9-'],['八月','8-'],['七月','7-'],['六月','6-'],
    ['五月','5-'],['四月','4-'],['三月','3-'],['二月','2-'],['正月','1-'],
  ];
  for (const [zh, ar] of months) r = r.replace(zh, ar);
  const days = [
    ['初十','10'],['二十','20'],['三十','30'],
    ['廿一','21'],['廿二','22'],['廿三','23'],['廿四','24'],['廿五','25'],
    ['廿六','26'],['廿七','27'],['廿八','28'],['廿九','29'],
    ['十一','11'],['十二','12'],['十三','13'],['十四','14'],['十五','15'],
    ['十六','16'],['十七','17'],['十八','18'],['十九','19'],
    ['初一','1'],['初二','2'],['初三','3'],['初四','4'],['初五','5'],
    ['初六','6'],['初七','7'],['初八','8'],['初九','9'],
  ];
  for (const [zh, ar] of days) r = r.replace(zh, ar);
  return r.replace(/日$/, '');
}

// ─── Grid Layout ────────────────────────────────────────────────────────────

export const BRANCH_GRID: Record<string, [number, number]> = {
  '巳': [0, 0], '午': [0, 1], '未': [0, 2], '申': [0, 3],
  '酉': [1, 3], '戌': [2, 3],
  '亥': [3, 3], '子': [3, 2], '丑': [3, 1], '寅': [3, 0],
  '卯': [2, 0], '辰': [1, 0],
};

export const BRANCH_ORDER = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// ─── 三方四正 ──────────────────────────────────────────────────────────────

export function getSanFangSiZheng(branch: string): string[] {
  const idx = BRANCH_ORDER.indexOf(branch);
  if (idx === -1) return [];
  return [
    BRANCH_ORDER[idx],
    BRANCH_ORDER[(idx + 6) % 12],
    BRANCH_ORDER[(idx + 4) % 12],
    BRANCH_ORDER[(idx + 8) % 12],
  ];
}

// ─── Year 干支 ───────────────────────────────────────────────────────────────

const STEMS  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES_60 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

export function yearStemBranch(year: number): string {
  const stem   = STEMS[((year - 4) % 10 + 10) % 10];
  const branch = BRANCHES_60[((year - 4) % 12 + 12) % 12];
  return stem + branch;
}

// ─── Helper functions ────────────────────────────────────────────────────────

export function getPalaceDisplay(name: string, locale: Locale = 'zh-TW'): { primary: string; secondary: string; abbr?: string } {
  const key = name.replace('宮', '');
  const entry = PALACE_NAMES[key];
  const pinyin = formatPinyin(entry?.pinyin ?? '');
  if (locale === 'en') {
    const en = entry?.en ?? key;
    return { primary: en, secondary: pinyin, abbr: PALACE_ABBR_EN_MAP[key] };
  }
  const primary = locale === 'zh-CN' ? (entry?.['zh-CN'] ?? key) : key;
  return { primary, secondary: pinyin };
}

function formatPinyin(s: string): string {
  const words = s.split(/[\s-]+/).map(w => w.toLowerCase());
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('­');
}

export function getStarDisplay(name: string, locale: Locale = 'zh-TW'): { primary: string; abbr?: string; pinyin: string } {
  const entry = STAR_DICT[name];
  const raw = entry?.pinyin ?? name;
  let primary: string;
  let abbr: string | undefined;
  if (locale === 'zh-CN') {
    primary = entry?.['zh-CN'] ?? name;
  } else if (locale === 'en') {
    primary = entry?.en ?? name;
    abbr = entry?.abbr;
  } else {
    primary = name;
  }
  return { primary, abbr, pinyin: formatPinyin(raw) };
}

export function getMutagenDisplay(mutagen: string): { zh: string; en: string } {
  return MUTAGEN_LABELS[mutagen] ?? { zh: '', en: '' };
}
