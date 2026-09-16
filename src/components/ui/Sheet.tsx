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
//
// M15 round 9 — why the whole sheet lives inside a `Modal`:
//
// Callers mount a `Sheet` wherever the control that opens it happens to sit
// in the tree. Before this change the sheet's root was a plain
// `StyleSheet.absoluteFill` View, so "full screen" actually meant "the size
// of whatever view the caller mounted us in". For callers whose mount point
// is a full-screen container (every `app/(main)/**` screen) that is the same
// thing; for `ModelChip`/`EffortChip`, mounted inside `Composer`'s ~130 dp
// bottom bar, it is not. Android still *draws* children that overflow their
// parent (RN Views default to `overflow: 'visible'`), but it does not
// dispatch touches to them — `ViewGroup.dispatchTouchEvent` only descends
// into children whose hit rect is inside the parent — and
// `AccessibilityNodeInfoDumper` intersects each node's bounds with its
// ancestors' visible bounds, which is what produced round 8's collapsed and
// inverted `bounds=` rectangles. The rows were always 48 dp tall; nothing
// below the composer's own top edge could be tapped.
//
// `Modal` puts the sheet in its own full-screen window, so the root really
// is the screen: touch dispatch, `uiautomator`'s reported bounds and the
// body's `maxHeight: '88%'` all resolve against the display instead of the
// caller's mount point. `onRequestClose` additionally gives every sheet
// Android's hardware/gesture back dismissal, which the plain-View version
// never had.
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
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

/**
 * How far to lift the sheet so the keyboard does not sit on top of it.
 *
 * `AndroidManifest.xml:31` sets `android:windowSoftInputMode="adjustResize"`
 * on `MainActivity`, which is why every *screen* in this app already reflows
 * around the IME. A `Modal` is its own window and does not inherit that, so
 * once the sheet moved into one (M15 round 9) a focused input inside it was
 * simply covered — confirmed on device in round 10 against the New profile
 * sheet: the IME was up (`mInputShown=true`) while the sheet's own nodes
 * stayed at their unfocused coordinates, with the NAME field and both footer
 * buttons behind the keyboard.
 *
 * React Native's own `Keyboard` events are used rather than
 * `react-native-keyboard-controller` (already a dependency, driving the
 * composer): its components read a `KeyboardProvider` context that is mounted
 * once in `app/_layout.tsx:40`, in the main window — a second provider would
 * have to go inside every modal. `Keyboard`'s events come from the IME itself
 * and need no provider, so they work the same in either window.
 */
function useKeyboardInset(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    // `keyboardDidShow`/`Hide` rather than the `will*` pair: Android only
    // emits the `did*` events (the `will*` ones are iOS-only), and this
    // component ships on Android today.
    const show = Keyboard.addListener('keyboardDidShow', event => setHeight(event.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return height
}

export function Sheet({ children, footer, onClose, title, visible }: SheetProps) {
  const tokens = useTheme()
  const insets = useSafeAreaInsets()
  const keyboardInset = useKeyboardInset()
  const translateY = useRef(new Animated.Value(1)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const dragY = useRef(new Animated.Value(0)).current
  // Keeps the modal window up for the length of the close animation, then
  // takes it down. A ref can't do this job any more: the modal has to stop
  // being rendered once it settles closed (a stale transparent modal window
  // swallows every touch on the screen behind it), and only state re-renders.
  const [rendered, setRendered] = useState(visible)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      dragY.setValue(0)
    }

    Animated.parallel([
      Animated.timing(translateY, { duration: ANIM_MS, toValue: visible ? 0 : 1, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { duration: ANIM_MS, toValue: visible ? 1 : 0, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished && !visible) {
        setRendered(false)
      }
    })
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

  if (!rendered) {
    return null
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent transparent visible>
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
              // Lift the whole sheet by exactly the keyboard's height rather
              // than padding it: padding would make the sheet taller and push
              // its own top off-screen, while a margin slides the same-sized
              // sheet up, which is what a bottom sheet should do. The safe-area
              // inset is only needed when the keyboard is down — the IME
              // already covers the gesture bar.
              marginBottom: keyboardInset,
              paddingBottom: keyboardInset > 0 ? 8 : insets.bottom + 8,
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
    </Modal>
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
