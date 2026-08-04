import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'

export const AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY_VERSION =
  'ai-chart-d1-health-reminder-card-registry/v1' as const
export const AI_CHART_D1_HEALTH_REMINDER_SECTION_VERSION =
  'ai-chart-d1-health-reminder-section/v1' as const
export const AI_CHART_D1_HEALTH_REMINDER_INVALID =
  'ai_chart_d1_health_reminder_invalid' as const

export const AI_CHART_D1_HEALTH_REMINDER_SELECTION_POLICY =
  freezeAiChartD1Value({
    owner: 'deterministic-program',
    unknownDirection: 'fail-closed',
    modelMayChooseCard: false,
    modelMayAddSymptoms: false,
    modelRewriteAllowed: false,
    appendUnselectedCardAllowed: false,
    preserveCardOrder: true,
    preserveReminderBytes: true,
  } as const)

export const AI_CHART_D1_HEALTH_REMINDER_ERROR_REASONS =
  Object.freeze([
    'INPUT_INVALID',
    'UNKNOWN_HEALTH_DIRECTION',
    'DUPLICATE_HEALTH_DIRECTION',
    'NON_HEALTH_PALACE_DIRECTION',
  ] as const)

export type AiChartD1HealthReminderErrorReason =
  (typeof AI_CHART_D1_HEALTH_REMINDER_ERROR_REASONS)[number]

export type AiChartD1HealthReminderSource = Readonly<{
  label: string
  url: string
}>

export type AiChartD1HealthReminderCard = Readonly<{
  cardId: string
  name: string
  canonicalHealthDirections: readonly string[]
  customerReminder: string
  observableStates: readonly string[]
  generalCareThreshold: string
  urgentCare: readonly string[]
  forbiddenInferences: readonly string[]
  sources: readonly AiChartD1HealthReminderSource[]
  status: 'reviewed' | 'user-approved-wording'
}>

export type AiChartD1HealthReminderSection = Readonly<{
  contractVersion: typeof AI_CHART_D1_HEALTH_REMINDER_SECTION_VERSION
  targetPalaceId: 'palace:health'
  title: '身體保養提醒'
  purpose: string
  canonicalHealthDirections: readonly string[]
  reminderCards: readonly Readonly<{
    cardId: string
    title: string
    customerReminder: string
    urgentCare: readonly string[]
  }>[]
  safetyNotice: string
  renderingPolicy: typeof AI_CHART_D1_HEALTH_REMINDER_SELECTION_POLICY
}>

export class AiChartD1HealthReminderError extends Error {
  readonly code = AI_CHART_D1_HEALTH_REMINDER_INVALID
  declare readonly reasonCode: AiChartD1HealthReminderErrorReason

  constructor(reasonCode: AiChartD1HealthReminderErrorReason) {
    super(AI_CHART_D1_HEALTH_REMINDER_INVALID)
    this.name = 'AiChartD1HealthReminderError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const cards: readonly AiChartD1HealthReminderCard[] = [
  {
    cardId: 'H01',
    name: '腸胃與消化',
    canonicalHealthDirections: ['脾胃相關', '腸胃與消化相關'],
    customerReminder:
      '腸胃與消化較需要保養。生活中可以留意是否常在吃東西後腹脹、腹痛、噁心，或便秘、腹瀉反覆出現；這些狀態不一定代表疾病，但若改變飲食與作息後仍持續、突然明顯惡化，或已影響日常，建議由醫師判斷原因。這是保養提醒，不是疾病診斷。',
    observableStates: [
      '腹脹、腹部不舒服或反覆腹痛。',
      '排便變得比平常更稀、更急，或便秘、排便困難。',
      '吃東西後容易噁心、食欲改變。',
    ],
    generalCareThreshold:
      '症狀反覆、持續數日仍未改善、突然改變，或影響進食與生活時，接受家醫科或腸胃科評估。',
    urgentCare: [
      '黑便或明顯血便、持續劇烈腹痛、頻繁嘔吐、無法排氣排便、發燒合併明顯腹痛，應儘速就醫。',
    ],
    forbiddenInferences: [
      '不得只因紫微、天府或天梁就宣稱有腸躁症、胃潰瘍或其他腸胃疾病。',
      '不得把偶爾一次腹瀉或便秘寫成疾病證據。',
    ],
    sources: [
      {
        label: 'NIDDK：Diarrhea—Symptoms & Causes',
        url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/diarrhea/symptoms-causes',
      },
      {
        label: 'NIDDK：Constipation—Symptoms & Causes',
        url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/constipation/symptoms-causes',
      },
      {
        label: 'NIDDK：Gas in the Digestive Tract',
        url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/gas-digestive-tract/symptoms-causes',
      },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H02',
    name: '肝臟與作息',
    canonicalHealthDirections: ['肝臟相關'],
    customerReminder:
      '肝臟方向較需要保養，可以先從規律作息、避免長期熬夜與避免過量飲酒做起。肝臟問題早期可能沒有明顯感覺；若持續容易疲倦、食欲明顯變差、噁心、右上腹不舒服，或出現眼白／皮膚變黃、尿色明顯變深，應接受醫師與抽血檢查。這是保養提醒，不是肝病診斷。',
    observableStates: [
      '持續疲倦、食欲降低、噁心或右上腹不舒服。',
      '眼白或皮膚變黃、尿色明顯變深。',
    ],
    generalCareThreshold:
      '疲倦、食欲或腹部不適持續數週，或有肝病風險因素時，與家醫科或肝膽腸胃科討論是否需要肝功能等檢查。',
    urgentCare: ['眼白或皮膚突然變黃、意識混亂、吐血或黑便，應儘速就醫。'],
    forbiddenInferences: [
      '不得把「容易熬夜」寫成肝病症狀；它只能是可調整的生活習慣。',
      '不得只因天機或貪狼就宣稱已有肝炎、脂肪肝或肝硬化。',
    ],
    sources: [
      { label: 'NHS：Liver disease', url: 'https://www.nhs.uk/conditions/liver-disease/' },
      { label: 'NHS：Hepatitis', url: 'https://www.nhs.uk/conditions/hepatitis/' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H03',
    name: '心臟與心血管',
    canonicalHealthDirections: ['心臟與心血管相關'],
    customerReminder:
      '心臟與心血管較需要保養。平時可留意活動量不大卻容易喘、胸口反覆出現壓迫或不舒服、突然心跳很快或不規則、頭暈等狀態；若反覆出現，應交由醫師評估。若胸口壓迫合併呼吸困難、冒冷汗、噁心，或疼痛延伸到手臂、背部、肩膀或下顎，應立即就醫。這是保養提醒，不是心臟病診斷。',
    observableStates: [
      '輕微活動就明顯喘或不尋常疲倦。',
      '反覆胸悶、胸口壓迫、心跳過快或不規則、頭暈。',
    ],
    generalCareThreshold:
      '反覆胸悶、活動耐受力下降、心悸或頭暈時，接受家醫科或心臟科評估。',
    urgentCare: [
      '新出現或持續的胸痛／壓迫、呼吸困難、冒冷汗、昏厥，或不適延伸到手臂、背部、肩頸或下顎時，立即呼叫緊急醫療協助。',
    ],
    forbiddenInferences: [
      '不得把偶發心跳快、焦慮或疲倦直接診斷成心臟病。',
      '不得因太陽星就預告心肌梗塞或心血管事件。',
    ],
    sources: [
      {
        label: 'NHLBI：Heart Attack Symptoms',
        url: 'https://www.nhlbi.nih.gov/health/heart-attack/symptoms',
      },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H04',
    name: '血液與持續異常',
    canonicalHealthDirections: ['血液相關'],
    customerReminder:
      '血液與持續不明異常較需要留意。生活中若長期容易疲倦、虛弱、頭暈、臉色較蒼白，或出現原因不明的容易瘀青／出血、反覆發燒、夜間大量出汗、不明腫塊或體重明顯改變，應讓醫師依實際情況檢查。這些狀態有很多可能原因；這是保養提醒，不是疾病診斷，不能由命盤判定病名。',
    observableStates: [
      '持續疲倦、虛弱、頭暈、臉色蒼白或活動容易喘。',
      '原因不明的出血、容易瘀青、反覆發燒或夜間大量出汗。',
      '持續不退的腫塊、傷口不癒合，或未刻意減重卻明顯變瘦。',
    ],
    generalCareThreshold:
      '症狀持續數週、反覆發作或逐漸加重時，接受醫師評估；是否需要血液、影像或其他檢查由醫師決定。',
    urgentCare: ['大量或無法止住的出血、昏厥、嚴重呼吸困難等情況應立即就醫。'],
    forbiddenInferences: [
      '不得輸出「廉貞代表癌症」「有家族遺傳癌症」等診斷或風險斷言。',
      '不得把疲倦、瘀青或體重變化單獨當成癌症證據。',
      '不得建議客人因命盤自行接受特定侵入性檢查。',
    ],
    sources: [
      { label: 'NHLBI：Anemia Symptoms', url: 'https://www.nhlbi.nih.gov/health/anemia/symptoms' },
      { label: 'NCI：Symptoms of Cancer', url: 'https://www.cancer.gov/about-cancer/diagnosis-staging/symptoms' },
      { label: 'NCI：How Cancer Is Diagnosed', url: 'https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H05',
    name: '肺部與呼吸',
    canonicalHealthDirections: ['肺部與呼吸相關'],
    customerReminder:
      '肺部與呼吸較需要保養。生活中可留意持續咳嗽、痰變多、呼吸有喘鳴聲、活動時比以前更容易喘，或胸口常有緊繃感；這些狀態若反覆或愈來愈明顯，應接受醫師評估。這是保養提醒，不是肺部疾病診斷。',
    observableStates: [
      '持續咳嗽、痰量增加或呼吸時有喘鳴聲。',
      '活動時呼吸比以前費力、容易喘或胸口緊。',
    ],
    generalCareThreshold:
      '咳嗽、喘、胸悶反覆或逐漸惡化，或已降低活動能力時，接受家醫科或胸腔科評估。',
    urgentCare: [
      '嚴重喘到無法完整說話、嘴唇或指甲發青／發灰、意識變差、咳血或突然胸痛，應立即就醫。',
    ],
    forbiddenInferences: [
      '不得只因武曲或七殺就診斷肺病。',
      '不得把肺部方向和巨門的支氣管方向混成同一個固定病名。',
    ],
    sources: [
      { label: 'NHLBI：COPD Symptoms', url: 'https://www.nhlbi.nih.gov/health/copd/symptoms' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H06',
    name: '支氣管與過敏',
    canonicalHealthDirections: ['支氣管與過敏相關'],
    customerReminder:
      '支氣管與呼吸道較需要保養。可以留意是否常在夜間或清晨咳嗽、呼吸有喘鳴聲、胸口緊，或遇到冷空氣、運動、灰塵與過敏原時特別明顯；若反覆發作、影響睡眠或活動，應由醫師判斷是否需要肺功能或過敏評估。這是保養提醒，不是氣喘或過敏診斷。',
    observableStates: [
      '夜間或清晨反覆咳嗽。',
      '喘鳴、胸悶、呼吸急促，且可能隨冷空氣、運動或過敏原加重。',
    ],
    generalCareThreshold:
      '反覆咳嗽、喘鳴、胸悶，或症狀打斷睡眠與活動時，接受家醫科、胸腔科或過敏免疫科評估。',
    urgentCare: [
      '呼吸困難快速惡化、無法說完整句子、嘴唇發青／發灰或意識異常時，立即就醫。',
    ],
    forbiddenInferences: [
      '不得只因巨門或巨門遇煞就宣稱命主有氣喘或特定過敏。',
      '不得保存或編造過敏原。',
    ],
    sources: [
      { label: 'NHLBI：Asthma Symptoms', url: 'https://www.nhlbi.nih.gov/health/asthma/symptoms' },
      { label: 'NHLBI：COPD Symptoms', url: 'https://www.nhlbi.nih.gov/health/copd/symptoms' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H07',
    name: '腎臟與泌尿',
    canonicalHealthDirections: ['腎臟相關', '泌尿相關'],
    customerReminder:
      '腎臟相關較需要保養。腎臟問題早期常常沒有明顯感覺；生活中若持續出現容易疲倦、沒精神、肌肉抽筋、眼皮或腳踝浮腫、泡泡尿久久不散，或尿液呈紅色、茶色，建議接受專業抽血與驗尿檢查。這是保養提醒，不是疾病診斷，有問題仍要由醫師判斷。',
    observableStates: [
      '持續疲倦、沒精神或肌肉抽筋。',
      '眼皮、腳踝或小腿浮腫。',
      '泡泡尿久久不散，或尿液呈粉紅、紅色、茶色／可樂色。',
      '排尿頻率或尿量出現明顯改變。',
    ],
    generalCareThreshold:
      '上述狀態持續、反覆或令人擔心時，接受家醫科或腎臟科評估；血液與尿液檢查通常比只看症狀可靠。',
    urgentCare: [
      '尿量明顯驟減、嚴重水腫、呼吸困難、明顯血尿，或全身無力合併深色尿時，儘速就醫。',
    ],
    forbiddenInferences: [
      '不得由星曜直接診斷腎臟病。',
      '不得聲稱沒有腰痛或尿量正常就代表腎臟沒有問題。',
      '茶色尿也可能有肝膽、血液或肌肉等其他原因，不得自行決定病因。',
    ],
    sources: [
      {
        label: 'NIDDK：What Is Chronic Kidney Disease in Adults?',
        url: 'https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/what-is-chronic-kidney-disease',
      },
      {
        label: 'NIDDK：Glomerular Disease',
        url: 'https://www.niddk.nih.gov/health-information/kidney-disease/glomerular-disease',
      },
      {
        label: 'CDC：Signs and Symptoms of Rhabdomyolysis',
        url: 'https://www.cdc.gov/niosh/rhabdo/signs-symptoms/index.html',
      },
    ],
    status: 'user-approved-wording',
  },
  {
    cardId: 'H08',
    name: '眼睛與視力',
    canonicalHealthDirections: ['眼睛與視力相關'],
    customerReminder:
      '眼睛與視力較需要保養。生活中可以留意視線是否持續模糊、眼睛反覆紅腫疼痛、明明戴著眼鏡仍難以對焦，或突然出現大量飛蚊、閃光與像窗簾遮住視野的黑影；前面的反覆狀態可安排眼科檢查，後面的突然變化應立即就醫。這是保養提醒，不是眼疾診斷。',
    observableStates: [
      '持續視線模糊、難以對焦、眼睛紅腫或疼痛。',
      '新出現且不消失的飛蚊、閃光或視野缺損。',
    ],
    generalCareThreshold:
      '視力改變、眼睛反覆紅腫疼痛，或戴眼鏡仍無法看清楚時，安排眼科檢查；部分眼疾早期沒有明顯症狀。',
    urgentCare: [
      '突然大量飛蚊伴隨閃光、視野出現黑影／窗簾感、突然視力下降，或劇烈眼痛伴隨紅眼與視線模糊時，立即就醫。',
    ],
    forbiddenInferences: [
      '不得以星曜判斷確切眼別、病名或失明風險。',
      '不得把近視、白內障或眼睛受傷寫成必然事件。',
    ],
    sources: [
      {
        label: 'National Eye Institute：Finding an Eye Doctor',
        url: 'https://www.nei.nih.gov/eye-health-information/healthy-vision/finding-eye-doctor',
      },
      {
        label: 'National Eye Institute：Floaters',
        url: 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/floaters',
      },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H09',
    name: '口腔與牙齒',
    canonicalHealthDirections: ['口腔與牙齒相關'],
    customerReminder:
      '口腔與牙齒較需要保養。可留意刷牙或吃硬食物時牙齦是否常出血、牙齦反覆紅腫疼痛、口臭、牙齒鬆動，或口腔潰瘍與紅白斑久久不退；若持續或反覆，應由牙醫檢查。這是保養提醒，不是牙周病或口腔疾病診斷。',
    observableStates: [
      '刷牙、使用牙線或吃硬食物時牙齦反覆出血。',
      '牙齦紅腫疼痛、口臭、牙齒鬆動。',
      '口腔潰瘍、紅白斑或口腔腫塊持續不退。',
    ],
    generalCareThreshold:
      '牙齦反覆出血、疼痛腫脹、口臭或口腔病灶持續時，安排牙科檢查；平時也應定期檢查。',
    urgentCare: ['臉部／口腔快速腫大、吞嚥或呼吸困難、大量出血，應儘速就醫。'],
    forbiddenInferences: [
      '不得因巨門或天同直接宣稱牙齒一定不好。',
      '不得把下顎外貌當成牙病診斷依據。',
    ],
    sources: [
      { label: 'NHS：Gum disease', url: 'https://www.nhs.uk/conditions/gum-disease/' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H10',
    name: '耳朵與聽力',
    canonicalHealthDirections: ['耳朵與聽力相關'],
    customerReminder:
      '耳朵與聽力較需要保養。生活中可留意是否常需要別人重複說話、耳鳴持續干擾睡眠或專注、耳內有悶塞感，或伴隨眩暈與平衡不穩；若反覆或影響日常，應安排耳鼻喉科或聽力檢查。突然單側聽力下降屬於需要儘快處理的情況。這是保養提醒，不是聽力疾病診斷。',
    observableStates: [
      '聽話變得吃力、常請別人重複，或需要把音量開得更大。',
      '耳鳴、耳悶、眩暈或平衡不穩反覆出現。',
    ],
    generalCareThreshold:
      '耳鳴、聽力改變、眩暈持續或影響生活時，接受耳鼻喉科或聽力專業評估。',
    urgentCare: [
      '單側或雙側聽力突然在短時間內明顯下降，尤其伴隨耳悶、耳鳴或眩暈時，儘快就醫。',
    ],
    forbiddenInferences: [
      '不得因天同星直接宣稱耳聾、梅尼爾氏症或其他病名。',
      '不得把所有耳鳴都解釋成嚴重疾病。',
    ],
    sources: [
      { label: 'NIDCD：Sudden Deafness', url: 'https://www.nidcd.nih.gov/health/sudden-deafness' },
      { label: 'NIDCD：Tinnitus', url: 'https://www.nidcd.nih.gov/health/tinnitus' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H11',
    name: '骨骼與脊椎',
    canonicalHealthDirections: ['骨骼與脊椎相關'],
    customerReminder:
      '骨骼與脊椎較需要保養。生活中可留意背部或關節疼痛是否反覆、久坐久站後僵硬、彎腰或搬重物時加重，或疼痛延伸到臀部、腿部並伴隨麻木無力；若持續幾週、影響行走或睡眠，應接受醫師或復健專業評估。這是保養提醒，不是脊椎疾病診斷。',
    observableStates: [
      '背痛、僵硬，或搬重物、彎腰、久坐久站時加重。',
      '疼痛延伸到臀部、腿或髖部，伴隨麻木或無力。',
      '關節活動範圍明顯變差。',
    ],
    generalCareThreshold:
      '疼痛超過幾週未改善、反覆發作、影響睡眠／行走，或在跌倒受傷後出現時，接受醫師評估。',
    urgentCare: [
      '背痛合併排尿困難、腿部明顯無力／麻木、發燒，或骨頭／關節明顯變形時，儘速就醫。',
    ],
    forbiddenInferences: [
      '不得因星曜直接診斷椎間盤突出、骨質疏鬆或骨折。',
      '不得把武曲「骨架健壯」改寫成不需要保養或不會受傷。',
    ],
    sources: [
      { label: 'NIAMS：Back Pain', url: 'https://www.niams.nih.gov/health-topics/back-pain' },
      { label: 'NIAMS：Sports Injuries', url: 'https://www.niams.nih.gov/health-topics/sports-injuries' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H12',
    name: '肌肉筋脈與四肢',
    canonicalHealthDirections: ['肌肉筋脈與四肢相關'],
    customerReminder:
      '肌肉筋脈與四肢較需要保養。生活中可留意肌肉抽筋、痠痛是否超出平常活動量、四肢反覆無力，或運動與工作後疼痛、腫脹久久不退；若狀態反覆、明顯限制活動，應接受醫師或復健專業評估。這是保養提醒，不是肌肉或神經疾病診斷。',
    observableStates: [
      '肌肉抽筋、痠痛或無力，比預期活動量更嚴重。',
      '四肢疼痛、腫脹、活動受限或無法正常承重。',
      '反覆動作後持續痠痛，休息時仍有悶痛或腫脹。',
    ],
    generalCareThreshold:
      '疼痛、抽筋或無力反覆、持續不退，或明顯影響工作與運動時，接受專業評估。',
    urgentCare: [
      '四肢突然嚴重無力、明顯變形、無法承重，或劇烈肌肉疼痛合併茶色／可樂色尿時，儘速就醫。',
    ],
    forbiddenInferences: [
      '不得由天機、貪狼或煞星直接預告哪一隻手腳會受傷。',
      '不得把一般運動後痠痛診斷為肌肉損傷或橫紋肌溶解症。',
    ],
    sources: [
      { label: 'NIAMS：Sports Injuries', url: 'https://www.niams.nih.gov/health-topics/sports-injuries' },
      {
        label: 'CDC：Signs and Symptoms of Rhabdomyolysis',
        url: 'https://www.cdc.gov/niosh/rhabdo/signs-symptoms/index.html',
      },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H13',
    name: '頭部與神經急症',
    canonicalHealthDirections: ['頭部與神經急症相關'],
    customerReminder:
      '頭部與神經方向較需要留意。若平時頭痛反覆或逐漸加重，可記錄頻率與伴隨狀態後交由醫師評估；若突然單側臉、手或腳無力／麻木、說話不清、看不清楚、走路失去平衡，或突然出現前所未有的劇烈頭痛，應立即就醫。頭部撞擊後若頭痛加重、反覆嘔吐、嗜睡叫不醒或行為異常，也不能等待。這是安全提醒，不是疾病診斷，也不是命盤預告中風或事故。',
    observableStates: [
      '頭痛反覆、頻率或程度逐漸改變。',
      '頭部撞擊後出現頭痛、暈眩、噁心、注意力或睡眠改變。',
    ],
    generalCareThreshold:
      '反覆頭痛、影響日常，或頭部受傷後症狀持續時，接受醫師評估。',
    urgentCare: [
      '突然單側無力／麻木、臉歪、說話不清、視力改變、失去平衡或突發劇烈頭痛。',
      '頭部受傷後頭痛愈來愈重、反覆嘔吐、抽搐、意識混亂、嗜睡叫不醒或瞳孔大小不同。',
    ],
    forbiddenInferences: [
      '不得用星曜預測中風、腦傷、車禍或重大災難。',
      '不得因症狀短暫消失就建議不用就醫。',
    ],
    sources: [
      { label: 'CDC：Signs and Symptoms of Stroke', url: 'https://www.cdc.gov/stroke/signs-symptoms/index.html' },
      {
        label: 'CDC：Symptoms of Mild TBI and Concussion',
        url: 'https://www.cdc.gov/traumatic-brain-injury/signs-symptoms/index.html',
      },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H14',
    name: '皮膚',
    canonicalHealthDirections: ['皮膚相關'],
    customerReminder:
      '皮膚較需要保養。可以留意皮疹是否快速擴散、反覆發癢或疼痛、起水泡、變成破皮傷口，或原有痣與斑點是否持續改變、發癢或出血；反覆或持續不退時，應由皮膚科判斷。這是保養提醒，不是皮膚病或皮膚癌診斷。',
    observableStates: [
      '皮疹反覆、快速擴散、疼痛、起水泡或形成傷口。',
      '痣或皮膚斑點與其他部位明顯不同，持續變化、發癢或出血。',
      '傷口長時間不癒合。',
    ],
    generalCareThreshold:
      '皮疹反覆或持續、影響睡眠，或痣／斑點持續變化時，安排皮膚科檢查。',
    urgentCare: [
      '皮疹遍及大範圍、快速擴散、伴隨發燒、形成大片水泡／破皮，或影響眼、口、唇與生殖器；若合併呼吸或吞嚥困難，立即就醫。',
    ],
    forbiddenInferences: [
      '不得用命盤判定痣、胎記或皮膚癌。',
      '不得建議自行割除痣或使用未經醫師評估的療法。',
    ],
    sources: [
      { label: 'American Academy of Dermatology：Rash 101', url: 'https://www.aad.org/public/everyday-care/itchy-skin/rash/rash-101' },
      { label: 'American Academy of Dermatology：When is a mole a problem?', url: 'https://www.aad.org/public/diseases/a-z/when-is-a-mole-a-problem' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H15',
    name: '內分泌與代謝',
    canonicalHealthDirections: ['內分泌與代謝相關'],
    customerReminder:
      '內分泌與代謝較需要保養。生活中若持續特別口渴、排尿明顯增加、容易疲倦、視線模糊，或沒有刻意控制卻體重明顯改變，建議由醫師評估是否需要血糖、甲狀腺或其他檢查。這些狀態可能有很多原因；這是保養提醒，不是糖尿病或內分泌疾病診斷。',
    observableStates: [
      '持續口渴、頻尿、疲倦。',
      '視線模糊、體重無明確原因改變。',
      '傷口或感染反覆、恢復較慢。',
    ],
    generalCareThreshold:
      '上述狀態持續或同時出現多項時，與家醫科或新陳代謝科討論抽血檢查。',
    urgentCare: [
      '無固定單一項目；若出現意識改變、嚴重虛弱、持續嘔吐等急性狀態，應立即就醫。',
    ],
    forbiddenInferences: [
      '不得由天相、天同或巨門直接宣稱糖尿病、甲狀腺疾病或荷爾蒙失調。',
      '不得以單一症狀自行選定要檢查的疾病。',
    ],
    sources: [
      { label: 'NIDDK：Symptoms & Causes of Diabetes', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview/symptoms-causes' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H16',
    name: '淋巴與不明腫塊',
    canonicalHealthDirections: ['淋巴相關'],
    customerReminder:
      '淋巴方向較需要保養。感冒或感染時頸部、腋下等處短暫腫痛很常見；但若腫塊一週以上仍未縮小、持續變大、摸起來很硬或固定不動，或同時有反覆發燒、夜間大量出汗、體重不明下降，應讓醫師檢查。這是保養提醒，不是淋巴疾病或癌症診斷。',
    observableStates: [
      '頸部、下顎、腋下或鼠蹊部出現可觸及腫塊。',
      '腫塊數週不退、變大、偏硬或固定。',
      '腫塊伴隨發燒、夜間大量出汗或不明體重下降。',
    ],
    generalCareThreshold:
      '腫塊一週以上仍未縮小、持續變大、紅痛，或伴隨全身症狀時，接受醫師評估。',
    urgentCare: ['腫脹快速加劇並影響呼吸或吞嚥時，立即就醫。'],
    forbiddenInferences: [
      '不得因天相就宣稱淋巴結腫大或淋巴癌。',
      '不得把講義中已排除的「頸部」器官對應重新加回；這張卡提到頸部只是現實中淋巴結可能被摸到的位置。',
    ],
    sources: [
      { label: 'NHS：Swollen glands', url: 'https://www.nhs.uk/symptoms/swollen-glands/' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H17',
    name: '循環與單側腫痛',
    canonicalHealthDirections: ['循環相關'],
    customerReminder:
      '循環方向較需要保養。平時可留意腳部或小腿是否反覆腫脹、疼痛，尤其是只有單側、摸起來明顯壓痛；若突然出現單側腿部腫痛，或同時有呼吸急促、深呼吸時胸痛、心跳很快、暈眩或昏倒，不能只當成疲勞，應立即就醫。這是安全提醒，不是血栓或循環疾病診斷。',
    observableStates: [
      '單側小腿或腿部腫脹、壓痛、疼痛。',
      '活動時異常喘、暈眩或胸口不舒服。',
    ],
    generalCareThreshold:
      '反覆腿部腫脹、疼痛或活動耐受力下降時，接受醫師評估。',
    urgentCare: [
      '突然單側腿部腫痛，或突發呼吸急促、深呼吸胸痛、咳血、昏厥，應立即就醫。',
    ],
    forbiddenInferences: [
      '不得因天相就診斷血液循環不良、血栓或肺栓塞。',
      '不得把一般雙側久站水腫直接寫成急症。',
    ],
    sources: [
      { label: 'NHLBI：Blood Clotting Disorders—Symptoms and Diagnosis', url: 'https://www.nhlbi.nih.gov/health/clotting-disorders/symptoms-diagnosis' },
      { label: 'NHLBI：Pulmonary Embolism', url: 'https://www.nhlbi.nih.gov/health/pulmonary-embolism' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H18',
    name: '婦科與生殖',
    canonicalHealthDirections: ['婦科與生殖相關'],
    customerReminder:
      '婦科與生殖方向較需要保養。可以留意月經是否出現比平常明顯更大量、超過七天、週期間出血、性行為後出血，或經痛／骨盆疼痛逐漸加重並影響生活；若持續或反覆，應由婦產科判斷原因。這是保養提醒，不是婦科疾病或生育能力診斷。',
    observableStates: [
      '經量突然增加、出血超過七天、週期間或性行為後出血。',
      '經痛或骨盆疼痛比以往明顯、逐漸加重，或影響工作與睡眠。',
      '月經週期長期明顯改變。',
    ],
    generalCareThreshold:
      '異常出血、疼痛或週期改變持續或反覆時，安排婦產科評估。',
    urgentCare: [
      '連續數小時每小時都需更換衛生用品，且同時胸痛、呼吸急促、頭暈或快昏倒時，立即就醫；懷孕可能性合併急性骨盆痛或大量出血也應立即就醫。',
    ],
    forbiddenInferences: [
      '不得由太陰、破軍、地支或四化診斷不孕、子宮肌瘤、巧克力囊腫或其他婦科病。',
      '不得把女性婦科規則套用到不適用的生理條件；應依客人實際身體情況與語言設定處理。',
    ],
    sources: [
      { label: 'ACOG：Abnormal Uterine Bleeding', url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding' },
      { label: 'ACOG：Painful Periods', url: 'https://www.acog.org/womens-health/faqs/painful-periods' },
      { label: 'ACOG：Chronic Pelvic Pain', url: 'https://www.acog.org/womens-health/faqs/chronic-pelvic-pain' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H19',
    name: '神經與情緒',
    canonicalHealthDirections: ['神經與情緒相關'],
    customerReminder:
      '神經與情緒較需要保養。可以留意壓力、焦慮、情緒低落、睡眠或專注力改變是否持續，並已影響工作、生活或照顧自己；若超過兩週仍未改善、愈來愈嚴重，或很難完成原本能做的事，建議尋求心理或醫療專業協助。這是保養提醒，不是精神疾病診斷。',
    observableStates: [
      '情緒低落、焦慮、易怒、失去興趣或注意力變差。',
      '睡眠、食欲、體重或日常功能明顯改變。',
      '疲倦、低能量，難以完成平常工作。',
    ],
    generalCareThreshold:
      '症狀持續兩週以上、逐漸惡化或影響日常功能時，與家醫科、身心科、心理師或其他合格專業人員討論。',
    urgentCare: [
      '出現傷害自己、結束生命或傷害他人的想法／衝動時，立即聯絡當地緊急醫療、危機支援或可信任的人陪同就醫。',
    ],
    forbiddenInferences: [
      '不得由昌曲、暗合或化忌診斷憂鬱症、焦慮症、躁鬱症或其他精神疾病。',
      '不得以「意志力弱」羞辱或責怪客人。',
    ],
    sources: [
      { label: 'NIMH：My Mental Health—Do I Need Help?', url: 'https://www.nimh.nih.gov/health/publications/my-mental-health-do-i-need-help' },
      { label: 'NIMH：Caring for Your Mental Health', url: 'https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health' },
    ],
    status: 'reviewed',
  },
  {
    cardId: 'H20',
    name: '外傷與傷口',
    canonicalHealthDirections: ['外傷與傷口相關'],
    customerReminder:
      '若命盤結構另有明確受傷事件訊號，可把重點放在現實安全：工作、運動或外出時避免逞強，受傷後留意疼痛與腫脹是否持續、是否能正常承重與活動。若出現突然劇痛、明顯腫脹瘀青、關節無法活動、肢體不能承重或外觀變形，應儘速就醫。這是安全提醒，不是疾病診斷，也不是事故預告。',
    observableStates: [
      '受傷後疼痛、腫脹、瘀青或活動受限。',
      '傷口持續紅腫熱痛、流膿或有異味。',
      '肢體無法正常承重或關節活動範圍明顯受限。',
    ],
    generalCareThreshold:
      '疼痛、腫脹或傷口狀態持續惡化、影響活動，或自行照護後仍未改善時，接受醫師評估。',
    urgentCare: [
      '無法止血、骨頭／關節明顯變形、肢體失去知覺或血色、嚴重頭部撞擊，或呼吸與意識異常時，立即就醫。',
    ],
    forbiddenInferences: [
      '不得依擎羊、陀羅、火星或鈴星預告特定事故、時間、部位或手術。',
      '不得把「左右」直接翻成一定會開大刀。',
      '不得把擦傷、瘀青或發炎自行診斷成重大疾病。',
    ],
    sources: [
      { label: 'NIAMS：Sports Injuries', url: 'https://www.niams.nih.gov/health-topics/sports-injuries' },
      { label: 'CDC：Symptoms of Mild TBI and Concussion', url: 'https://www.cdc.gov/traumatic-brain-injury/signs-symptoms/index.html' },
      { label: 'American Academy of Dermatology：Rash 101', url: 'https://www.aad.org/public/everyday-care/itchy-skin/rash/rash-101' },
    ],
    status: 'reviewed',
  },
]

export const AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY =
  freezeAiChartD1Value(cards)

const CARD_BY_DIRECTION = new Map<string, AiChartD1HealthReminderCard>()
const PALACE_IDS: ReadonlySet<unknown> = new Set(
  AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
)
for (const card of AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY) {
  for (const direction of card.canonicalHealthDirections) {
    if (CARD_BY_DIRECTION.has(direction)) {
      throw new Error(AI_CHART_D1_HEALTH_REMINDER_INVALID)
    }
    CARD_BY_DIRECTION.set(direction, card)
  }
}

function invalid(reasonCode: AiChartD1HealthReminderErrorReason): never {
  throw new AiChartD1HealthReminderError(reasonCode)
}

function parseDirections(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > CARD_BY_DIRECTION.size) {
    invalid('INPUT_INVALID')
  }
  const directions = value.map((direction) => {
    if (typeof direction !== 'string' || direction.length === 0) {
      invalid('INPUT_INVALID')
    }
    if (!CARD_BY_DIRECTION.has(direction)) {
      invalid('UNKNOWN_HEALTH_DIRECTION')
    }
    return direction
  })
  if (new Set(directions).size !== directions.length) {
    invalid('DUPLICATE_HEALTH_DIRECTION')
  }
  return Object.freeze(directions)
}

export function buildAiChartD1HealthReminderSection(input: {
  targetPalaceId: unknown
  canonicalHealthDirections: unknown
}): AiChartD1HealthReminderSection | null {
  if (!PALACE_IDS.has(input.targetPalaceId)) {
    invalid('INPUT_INVALID')
  }
  const targetPalaceId = input.targetPalaceId as AiChartD1PalaceId
  const directions = parseDirections(input.canonicalHealthDirections)
  if (directions.length === 0) {
    return null
  }
  if (targetPalaceId !== 'palace:health') {
    invalid('NON_HEALTH_PALACE_DIRECTION')
  }

  const selectedCards = directions.map(
    (direction) => CARD_BY_DIRECTION.get(direction)!,
  )
  const uniqueCards = selectedCards.filter(
    (card, index) =>
      selectedCards.findIndex(
        (candidate) => candidate.cardId === card.cardId,
      ) === index,
  )

  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_HEALTH_REMINDER_SECTION_VERSION,
    targetPalaceId: 'palace:health' as const,
    title: '身體保養提醒' as const,
    purpose:
      '依固定命理方向提供生活觀察與就醫提醒，不代表命主已經有任何疾病。',
    canonicalHealthDirections: directions,
    reminderCards: uniqueCards.map((card) => ({
      cardId: card.cardId,
      title: card.name,
      customerReminder: card.customerReminder,
      urgentCare: card.urgentCare,
    })),
    safetyNotice:
      '以上是命理上的保養提醒，不是疾病診斷。實際身體狀況仍應依症狀、檢查與醫療專業判斷；出現卡片列出的急症警訊時，不要等待命盤解釋。',
    renderingPolicy: AI_CHART_D1_HEALTH_REMINDER_SELECTION_POLICY,
  })
}
