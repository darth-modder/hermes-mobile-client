// Regression test for the ToolIcon/Codicon prop-type split (D15.2 criterion 1).
// ToolIcon renders <Svg> (ViewStyle) or falls back to Codicon's <Text> (TextStyle);
// collapsing the two into one `style` type is what produced the original tsc error.
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { expectTypeOf, test } from 'vitest'

import type { CodiconProps } from './Codicon'
import type { ToolIconProps } from './ToolIcon'

test('Codicon.style stays TextStyle', () => {
  expectTypeOf<CodiconProps['style']>().toEqualTypeOf<TextStyle | undefined>()
})

test('ToolIcon.style is StyleProp<ViewStyle>, not TextStyle', () => {
  expectTypeOf<ToolIconProps['style']>().toEqualTypeOf<StyleProp<ViewStyle> | undefined>()
})
