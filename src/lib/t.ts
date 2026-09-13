// D15.4 / M14: every visible string on a ported screen comes from the
// desktop's own English copy, vendored at src/upstream/i18n/en.ts, so a
// retyped label is a test failure rather than a review comment. The desktop
// itself is multi-locale (`useI18n()` returns `{ t }` where `t` is the
// active-locale `Translations` object, `apps/desktop/src/i18n/`); mobile has
// no locale switcher and vendors English only, so `t` here is simply that
// object — same call shape as the desktop (`t.agents.close`,
// `t.about.version('1.2.3')`), no path-string lookup to keep type-safe.
import { en } from '../upstream/i18n/en'

export const t = en

export type { Translations } from '../upstream/i18n/types'
