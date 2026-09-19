import { useStore } from '@nanostores/react'
import { usePreventScreenCapture } from 'expo-screen-capture'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'

import { $clarifyRequests } from '../store/clarify'
import { $approvalRequests, $secretRequests, $sudoRequests } from '../store/prompts'
import { useTheme } from '../theme/provider'

import { DOCK_HEIGHT_FRACTION, type DockCardKind, dockedCardOrder } from './input-dock'
import { ApprovalCardActions, ApprovalCardBody } from './parts/ApprovalCard'
import { ClarifyCardActions, ClarifyCardBody } from './parts/ClarifyCard'
import { SecretCardActions, SecretCardBody } from './parts/SecretCard'
import { SudoCardActions, SudoCardBody } from './parts/SudoCard'

/** Screen capture is blocked for as long as a sudo/secret card is mounted,
 *  regardless of which half (Body/Actions) of it holds the sensitive field —
 *  a single guard mounted alongside both, keyed the same as before the D25
 *  split, so `dumpsys` still sees exactly one FLAG_SECURE source per card. */
function ScreenCaptureGuard({ tag }: { tag: string }) {
  usePreventScreenCapture(tag)

  return null
}

export interface InputDockProps {
  storedSessionId: string
}

/**
 * D25: the blocking-input dock. Approval, sudo, secret and clarify no
 * longer mount inside the transcript's FlashList (where
 * `maintainVisibleContentPosition` could carry them off screen, D20 item 6)
 * — they render here instead, above the composer, independent of scroll
 * position. Height-capped at `DOCK_HEIGHT_FRACTION` of the window: each
 * card's read-only body scrolls inside the cap, but every card's answer
 * controls (buttons, Send, choices) stay in the fixed footer below the
 * scroll area so they're never scrolled out of reach.
 *
 * `accessibilityLiveRegion="assertive"` so TalkBack announces the dock the
 * moment it mounts — a blocking request is the one thing on this screen a
 * screen-reader user must not miss.
 */
export function InputDock({ storedSessionId }: InputDockProps) {
  const tokens = useTheme()
  const { height } = useWindowDimensions()

  const secret = useStore($secretRequests)[storedSessionId]
  const sudo = useStore($sudoRequests)[storedSessionId]
  const approval = useStore($approvalRequests)[storedSessionId]
  const clarify = useStore($clarifyRequests)[storedSessionId]

  const order = dockedCardOrder({
    approval: Boolean(approval),
    clarify: Boolean(clarify),
    secret: Boolean(secret),
    sudo: Boolean(sudo)
  })

  if (order.length === 0) {
    return null
  }

  const renderBody = (kind: DockCardKind) => {
    switch (kind) {
      case 'secret':
        return secret ? <SecretCardBody key={kind} request={secret} /> : null

      case 'sudo':
        return sudo ? <SudoCardBody key={kind} request={sudo} /> : null

      case 'approval':
        return approval ? <ApprovalCardBody key={kind} request={approval} /> : null

      case 'clarify':
        return clarify ? <ClarifyCardBody key={kind} request={clarify} /> : null
    }
  }

  const renderActions = (kind: DockCardKind) => {
    switch (kind) {
      case 'secret':
        return secret ? <SecretCardActions key={kind} request={secret} storedSessionId={storedSessionId} /> : null

      case 'sudo':
        return sudo ? <SudoCardActions key={kind} request={sudo} storedSessionId={storedSessionId} /> : null

      case 'approval':
        return approval ? <ApprovalCardActions key={kind} request={approval} storedSessionId={storedSessionId} /> : null

      case 'clarify':
        return clarify ? <ClarifyCardActions key={kind} request={clarify} storedSessionId={storedSessionId} /> : null
    }
  }

  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[
        styles.container,
        { backgroundColor: tokens.background, borderTopColor: tokens.border, maxHeight: height * DOCK_HEIGHT_FRACTION }
      ]}
    >
      {secret ? <ScreenCaptureGuard tag="secret-card" /> : null}
      {sudo ? <ScreenCaptureGuard tag="sudo-card" /> : null}
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        {order.map(renderBody)}
      </ScrollView>
      <View style={[styles.actions, { borderTopColor: tokens.border }]}>{order.map(renderActions)}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth
  },
  container: {
    borderTopWidth: StyleSheet.hairlineWidth
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8
  }
})
