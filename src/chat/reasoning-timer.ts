// Ported from the desktop's `apps/desktop/src/components/chat/activity-timer.ts`
// (`formatElapsed`, `useElapsedSeconds`, `useMeasuredDuration`) for
// ReasoningDisclosure.tsx's four-state label (M14 close-out round 3, task 1).
// Same registry-based semantics, same reason a component can't just read
// `completedAt - timestamp` off the persisted part: a block restored from
// history was never watched running, so it must report no duration — not a
// duration computed after the fact — matching what a component that mounts
// already-complete on the desktop does. The one deliberate omission is
// `useViewedInterval`'s focus/visibility gating (window/document DOM APIs
// that don't exist in React Native) — a backgrounded RN app's JS timers stop
// firing on their own, and every value here is re-derived from `Date.now()`
// on each tick rather than accumulated, so there's nothing to catch up when
// the app resumes foreground.
import { useEffect, useRef, useState } from 'react'

import { t } from '../lib/t'

const startedAtByKey = new Map<string, number>()
const durationByKey = new Map<string, number>()

function startedAt(key?: string): number {
  if (!key) {
    return Date.now()
  }

  const existing = startedAtByKey.get(key)

  if (existing !== undefined) {
    return existing
  }

  const now = Date.now()

  startedAtByKey.set(key, now)

  return now
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Seconds since the timer's origin, reported once a second while `active`. */
export function useElapsedSeconds(active = true, timerKey?: string, since?: number): number {
  const start = useRef(since ?? startedAt(timerKey))
  const lastKey = useRef(timerKey)
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - start.current) / 1000)))

  if (lastKey.current !== timerKey) {
    start.current = since ?? startedAt(timerKey)
    lastKey.current = timerKey
  }

  useEffect(() => {
    if (since !== undefined) {
      start.current = since
    } else if (timerKey) {
      start.current = startedAt(timerKey)
    }

    if (active) {
      setElapsed(Math.max(0, Math.floor((Date.now() - start.current) / 1000)))
    }
  }, [active, since, timerKey])

  useEffect(() => {
    if (!active) {
      return
    }

    const id = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - start.current) / 1000))), 1000)

    return () => clearInterval(id)
  }, [active])

  return elapsed
}

/**
 * How long something took, measured by watching it finish and remembered
 * afterwards. `null` until it has been watched at least once — a block
 * restored from history (or reasoning that arrived already complete) has no
 * duration and says so, rather than reporting a timer that never ran.
 */
export function useMeasuredDuration(active: boolean, timerKey: string): null | number {
  const elapsed = useElapsedSeconds(active, timerKey)
  const [watching, setWatching] = useState(false)
  const [measured, setMeasured] = useState<null | number>(() => durationByKey.get(timerKey) ?? null)

  useEffect(() => {
    if (active) {
      setWatching(true)
    } else if (watching) {
      const finalElapsed = Math.max(elapsed, Math.floor((Date.now() - startedAt(timerKey)) / 1000))

      setWatching(false)
      durationByKey.set(timerKey, finalElapsed)
      setMeasured(finalElapsed)
    }
  }, [active, elapsed, timerKey, watching])

  return measured
}

export function __resetElapsedTimerRegistryForTests() {
  startedAtByKey.clear()
  durationByKey.clear()
}

// Matches the desktop's four-way branch (`ThinkingDisclosure`, apps/desktop/
// src/components/assistant-ui/thread/message-parts.tsx:164-174): still
// streaming reads "Thinking"; finished with no measured duration (never
// watched running — restored history, or reasoning that arrived already
// complete) reads "Thought"; finished under 1s reads "Thought briefly";
// otherwise reads "Thought for {duration}". Pulled out of ReasoningDisclosure
// so it's a plain, unit-testable function — that .tsx file imports
// react-native, which this project's vitest config only stubs, not
// implements (src/test/react-native-stub.ts), so nothing importable from a
// .test.ts file can live there.
export function thoughtLabel(pending: boolean, thoughtFor: null | number): string {
  if (pending) {
    return t.assistant.thread.thinking
  }

  if (thoughtFor === null) {
    return t.assistant.thread.thought
  }

  if (thoughtFor < 1) {
    return t.assistant.thread.thoughtBriefly
  }

  return t.assistant.thread.thoughtFor(formatElapsed(thoughtFor))
}
