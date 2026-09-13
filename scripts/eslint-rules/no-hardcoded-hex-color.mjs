// M13 (D14): every colour must come out of resolveMobileTheme, not a literal
// sprinkled through a screen or component. Flags any `#rrggbb` / `#rgb`
// string — in a StyleSheet.create object, an inline style, a JSX prop,
// anywhere — so a restyle can't quietly reintroduce a hard-coded palette.
// Registered only for files outside src/theme/** and src/upstream/** (the
// token definitions themselves, and vendored code neither read this rule).

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** @type {import('eslint').Rule.RuleModule} */
export const noHardcodedHexColor = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hard-coded hex colour literals outside src/theme/** and src/upstream/** (M13, D14)'
    },
    schema: []
  },
  create(context) {
    function check(node, value) {
      if (typeof value === 'string' && HEX_COLOR.test(value)) {
        context.report({
          message: `Hard-coded colour literal '${value}' — use a token from useTheme() (src/theme/resolve.ts) instead.`,
          node
        })
      }
    }

    return {
      Literal(node) {
        check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      }
    }
  }
}
