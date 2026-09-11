import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { respondApproval } from '../../gateway/session-connection'
import type { ApprovalRequest } from '../../gateway/session-stream-reducer'
import { hapticApprove, hapticReject } from '../../lib/haptics'
import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

const CHOICE_LABELS: Record<string, string> = {
  once: 'Run',
  session: 'Allow this session',
  always: 'Always allow',
  deny: 'Reject'
}

export interface ApprovalCardProps {
  storedSessionId: string
  request: ApprovalRequest
}

/** A dangerous-command / execute_code approval blocking the agent thread —
 *  the Python side is parked on `approval.respond` until one of these fires. */
export function ApprovalCard({ storedSessionId, request }: ApprovalCardProps) {
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
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.destructive }]}>
      <Text style={[styles.title, { color: tokens.destructive }]}>Approval required</Text>
      <Text selectable style={[styles.command, { color: tokens.foreground }]}>
        {request.command}
      </Text>
      {request.description ? (
        <Text style={[styles.description, { color: tokens.mutedForeground }]}>{request.description}</Text>
      ) : null}
      {request.smartDenied ? (
        <Text style={[styles.smartDenied, { color: tokens.destructive }]}>
          Flagged by the guardian — reduced to once/deny.
        </Text>
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
