// M13 Step 7 (Appendix C). Six roles, ported from the desktop's base size
// and line-height (`--dt-base-size`/`--dt-line-height` in styles.css) plus
// the mono the desktop ships (JetBrains Mono, OFL — Android has none of the
// desktop's system mono faces, so this is bundled rather than left to the
// platform). No per-screen font sizes outside this table.

export interface TypeRole {
  fontSize: number
  lineHeight: number
  fontFamily?: string
}

export const type = {
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: 'JetBrainsMono', fontSize: 13, lineHeight: 20 },
  title: { fontSize: 20, lineHeight: 28 }
} as const satisfies Record<string, TypeRole>

export type TypeRoleName = keyof typeof type

// Not a seventh role (Appendix C names exactly six): 'JetBrainsMono-Bold' is
// a distinct bundled font FILE (src/lib/fonts.ts), used only by CodeBlock's
// syntax highlighter for bold tokens (keywords, headings) layered on the
// `mono` role — React Native doesn't synthesise bold for a custom font from
// `fontWeight` alone, so a bold code token needs the bold family by name,
// not a heavier weight of the same one.
export const MONO_BOLD_FONT_FAMILY = 'JetBrainsMono-Bold'
