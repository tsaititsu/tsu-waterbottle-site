// 隱藏個資時用的匿名代號（迷因風）。
// 依命盤「不可變的出生事實」算 hash → 從前綴 × 角色 × 標記組合穩定挑一個，
// 同一張盤每次隱藏都是同一個代號；改名不影響（用出生資料而非 name 當 key）。
// 純前端、不存檔、不影響 localStorage / Supabase。
//
// 中文 ≈ 38 萬種、英文 ≈ 9.8 萬種；偶爾重複可接受（不同盤本來就不同人）。

// ── 中文池 ────────────────────────────────────────────────────────────────
const ZH_PREFIX = [
  '蒙面', '匿名', '神秘', '無名', '佚名', '低調', '沉默', '佛系', '隨緣', '潛水',
  '路過', '迷路', '隱身', '隔壁', '微醺', '失蹤', '早起', '貪睡', '害羞', '好奇',
  '迷糊', '神隱', '悠閒', '路邊', '慵懶', '淡定', '瀟灑', '逍遙', '飄逸', '悠然',
  '雲遊', '含蓄', '內斂', '靦腆', '漫遊', '信步', '閒散', '放空', '發呆', '打盹',
  '撐傘', '提燈', '揣手', '半夢', '出神',
];

const ZH_ROLE = [
  // 人
  '俠', '鄉民', '路人', '過客', '仙人', '道友', '散人', '浪人', '萌新', '隱士', '看客', '書生',
  // 物
  '木樁', '燈籠', '葫蘆', '扇子', '茶壺', '板凳', '面具', '斗笠', '銅錢', '紙鶴', '燭台', '香爐', '酒甕', '竹簍',
  // 果
  '西瓜', '芭樂', '荔枝', '橘子', '柚子', '龍眼', '芒果', '蓮霧',
  // 動物
  '貍貓', '錦鯉', '白鶴', '烏龜', '狐狸', '麻雀', '刺蝟', '水獺',
  // 食
  '湯圓', '包子', '燒餅', '餛飩', '麻糬', '糰子',
];

const ZH_SIZE  = ['大', '中', '小'];                          // 置中・大小（真形容詞）
const ZH_GAN   = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ALPHA    = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const ZH_LABEL = [...ZH_GAN, ...ALPHA];                        // 序號（置尾，36）

// 數字採「白名單」（by construction 乾淨，不必長期維護黑名單）：
// 全部不含 4（死），且避開西方/仇恨碼(13/14/18/88)、政治(64/89)、諧音(38/74/78/87)、性暗示(69)
const NUMBERS = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 19, 20, 21, 22, 23,
                 25, 26, 27, 28, 29, 30, 33, 55, 66, 77, 99].map(String);

// ── 英文池（native，不直翻；置尾標記）──────────────────────────────────────
const EN_ADJ = [
  'Masked', 'Anonymous', 'Nameless', 'Mystery', 'Quiet', 'Silent', 'Hidden', 'Lowkey',
  'Mellow', 'Easygoing', 'Wandering', 'Passing', 'Curious', 'Sleepy', 'Drowsy', 'Carefree',
  'Roaming', 'Faceless', 'Veiled', 'Idle', 'Casual', 'Humble', 'Gentle', 'Calm',
  'Serene', 'Dreamy', 'Misty', 'Cozy',
];
const EN_NOUN = [
  'Stranger', 'Wanderer', 'Hermit', 'Sage', 'Drifter', 'Newbie', 'Onlooker', 'Rover',
  'Nomad', 'Bystander', 'Visitor', 'Pilgrim', 'Lantern', 'Teapot', 'Mask', 'Coin',
  'Bench', 'Kite', 'Compass', 'Pebble', 'Marble', 'Mirror', 'Sparrow', 'Heron',
  'Otter', 'Fox', 'Turtle', 'Crane',
];

// ── hash ──────────────────────────────────────────────────────────────────
// FNV-1a + murmur3 收尾（avalanche 混合）。djb2 對相似字串低位元叢聚、撞名嚴重，
// 改用此組合讓鄰近 key 也充分打散。穩定、無外部依賴、不依賴 Math.random。
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;                       // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;                                  // murmur3 finalizer
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

interface AnonSeed {
  solarDate: string;
  lunarDate: string;
  timeIndex: number;
  gender: string;
  uid?: string;   // 命盤唯一 id：併入 hash 讓同性別雙胞胎／重複建檔也得不同代號（缺省則退回純生辰）
}

// 版本鹽：bump 一次即「整批重洗」所有代號（仍確定性、仍穩定）。歷史：v1 初版 → v2 重洗
const ANON_SALT = 'v2';

function seedKey(s: AnonSeed): string {
  return `${ANON_SALT}|${s.solarDate}|${s.lunarDate}|${s.timeIndex}|${s.gender}|${s.uid ?? ''}`;
}

function pick<T>(arr: T[], key: string, salt: string): T {
  return arr[hashStr(key + salt) % arr.length];
}

/** 中文代號：前綴 × 角色 × 標記（2 種樣式由 hash 決定）
 *  文法：大小詞是真形容詞 → 置中（路過小水獺）；
 *        序號（甲乙/A-Z/1-99）置中讀起來不通（匿名癸鄉民）→ 一律置尾（鄉民癸） */
function anonZh(key: string): string {
  const prefix = pick(ZH_PREFIX, key, 'p');
  const role   = pick(ZH_ROLE,   key, 'r');
  if (hashStr(key + 's') % 2 === 0) {                 // 大小・置中（路過小竹簍）
    return prefix + pick(ZH_SIZE, key, 'm') + role;
  }                                                   // 序號・置尾（甲乙/A-Z/數字）
  const tail = hashStr(key + 't') % (ZH_LABEL.length + NUMBERS.length);
  const mark = tail < ZH_LABEL.length ? ZH_LABEL[tail] : NUMBERS[tail - ZH_LABEL.length];
  return prefix + role + mark;
}

/** 英文代號：Adj + Noun + 置尾標記（A-Z / 1-99） */
function anonEn(key: string): string {
  const adj  = pick(EN_ADJ,  key, 'p');
  const noun = pick(EN_NOUN, key, 'r');
  const t = hashStr(key + 't') % (ALPHA.length + NUMBERS.length); // A-Z 或安全數字
  const mark = t < ALPHA.length ? ALPHA[t] : NUMBERS[t - ALPHA.length];
  return `${adj} ${noun} ${mark}`;
}

/** 取該盤匿名代號。useEn=true（英文/拼音模式）走英文池，否則中文池。 */
export function getAnonName(seed: AnonSeed, useEn: boolean): string {
  const key = seedKey(seed);
  return useEn ? anonEn(key) : anonZh(key);
}

// 隨機起盤姓名前綴：用來標明來源，也讓隱藏模式辨識「名字本身已匿名、不需再換代號」
export const RANDOM_NAME_PREFIX = '隨機-';

/** 名字是否為隨機起盤產生（已是匿名，隱藏時無需再匿名化） */
export function isRandomName(name?: string): boolean {
  return !!name && name.startsWith(RANDOM_NAME_PREFIX);
}

/**
 * 隨機迷因代號（中文）：給「隨機起盤」當姓名用，避免產生像真名的字串。
 * 走現有確定性產生器、餵隨機 key（此處刻意用 Math.random，與 getAnonName 的確定性無關）。
 */
export function randomAnonName(): string {
  const r = () => Math.floor(Math.random() * 1e9);
  return anonZh(`rnd-${r()}-${r()}`);
}
