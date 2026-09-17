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
// M15 round 17 — why the drag handle uses raw `onTouch*` props, not `PanResponder`:
//
// Rounds 10, 15 and 16 all found no adb-injected gesture reaches this drag, and round 16's best
// guess was a `GestureHandlerRootView` gap specific to `react-native-gesture-handler`. Round 17
// got real touch input (the emulator's virtual touchscreen, not `adb shell input`) and instrumented
// both the responder-negotiation callbacks and the raw touch-event props on the same View at the
// same time. Dragging the title row produced this, verbatim:
//
//   onStartShouldSetPanResponderCapture -> false
//   onStartShouldSetPanResponder -> false
//   onTouchStart (raw) pageY=430.4
//   onTouchMove (raw) pageY=533.3
//   onTouchMove (raw) pageY=659.0
//   onTouchEnd (raw)
//
// `onMoveShouldSetPanResponder(Capture)` — the callback `PanResponder`'s `dy > 4` gate lives in —
// never fired, not even once, not even to decline. The raw `onTouchMove` events on the exact same
// View, at the exact same time, did fire, with correct incrementing `pageY`. So the touch stream
// itself reaches this View's touch dispatch just fine; specifically the JS *responder negotiation*
// (`onMoveShouldSetResponder`) never runs for it inside this `Modal`'s `Dialog` window. That
// matches round 16's `DialogRootViewGroup` reading (`ReactModalHostView.kt:578-592`): it
// hand-wires `jSTouchDispatcher.handleTouchEvent` (the raw touch-event path) but nothing shows it
// wiring whatever native hookup drives the *responder* negotiation loop that a normal
// `ReactRootView` provides for the main window — raw touch dispatch works, the responder
// negotiation it would normally drive does not.
//
// The fix doesn't chase that gap: it drives the drag from the pathway just proven to work.
// `onTouchStart`/`onTouchMove`/`onTouchEnd`/`onTouchCancel` on the same View, tracking the drag's
// start `pageY` in a ref and computing `dy` by hand — no `PanResponder`, no negotiation, nothing
// that depends on whatever `Dialog` windows are missing.
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { GestureResponderEvent } from 'react-native'
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native'
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
  const { height: windowHeight } = useWindowDimensions()
  // M15 round 11 (task 0c). `marginBottom: keyboardInset` slides the sheet up
  // by the keyboard's full height; on a *tall* sheet that pushes its own top
  // — handle, title, Close — off the top of the screen, because nothing ever
  // bounded the sheet against the space actually left above the IME. The
  // primitive's 88% rule (primitives.html "Sheet") is therefore measured
  // against what remains above the keyboard rather than against the whole
  // display, and it caps the sheet as a whole instead of just its body, so
  // the header and footer are inside the budget rather than added on top of
  // it. The body is the part that gives, which is why it scrolls below.
  const maxSheetHeight = (windowHeight - keyboardInset) * 0.88
  const translateY = useRef(new Animated.Value(1)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const dragY = useRef(new Animated.Value(0)).current
  // Keeps the modal window up for the length of the close animation, then
  // takes it down. A ref can't do this job any more: the modal has to stop
  // being rendered once it settles closed (a stale transparent modal window
  // swallows every touch on the screen behind it), and only state re-renders.
  const [rendered, setRendered] = useState(visible)

  // Opening is two renders, not one, and the split matters — see the second
  // effect. This one only flips the window on; it never starts an animation.
  useEffect(() => {
    if (visible) {
      setRendered(true)
      dragY.setValue(0)
    }
  }, [dragY, visible])

  // M15 round 11. Not the scrim bug — that was the two causes recorded on
  // `styles.backdrop` below — but a latent race found while reading this, and
  // fixed here because the scrim's opacity is one of the two values it drives.
  //
  // The open animation used to start in the effect above, in the same pass
  // that calls `setRendered(true)`: at that moment `rendered` is still false,
  // so the early `return null` means neither `Animated.View` is mounted and
  // neither animated value is attached to a view. `useNativeDriver: true`
  // needs the value's native node connected to a real view tag
  // (`connectAnimatedNodeToView`, done by `AnimatedProps.__attach()` on
  // mount) before the driver can write to it, so a timing started against an
  // unattached node can run natively while nothing is listening.
  //
  // It has never produced a *visible* fault: both values happen to end at
  // their on-screen state (`translateY` 0, `backdropOpacity` 1), so a view
  // that attaches late attaches already-correct. Depending on `rendered`
  // instead makes the first `start()` happen on the render after mount, which
  // is the ordering the native driver actually documents. Recorded as
  // defensive, not as a fix for an observed symptom.
  useEffect(() => {
    if (!rendered) {
      return
    }

    Animated.parallel([
      Animated.timing(translateY, { duration: ANIM_MS, toValue: visible ? 0 : 1, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { duration: ANIM_MS, toValue: visible ? 1 : 0, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished && !visible) {
        setRendered(false)
      }
    })
  }, [backdropOpacity, rendered, translateY, visible])

  // Start `pageY` of the current drag, or `null` between drags. A ref, not state: every
  // `onTouchMove` needs it read-and-compared synchronously, the same job `PanResponder`'s own
  // internal gesture-state tracking did.
  const dragStartY = useRef<number | null>(null)

  const onSheetTouchStart = (event: GestureResponderEvent) => {
    dragStartY.current = event.nativeEvent.pageY
  }

  const onSheetTouchMove = (event: GestureResponderEvent) => {
    if (dragStartY.current === null) {
      return
    }

    const dy = event.nativeEvent.pageY - dragStartY.current

    if (dy > 0) {
      dragY.setValue(dy)
    }
  }

  const springBack = () => {
    Animated.timing(dragY, { duration: 150, toValue: 0, useNativeDriver: true }).start()
  }

  const onSheetTouchEnd = (event: GestureResponderEvent) => {
    if (dragStartY.current === null) {
      return
    }

    const dy = event.nativeEvent.pageY - dragStartY.current

    dragStartY.current = null

    if (dy > DISMISS_DRAG_PX) {
      onClose()
    } else {
      springBack()
    }
  }

  // The OS can end a touch stream without an `onTouchEnd` (e.g. an incoming call, a system
  // gesture stealing it) — treat that the same as a short release rather than leaving the sheet
  // stuck mid-drag with no way to finish the gesture.
  const onSheetTouchCancel = () => {
    if (dragStartY.current === null) {
      return
    }

    dragStartY.current = null
    springBack()
  }

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
              maxHeight: maxSheetHeight,
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
          <View
            onTouchCancel={onSheetTouchCancel}
            onTouchEnd={onSheetTouchEnd}
            onTouchMove={onSheetTouchMove}
            onTouchStart={onSheetTouchStart}
          >
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
          <ScrollView
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            style={styles.body}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // M15 round 11 (task 0a), the scrim's *first* cause. This carried only a
  // `backgroundColor`, so as a plain flex child of the `absoluteFill` root it
  // stretched to full width and collapsed to **zero height** — its one child
  // is `position: absolute` and so contributes nothing to its parent's
  // intrinsic size. Round 10's `onLayout` measured exactly that
  // (`{"x":0,"y":0,"width":411.4,"height":0}`). A zero-height View cannot dim
  // anything and its `absoluteFill` Pressable — absolute *relative to it* —
  // is zero-sized too, which is why the scrim never appeared in a dump and
  // tapping outside a sheet did nothing.
  //
  // `AppDrawer.tsx:142-144` still carries the identical shape; this style was
  // copied from there. The drawer only looks correct because its panel is
  // opaque and covers the part of the screen you look at.
  //
  // The *second* cause is why round 10's fix for the first one didn't take.
  // It spread `StyleSheet.absoluteFillObject`, which **does not exist in
  // React Native 0.86.3**: `Libraries/StyleSheet/StyleSheetExports.js:21-27`
  // declares `absoluteFill` as a plain object and exports exactly that name
  // at `:110` — there is no `absoluteFillObject` alongside it (the two-name
  // era, where `absoluteFill` was a registered style ID and
  // `absoluteFillObject` its object form, is gone). Spreading `undefined`
  // into an object literal is legal and silently contributes nothing, so the
  // style stayed `{backgroundColor}` and the backdrop stayed zero-height —
  // the edit read as a fix and compiled, but changed nothing at runtime.
  // `tsc` does flag it (TS2551), which is how it was caught here.
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  },
  // `flexShrink: 1` against the sheet's `maxHeight` is what makes the body —
  // not the header or the footer — absorb the overflow on a tall sheet, so
  // the title stays on screen and the content scrolls under it.
  body: {
    flexGrow: 0,
    flexShrink: 1
  },
  bodyContent: {
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
    // M15 round 17. The parent View (`onTouchStart`'s own View, above) has no `alignItems`
    // override, so it defaults to `stretch` — but this handle sets an explicit `width`, which
    // overrides the stretch and falls back to `flex-start` (the left edge) for the cross-axis
    // position, since nothing here said otherwise. Without `alignSelf`, a fixed-width child in a
    // `stretch` column is left-aligned, not centred — confirmed on device, the handle rendered at
    // x≈0-70 instead of centred under the sheet's ~48dp-wide expected position.
    alignSelf: 'center',
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
