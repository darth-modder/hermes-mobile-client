import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { respondApproval } from '../../gateway/session-connection'
import type { ApprovalRequest } from '../../gateway/session-stream-reducer'
import { useTheme } from '../../theme/provider'

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
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  command: {
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 4
  },
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    padding: 12
  },
  description: {
    fontSize: 12,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  smartDenied: {
    fontSize: 12,
    marginBottom: 8
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  }
})
