// The one place the app's public-facing identity is defined (D22.1, D22.3).
// app.config.ts imports APP_NAME/APP_SLUG so the display name and slug never
// drift from this file; every screen that names the app or must disclaim
// affiliation imports from here rather than hardcoding either string.
export const APP_NAME = 'Hermes Mobile'
export const APP_SLUG = 'hermes-mobile'

// D22.3: mandatory wherever APP_NAME appears without other context — the
// About screen, the connect screen footer, and the README's first paragraph.
export const UNAFFILIATED_NOTICE =
  'An independent, open-source client for Hermes Agent. Not affiliated with or endorsed by Nous Research.'
