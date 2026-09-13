# Third-party fonts

- **codicon.ttf** — [@vscode/codicons](https://github.com/microsoft/vscode-codicons), © Microsoft
  Corporation, licensed [CC-BY-4.0](https://github.com/microsoft/vscode-codicons/blob/main/LICENSE).
  Used for tool and file-type icons (`src/components/Codicon.tsx`), matching
  `apps/desktop/src/components/ui/codicon.tsx`'s icon set (M13).
- **JetBrainsMono-Regular.ttf**, **JetBrainsMono-Bold.ttf** — JetBrains Mono, © JetBrains s.r.o.,
  licensed [OFL-1.1](https://openfontlicense.org/open-font-license-official-text/). The desktop
  bundles the same family as `apps/desktop/src/fonts/*.woff2` (Regular/Bold/Italic); these are
  genuine TrueType files (React Native's `expo-font` needs `.ttf`/`.otf`, not `.woff2`) sourced
  from Google Fonts' OFL distribution via `@expo-google-fonts/jetbrains-mono@0.4.1` (installed
  temporarily to extract the `400Regular`/`700Bold` files, then removed — it is not a runtime
  dependency). Used for code and diffs (`src/theme/type.ts`'s `mono` role, M13 Step 7); no Italic
  weight bundled, nothing in this app renders italic monospace text.
