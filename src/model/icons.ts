/**
 * The icon catalogue shared by data sections and the primitive blocks.
 *
 * A value is a Lucide icon's own name (`shield-check`), so the picker shows the
 * glyph's real name and searches by it, and a stored layout asks for an icon
 * the same way the icon set names one.
 *
 * `ICON_MANIFEST` maps each name to the `react-icons/lu` export that draws it,
 * as a string. This module stays React-free — the root entry point imports it
 * to validate a saved layout on the server — and `scripts/generate-icons.ts`
 * reads the manifest to emit the glyph modules and maps in `render/` and
 * `editor/`. Adding an icon is one line here, then `bun run generate:icons`.
 *
 * `''` is a real value too: the seller picked "No icon", and the renderer draws
 * nothing for it.
 */

export const ICON_MANIFEST = {
  // Commerce and trust
  truck: 'LuTruck',
  banknote: 'LuBanknote',
  'shield-check': 'LuShieldCheck',
  'refresh-cw': 'LuRefreshCw',
  package: 'LuPackage',
  'package-check': 'LuPackageCheck',
  'package-open': 'LuPackageOpen',
  box: 'LuBox',
  boxes: 'LuBoxes',
  archive: 'LuArchive',
  'shopping-bag': 'LuShoppingBag',
  'shopping-cart': 'LuShoppingCart',
  store: 'LuStore',
  tag: 'LuTag',
  tags: 'LuTags',
  ticket: 'LuTicket',
  'ticket-percent': 'LuTicketPercent',
  'badge-percent': 'LuBadgePercent',
  percent: 'LuPercent',
  receipt: 'LuReceipt',
  wallet: 'LuWallet',
  'wallet-cards': 'LuWalletCards',
  coins: 'LuCoins',
  'hand-coins': 'LuHandCoins',
  'credit-card': 'LuCreditCard',
  'qr-code': 'LuQrCode',
  barcode: 'LuBarcode',
  calculator: 'LuCalculator',
  'chart-bar': 'LuChartBar',
  'trending-up': 'LuTrendingUp',
  handshake: 'LuHandshake',

  // Contact and support
  phone: 'LuPhone',
  'phone-call': 'LuPhoneCall',
  mail: 'LuMail',
  send: 'LuSend',
  'message-circle': 'LuMessageCircle',
  'message-circle-question': 'LuMessageCircleQuestion',
  headphones: 'LuHeadphones',
  megaphone: 'LuMegaphone',
  bell: 'LuBell',
  'at-sign': 'LuAtSign',

  // Place and delivery
  'map-pin': 'LuMapPin',
  'map-pinned': 'LuMapPinned',
  globe: 'LuGlobe',
  compass: 'LuCompass',
  car: 'LuCar',
  bike: 'LuBike',
  plane: 'LuPlane',
  ship: 'LuShip',
  anchor: 'LuAnchor',
  building: 'LuBuilding',
  home: 'LuHouse',

  // Time
  clock: 'LuClock',
  calendar: 'LuCalendar',
  'calendar-check': 'LuCalendarCheck',
  timer: 'LuTimer',
  'alarm-clock': 'LuAlarmClock',
  hourglass: 'LuHourglass',

  // Nature
  leaf: 'LuLeaf',
  sprout: 'LuSprout',
  flower: 'LuFlower',
  'flower-2': 'LuFlower2',
  'tree-pine': 'LuTreePine',
  sun: 'LuSun',
  moon: 'LuMoon',
  droplet: 'LuDroplet',
  flame: 'LuFlame',
  snowflake: 'LuSnowflake',
  cloud: 'LuCloud',
  wind: 'LuWind',
  recycle: 'LuRecycle',
  mountain: 'LuMountain',
  waves: 'LuWaves',
  rainbow: 'LuRainbow',

  // Food and drink
  coffee: 'LuCoffee',
  'cup-soda': 'LuCupSoda',
  utensils: 'LuUtensils',
  'utensils-crossed': 'LuUtensilsCrossed',
  cake: 'LuCake',
  pizza: 'LuPizza',
  salad: 'LuSalad',
  soup: 'LuSoup',
  'ice-cream-bowl': 'LuIceCreamBowl',
  croissant: 'LuCroissant',
  wine: 'LuWine',
  beer: 'LuBeer',
  candy: 'LuCandy',
  apple: 'LuApple',
  carrot: 'LuCarrot',

  // People
  user: 'LuUser',
  users: 'LuUsers',
  'user-check': 'LuUserCheck',
  'heart-handshake': 'LuHeartHandshake',
  baby: 'LuBaby',
  accessibility: 'LuAccessibility',

  // Symbols and status
  star: 'LuStar',
  heart: 'LuHeart',
  gift: 'LuGift',
  award: 'LuAward',
  'badge-check': 'LuBadgeCheck',
  crown: 'LuCrown',
  gem: 'LuGem',
  sparkles: 'LuSparkles',
  'thumbs-up': 'LuThumbsUp',
  'circle-check': 'LuCircleCheck',
  'check-check': 'LuCheckCheck',
  lock: 'LuLock',
  'lock-open': 'LuLockOpen',
  key: 'LuKey',
  flag: 'LuFlag',
  bookmark: 'LuBookmark',
  shield: 'LuShield',
  'shield-alert': 'LuShieldAlert',
  zap: 'LuZap',
  ban: 'LuBan',
  eye: 'LuEye',
  'eye-off': 'LuEyeOff',

  // Tools and media
  settings: 'LuSettings',
  wrench: 'LuWrench',
  hammer: 'LuHammer',
  ruler: 'LuRuler',
  scissors: 'LuScissors',
  pencil: 'LuPencil',
  'pen-tool': 'LuPenTool',
  paintbrush: 'LuPaintbrush',
  palette: 'LuPalette',
  brush: 'LuBrush',
  camera: 'LuCamera',
  video: 'LuVideo',
  film: 'LuFilm',
  image: 'LuImage',
  images: 'LuImages',
  music: 'LuMusic',
  mic: 'LuMic',
  printer: 'LuPrinter',
  smartphone: 'LuSmartphone',
  laptop: 'LuLaptop',
  monitor: 'LuMonitor',
  keyboard: 'LuKeyboard',
  wifi: 'LuWifi',
  'battery-charging': 'LuBatteryCharging',
  plug: 'LuPlug',
  'plug-zap': 'LuPlugZap',
  power: 'LuPower',
  lightbulb: 'LuLightbulb',
  rocket: 'LuRocket',
  search: 'LuSearch',
  puzzle: 'LuPuzzle',
  cpu: 'LuCpu',
  'hard-drive': 'LuHardDrive',
  usb: 'LuUsb',

  // Knowledge and documents
  'book-open': 'LuBookOpen',
  book: 'LuBook',
  'graduation-cap': 'LuGraduationCap',
  newspaper: 'LuNewspaper',
  'file-text': 'LuFileText',
  'file-check': 'LuFileCheck',
  'clipboard-list': 'LuClipboardList',
  'clipboard-check': 'LuClipboardCheck',
  layers: 'LuLayers',
  'layout-grid': 'LuLayoutGrid',
  list: 'LuList',
  'list-checks': 'LuListChecks',
  folder: 'LuFolder',
  notebook: 'LuNotebook',
  scroll: 'LuScroll',
  'pen-line': 'LuPenLine',

  // Animals and health
  hand: 'LuHand',
  'paw-print': 'LuPawPrint',
  dog: 'LuDog',
  cat: 'LuCat',
  bird: 'LuBird',
  fish: 'LuFish',
  bug: 'LuBug',
  rabbit: 'LuRabbit',
  turtle: 'LuTurtle',
  egg: 'LuEgg',
  dumbbell: 'LuDumbbell',
  'biceps-flexed': 'LuBicepsFlexed',
  activity: 'LuActivity',
  'heart-pulse': 'LuHeartPulse',
  stethoscope: 'LuStethoscope',
  pill: 'LuPill',
  syringe: 'LuSyringe',
  thermometer: 'LuThermometer',
  cross: 'LuCross',

  // Sport and leisure
  trophy: 'LuTrophy',
  medal: 'LuMedal',
  target: 'LuTarget',
  swords: 'LuSwords',
  'gamepad-2': 'LuGamepad2',
  dices: 'LuDices',
  tent: 'LuTent',
  trees: 'LuTrees',
  umbrella: 'LuUmbrella',
  glasses: 'LuGlasses',
  shirt: 'LuShirt',
  footprints: 'LuFootprints',
  watch: 'LuWatch',
} as const

export type IconName = keyof typeof ICON_MANIFEST

/** Every name, in catalogue order. */
export const ICON_NAMES = Object.keys(ICON_MANIFEST) as readonly IconName[]

/**
 * The glyphs the storefront ships eagerly — the icons a page is most likely to
 * show above the fold, so they paint in the first HTML rather than stream in.
 * Every other name is a lazy chunk. See `render/icons`.
 */
export const CORE_ICON_NAMES = [
  'truck',
  'banknote',
  'shield-check',
  'refresh-cw',
  'package',
  'shopping-bag',
  'shopping-cart',
  'store',
  'tag',
  'credit-card',
  'phone',
  'mail',
  'message-circle',
  'map-pin',
  'clock',
  'calendar',
  'leaf',
  'star',
  'heart',
  'gift',
  'award',
  'badge-check',
  'sparkles',
  'lock',
  'user',
  'users',
  'settings',
  'search',
] as const satisfies readonly IconName[]

export type CoreIconName = (typeof CORE_ICON_NAMES)[number]

/** The empty value: the seller chose "No icon", and nothing is drawn. */
export const NO_ICON = ''

/**
 * The keys a layout saved before the set moved to Lucide names still holds,
 * and the Lucide name each became — so a merchant's chosen icon survives the
 * rename. Read by the sanitiser, which stores only the new name.
 */
export const ICON_ALIASES: Record<string, IconName> = {
  cash: 'banknote',
  shield: 'shield-check',
  refresh: 'refresh-cw',
  chat: 'message-circle',
  badge: 'badge-check',
  pin: 'map-pin',
  card: 'credit-card',
}

/** The catalogue name a stored value means, or null when it is empty or unknown. */
export function resolveIconName(value: unknown): IconName | null {
  if (typeof value !== 'string' || value === NO_ICON) return null
  const key = ICON_ALIASES[value] ?? value
  return (ICON_NAMES as readonly string[]).includes(key) ? (key as IconName) : null
}
