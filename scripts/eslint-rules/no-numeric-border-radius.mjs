// D15.1b: every desktop radius utility is multiplied by --radius-scalar 0.2,
// so the desktop is near-square (Appendix C). `radius` in src/theme/type.ts
// is the mobile equivalent (control/icon/card/sheet/full) — a bare number on
// `borderRadius` can't be told apart from one of those on sight and quietly
// drifts from the scale. Registered only for files outside src/theme/** (the
// token definitions themselves) and src/upstream/** (vendored code).

/** @type {import('eslint').Rule.RuleModule} */
export const noNumericBorderRadius = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow a numeric literal on borderRadius outside src/theme/** (D15.1b) — use a radius.* token'
    },
    schema: []
  },
  create(context) {
    return {
      Property(node) {
        const keyName = node.key.type === 'Identifier' ? node.key.name : undefined

        if (keyName !== 'borderRadius') {
          return
        }

        if (node.value.type === 'Literal' && typeof node.value.value === 'number') {
          context.report({
            message: `Numeric borderRadius literal '${node.value.value}' — use a radius.* token from src/theme/type.ts instead.`,
            node
          })
        }
      }
    }
  }
}
