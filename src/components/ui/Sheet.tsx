// M14 primitive — docs/mobile-prototypes/primitives.html "Sheet" section
// (`.sheet` radius sheet(8) top corners, handle 32×4, max-height 88%),
// docs/DESKTOP-DESIGN.md §8 ("Sheet: … elevated surface, shadow-md").
// Replaces every desktop dialog, menu and popover (M14 adaptation table):
// dialogs with a form, popovers, dropdowns and context menus all become one
// of these, with the desktop's fields/items in the desktop's order and
// actions at the bottom.
//
// Mounted on demand by the caller (unlike AppDrawer, which mounts once in
// the root layout) — same unmount-when-closed-and-settled shape, plain
// `Animated` (matching AppDrawer's own choice over Reanimated for a single
// transform+opacity transition), 200ms per M14's motion rule for sheets.
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export interface SheetProps {
  children: ReactNode
  /** Bottom action row, e.g. Cancel/Save — rendered outside the scrolling body. */
  footer?: ReactNode
  onClose: () => void
  title?: string
  visible: boolean
}

const ANIM_MS = 200
const DISMISS_DRAG_PX = 80

export function Sheet({ children, footer, onClose, title, visible }: SheetProps) {
  const tokens = useTheme()
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(1)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const mounted = useRef(false)
  const dragY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { duration: ANIM_MS, toValue: visible ? 0 : 1, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { duration: ANIM_MS, toValue: visible ? 1 : 0, useNativeDriver: true })
    ]).start()

    if (visible) {
      dragY.setValue(0)
    }
  }, [backdropOpacity, dragY, translateY, visible])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4,
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy > 0) {
          dragY.setValue(gesture.dy)
        }
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > DISMISS_DRAG_PX) {
          onClose()
        } else {
          Animated.timing(dragY, { duration: 150, toValue: 0, useNativeDriver: true }).start()
        }
      }
    })
  ).current

  if (!visible && !mounted.current) {
    return null
  }

  mounted.current = visible

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            // `tokens.popover` is deliberately translucent (resolve.ts:
            // `mix(bgElevated, TRANSPARENT, 0.96)`) — a desktop material meant
            // to sit over a blurred backdrop. This sheet has no blur behind
            // it, so at 96% opacity the screen underneath (its text included)
            // showed through; `card` is the same family of surface, fully
            // opaque.
            backgroundColor: tokens.card,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingBottom: insets.bottom + 8,
            transform: [
              {
                translateY: Animated.add(dragY, translateY.interpolate({ inputRange: [0, 1], outputRange: [0, 900] }))
              }
            ]
          }
        ]}
      >
        <View {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: tokens.textQuaternary }]} />
          {title ? (
            <View style={styles.head}>
              <View style={styles.headSpacer} />
              <Text style={[styles.title, { color: tokens.foreground }]}>{title}</Text>
              <Pressable accessibilityLabel="Close" hitSlop={12} onPress={onClose} style={styles.headSpacer}>
                <Text style={[styles.close, { color: tokens.textSecondary }]}>{'✕'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  },
  body: {
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingVertical: 4
  },
  close: {
    ...type.body,
    lineHeight: 20,
    textAlign: 'center'
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  handle: {
    borderRadius: radius.full,
    height: 4,
    marginBottom: 4,
    marginTop: 8,
    width: 32
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 4
  },
  headSpacer: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  sheet: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0
  },
  title: {
    ...type.body,
    flex: 1,
    fontWeight: '600',
    textAlign: 'center'
  }
})
