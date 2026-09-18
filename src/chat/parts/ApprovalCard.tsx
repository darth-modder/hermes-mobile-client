import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

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
  request: ApprovalRequest
}

/** A dangerous-command / execute_code approval blocking the agent thread —
 *  the Python side is parked on `approval.respond` until one of these fires.
 *  Split into Body/Actions (D25) so InputDock.tsx can scroll the former and
 *  pin the latter — the buttons must stay on screen without depending on
 *  scroll position. */
export function ApprovalCardBody({ request }: ApprovalCardProps) {
  const tokens = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.destructive }]}>
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
    </View>
  )
}

export interface ApprovalCardActionsProps extends ApprovalCardProps {
  storedSessionId: string
}

export function ApprovalCardActions({ storedSessionId, request }: ApprovalCardActionsProps) {
  const tokens = useTheme()
  const [pending, setPending] = useState<null | string>(null)
  const choices = request.choices?.length ? request.choices : ['once', 'deny']

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
    <View style={styles.row}>
      {choices.map(choice => (
        <TouchableOpacity
          disabled={pending !== null}
          key={choice}
          onPress={() => void respond(choice)}
          style={[styles.button, { backgroundColor: choice === 'deny' ? tokens.diffRemoveBackground : tokens.primary }]}
        >
          {pending === choice ? (
            <ActivityIndicator color={choice === 'deny' ? tokens.destructive : tokens.primaryForeground} size="small" />
          ) : (
            <Text
              style={[styles.buttonText, { color: choice === 'deny' ? tokens.destructive : tokens.primaryForeground }]}
            >
              {CHOICE_LABELS[choice] ?? choice}
            </Text>
          )}
        </TouchableOpacity>
      ))}
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
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
