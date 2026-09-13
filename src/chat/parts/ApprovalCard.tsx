import { useRef, useState } from 'react'
import { ActivityIndicator, type LayoutRectangle, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { respondApproval } from '../../gateway/session-connection'
import type { ApprovalRequest } from '../../gateway/session-stream-reducer'
import { hapticApprove, hapticReject } from '../../lib/haptics'
import { APPROVAL_CARD_SMART_DENIED_NOTICE, APPROVAL_CARD_TITLE } from '../../lib/strings.mobile'
import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

const CHOICE_LABELS: Record<string, string> = {
  once: 'Run',
  session: 'Allow this session',
  always: 'Always allow',
  deny: 'Reject'
}

export interface ApprovalCardProps {
  /** Set by Transcript.tsx's `ListHeaderComponent` wrapper — __DEV__ only,
   *  read once here to log the header row's own layout alongside the
   *  card's, for diagnosing a future recurrence of the round-2/3 overlap
   *  glitch (M14 close-out round 3, task 3). Never read in a release build. */
  parentLayoutRef?: { current: LayoutRectangle | null }
  storedSessionId: string
  request: ApprovalRequest
}

/** A dangerous-command / execute_code approval blocking the agent thread —
 *  the Python side is parked on `approval.respond` until one of these fires. */
export function ApprovalCard({ parentLayoutRef, storedSessionId, request }: ApprovalCardProps) {
  const tokens = useTheme()
  const [pending, setPending] = useState<null | string>(null)
  const choices = request.choices?.length ? request.choices : ['once', 'deny']
  const loggedLayout = useRef(false)

  // __DEV__-only diagnostic, logged once per card mount (not on every
  // relayout — a resize/rotation isn't the case this is watching for). The
  // bug this exists for (round 2: card rendered with a dark overlay covering
  // most of it; round 3: not reproduced in 5 attempts, see the M14 doc's
  // task 3 entry) was never caught with an overlapping-sibling dump — this
  // gives the next occurrence one. `View.props.onLayout` always exists on
  // every platform build; the guard below is what keeps this out of
  // release, not the prop itself.
  const onLayout = __DEV__
    ? (event: { nativeEvent: { layout: LayoutRectangle } }) => {
        if (loggedLayout.current) {
          return
        }

        loggedLayout.current = true
        console.log('[approval-card-layout] card', event.nativeEvent.layout)
        console.log('[approval-card-layout] parent row', parentLayoutRef?.current ?? 'unavailable')
      }
    : undefined

  const respond = async (choice: string) => {
    if (choice === 'deny') {
      hapticReject()
    } else {
      hapticApprove()
    }

    setPending(choice)

    try {
      await respondApproval(storedSessionId, choice, { requestId: request.requestId })
    } finally {
      setPending(null)
    }
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.destructive }]}
    >
      <Text style={[styles.title, { color: tokens.destructive }]}>{APPROVAL_CARD_TITLE}</Text>
      <Text selectable style={[styles.command, { color: tokens.foreground }]}>
        {request.command}
      </Text>
      {request.description ? (
        <Text style={[styles.description, { color: tokens.mutedForeground }]}>{request.description}</Text>
      ) : null}
      {request.smartDenied ? (
        <Text style={[styles.smartDenied, { color: tokens.destructive }]}>{APPROVAL_CARD_SMART_DENIED_NOTICE}</Text>
      ) : null}
      <View style={styles.row}>
        {choices.map(choice => (
          <TouchableOpacity
            disabled={pending !== null}
            key={choice}
            onPress={() => void respond(choice)}
            style={[
              styles.button,
              { backgroundColor: choice === 'deny' ? tokens.diffRemoveBackground : tokens.primary }
            ]}
          >
            {pending === choice ? (
              <ActivityIndicator
                color={choice === 'deny' ? tokens.destructive : tokens.primaryForeground}
                size="small"
              />
            ) : (
              <Text
                style={[
                  styles.buttonText,
                  { color: choice === 'deny' ? tokens.destructive : tokens.primaryForeground }
                ]}
              >
                {CHOICE_LABELS[choice] ?? choice}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    ...type.label,
    fontWeight: '600'
  },
  command: {
    ...type.mono,
    marginBottom: 4
  },
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginVertical: 6,
    padding: 12
  },
  description: {
    ...type.caption,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  smartDenied: {
    ...type.caption,
    marginBottom: 8
  },
  title: {
    ...type.label,
    fontWeight: '700',
    marginBottom: 6
  }
})
