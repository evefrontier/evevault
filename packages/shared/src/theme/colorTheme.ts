// Console palette (EVE Frontier grid console). The legacy token names below
// are kept as aliases so existing classes and `color` props pick up the new
// values. Keep in sync with :root in global.css and the apps' @theme blocks.
const palette = {
  // Console tokens
  bg: '#0B0B0C',
  ink: '#FAFAE5',
  line: '#2A2A2B',
  n05: 'rgba(250, 250, 229, 0.05)',
  n10: 'rgba(250, 250, 229, 0.10)',
  n20: 'rgba(250, 250, 229, 0.20)',
  n30: 'rgba(250, 250, 229, 0.30)',
  n40: 'rgba(250, 250, 229, 0.40)',
  n50: 'rgba(250, 250, 229, 0.50)',
  n60: 'rgba(250, 250, 229, 0.60)',
  brand: '#FF4700',
  'brand-10': 'rgba(255, 71, 0, 0.10)',
  'brand-40': 'rgba(255, 71, 0, 0.40)',
  'brand-60': 'rgba(255, 71, 0, 0.60)',
  amber: '#FFB651',
  'amber-30': 'rgba(255, 182, 81, 0.30)',
  offline: '#FF4D4D',
  'offline-bg': '#3A1515',
  relate: '#4FD0DA',
  power: '#2350D8',

  // Legacy aliases
  'crude-01': '#9A9A8E',
  'crude-02': '#83837A',
  'crude-03': '#77776F',
  'crude-04': '#6B6B63',
  'crude-05': '#474742',
  'crude-06': '#3B3B37',
  'crude-07': '#232322',
  'crude-08': '#1C1C1B',
  'crude-09': '#171717',
  'crude-5008': 'rgba(11, 11, 12, 0.50)',
  'crude-5006': 'rgba(59, 59, 55, 0.50)',
  'crude-7008': 'rgba(11, 11, 12, 0.70)',
  'crude-8003': 'rgba(59, 59, 55, 0.80)',
  'crude-9008': 'rgba(11, 11, 12, 0.90)',
  'red-10': '#FF4D4D',
  error: '#FF4D4D',
  selanite: '#FFF',
  'quantum-02': 'rgba(255, 182, 81, 0.20)',
  'quantum-05': 'rgba(255, 182, 81, 0.50)',
  neutral: '#FAFAE5',
  'neutral-90': 'rgba(250, 250, 229, 0.90)',
  'neutral-80': 'rgba(250, 250, 229, 0.80)',
  'neutral-60': 'rgba(250, 250, 229, 0.60)',
  'neutral-50': 'rgba(250, 250, 229, 0.50)',
  'neutral-30': 'rgba(250, 250, 229, 0.30)',
  'neutral-20': 'rgba(250, 250, 229, 0.20)',
  'neutral-10': 'rgba(250, 250, 229, 0.10)',
  quantum: '#FF4700',
  'quantum-80': 'rgba(255, 71, 0, 0.80)',
  'quantum-50': 'rgba(255, 71, 0, 0.50)',
  'quantum-30': 'rgba(255, 71, 0, 0.30)',
  'quantum-20': 'rgba(255, 71, 0, 0.20)',
  'quantum-10': 'rgba(255, 71, 0, 0.10)',
  'dark-quantum': '#992B00',
  'red-quantum': '#FF4D4D',
  'bright-quantum': '#FF6C33',
  'bright-quantum-II': '#FFB651',
  'quantum-II': '#FFB651',
  'grey-neutral': 'rgba(250, 250, 229, 0.50)',
  'matter-01': '#171717',
  'matter-02': '#2A2A2B',
  'matter-03': '#3B3B37',
  'matter-04': '#474742',
  'matter-05': '#53534D',
  'matter-06': '#6B6B63',
  crude: '#0B0B0C',
  'crude-80': 'rgba(11, 11, 12, 0.80)',
  'crude-50': 'rgba(11, 11, 12, 0.50)',
  'crude-30': 'rgba(11, 11, 12, 0.30)',
  'crude-20': 'rgba(11, 11, 12, 0.20)',
  'crude-10': 'rgba(11, 11, 12, 0.10)',
  alert: '#2350D8',
  'alert-80': 'rgba(35, 80, 216, 0.80)',
  'alert-50': 'rgba(35, 80, 216, 0.50)',
  'alert-30': 'rgba(35, 80, 216, 0.30)',
  'alert-20': 'rgba(35, 80, 216, 0.20)',
  'alert-10': 'rgba(35, 80, 216, 0.10)',
  'alert-II': '#B474DD',
  'alert-II-80': 'rgba(180, 116, 221, 0.8)',
  'alert-II-60': 'rgba(180, 116, 221, 0.6)',
  'alert-II-30': 'rgba(180, 116, 221, 0.3)',
  'alert-III': '#A835F1',
  success: '#4FD0DA',
  'success-80': 'rgba(79, 208, 218, 0.80)',
  'success-30': 'rgba(79, 208, 218, 0.30)',
  'bg-top': '#0B0B0C',
  'bg-bottom': '#0B0B0C',
}

// The console has a single dark palette; both variants resolve to it.
export const dark = palette
export const light = palette

const theme = {
  light,
  dark,
} as const

export type ThemeVariant = keyof typeof theme
export type ThemeValues = (typeof theme)[ThemeVariant]
export type ThemeToken = keyof ThemeValues

export default theme

export function applyTheme(variant: ThemeVariant) {
  const values = theme[variant]
  const root = document.documentElement
  ;(Object.keys(values) as Array<ThemeToken>).forEach((token) => {
    const value = values[token]
    root.style.setProperty(`--${token}` as string, String(value))
  })
}
