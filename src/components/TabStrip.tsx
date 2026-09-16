// M15 round 15 (group E). Replicates: docs/mobile-prototypes/sessions.html:10 / bots.html:9 — "the
// SESSIONS / BOTS zone strip becomes the Bots · Sessions · Tasks tab row (D16)". Deviation (M15
// doc): the tab row didn't exist as a shared component before this round (M15 C's own Deviation 14
// left it undrawn everywhere), and Bots/Sessions/Tasks were reached only by the drawer pushing a
// new stack entry each time — not the prototype's "real tabs that switch in place"
// (sessions.html:20). `router.replace` here is what makes a tab switch in place: it swaps the
// current stack entry instead of growing the stack, so edge-swipe-back from any tab goes to
// whatever screen was open before the tab row was first reached, not to the previous tab.
//
// The swipe gesture is scoped to this 48dp strip, not the screen body. Round 10 and round 15 both
// found that no adb-injected gesture (`input swipe`, `draganddrop`, a hand-built motionevent
// DOWN/MOVE/UP) reaches a JS `PanResponder`, and round 15 additionally found the same is true of a
// `react-native-gesture-handler` `Gesture.Pan()` — so nothing under this row is regression-testable
// by this harness's device verification either way. A full-screen recognizer would only multiply
// that untestable surface (fighting `FlatList`/`SectionList` vertical scroll, the drawer's edge
// swipe, and `react-native-screens`' own edge-back) for no verifiable benefit; the tab row is the
// smallest surface that still matches "swipe between tabs" and keeps everything below it exactly
// as it already was.
//
// M15 round 16 — the edge-band race, fixed structurally. Round 15's `onEnd`-only guard let the
// gesture *activate* on an edge-originating touch and only refused to navigate afterward; the
// touch had already been claimed away from `react-native-screens`' own edge-back recognizer by
// then, and round 15 saw that race resolve two different ways across nominally identical injected
// swipes. `hitSlop({ left: -EDGE_GUARD_PX })` (below) shrinks this handler's own hit-test rectangle
// inward by that many px — `GestureHandlerOrchestrator.kt:503,542`'s `isWithinBounds` check runs on
// `ACTION_DOWN`, before a handler is even added as a candidate for the touch stream
// (`extractGestureHandlers`, same file), so a touch starting inside the band is never offered to
// this gesture at all, structurally, not just refused after the fact. `startX`/`isInEdgeBand` stay
// as a defensive second check in `onEnd` (unit-tested below) in case a future edit widens the
// `GestureDetector`'s own View past the strip and reintroduces the overlap `hitSlop` is guarding
// against here.
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { BOTS_TAB_LABEL, TASKS_TAB_LABEL } from '../lib/strings.mobile'
import { useTheme } from '../theme/provider'
import { radius, type } from '../theme/type'

import { EDGE_GUARD_PX, isInEdgeBand, stepFor } from './tab-strip-gesture'

export type MainTab = 'bots' | 'sessions' | 'tasks'

interface TabDef {
  key: MainTab
  label: string
  route: '/(main)/bots' | '/(main)/session-list' | '/(main)/tasks'
}

// Order matches the drawer (Deviation 6: Bots, Sessions, "Scheduled jobs"/Tasks) and the
// prototype's own "Bots · Sessions · Tasks" reading order.
const TABS: TabDef[] = [
  { key: 'bots', label: BOTS_TAB_LABEL, route: '/(main)/bots' },
  { key: 'sessions', label: 'Sessions', route: '/(main)/session-list' },
  { key: 'tasks', label: TASKS_TAB_LABEL, route: '/(main)/tasks' }
]

export interface TabStripProps {
  active: MainTab
}

export function TabStrip({ active }: TabStripProps) {
  const tokens = useTheme()
  const router = useRouter()
  const startX = useRef(0)

  const activeIndex = TABS.findIndex(tab => tab.key === active)

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= TABS.length || nextIndex === activeIndex) {
        return
      }

      router.replace(TABS[nextIndex].route)
    },
    [activeIndex, router]
  )

  // Memoized on `activeIndex` (not recreated every render): a `Gesture.Pan()` rebuilt on every
  // parent re-render tears down and re-registers the native handler, and round 15's stray
  // "advanced by two" result is more consistent with a leftover in-flight gesture from a torn-down
  // handler than with a math bug in the single-step arithmetic below (which was, and still is,
  // structurally incapable of moving more than one index — see `stepFor`). `activeIndex` is the
  // right dependency: it only changes once a tab switch has actually committed, i.e. never mid-swipe.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        // Structural fix, round 16: shrinks this handler's own hit-test rect inward by
        // `EDGE_GUARD_PX` on the left, so a touch starting in that band is never offered to this
        // gesture at all (`GestureHandlerOrchestrator.kt:503,542`'s `isWithinBounds`, checked on
        // `ACTION_DOWN` before a handler becomes a candidate for the touch stream) — not merely
        // refused after activating, which is what round 15 shipped and what raced.
        .hitSlop({ left: -EDGE_GUARD_PX })
        .activeOffsetX([-10, 10])
        .failOffsetY([-20, 20])
        .onBegin(event => {
          startX.current = event.x
        })
        .onEnd(event => {
          if (isInEdgeBand(startX.current)) {
            return
          }

          goToIndex(activeIndex + stepFor(event.translationX))
        }),
    [activeIndex, goToIndex]
  )

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.row, { borderBottomColor: tokens.border }]}>
        {TABS.map((tab, index) => {
          const isActive = index === activeIndex

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={tab.key}
              onPress={() => goToIndex(index)}
              style={styles.tab}
            >
              <Text style={[styles.label, { color: isActive ? tokens.foreground : tokens.mutedForeground }]}>
                {tab.label}
              </Text>
              <View style={[styles.indicator, { backgroundColor: isActive ? tokens.primary : 'transparent' }]} />
            </Pressable>
          )
        })}
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  indicator: {
    borderRadius: radius.full,
    bottom: 0,
    height: 2,
    left: 12,
    position: 'absolute',
    right: 12
  },
  label: {
    ...type.label,
    fontWeight: '600'
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 48
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  }
})
