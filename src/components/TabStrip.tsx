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
// as it already was. Manual check: M15's Verification log, round 15.
import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { BOTS_TAB_LABEL, TASKS_TAB_LABEL } from '../lib/strings.mobile'
import { useTheme } from '../theme/provider'
import { radius, type } from '../theme/type'

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

const SWIPE_THRESHOLD_PX = 60
// Keeps a swipe that starts at the strip's own left edge from competing with
// react-native-screens' edge-back gesture, which claims that same band of the screen.
//
// Round 15 found this arbitration is not fully reliable under adb injection: the same
// edge-originating swipe (x well inside this guard) sometimes correctly deferred to the
// system/`react-native-screens` back gesture (the screen popped or the app exited, this
// gesture never fired) and sometimes did not (the tab advanced by two instead of the
// guard blocking it) — two different outcomes for nominally the same input, which reads as a
// genuine touch-dispatch race between this gesture and the competing one rather than a
// threshold bug. Raised from 24 to 40 for more real-world margin, but not proven safe by
// injection; manual check in M15's Verification log, round 15.
const EDGE_GUARD_PX = 40

export interface TabStripProps {
  active: MainTab
}

export function TabStrip({ active }: TabStripProps) {
  const tokens = useTheme()
  const router = useRouter()
  const startX = useRef(0)

  const activeIndex = TABS.findIndex(tab => tab.key === active)

  const goToIndex = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= TABS.length || nextIndex === activeIndex) {
      return
    }

    router.replace(TABS[nextIndex].route)
  }

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .onBegin(event => {
      startX.current = event.x
    })
    .onEnd(event => {
      if (startX.current < EDGE_GUARD_PX) {
        return
      }

      if (event.translationX < -SWIPE_THRESHOLD_PX) {
        goToIndex(activeIndex + 1)
      } else if (event.translationX > SWIPE_THRESHOLD_PX) {
        goToIndex(activeIndex - 1)
      }
    })

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
