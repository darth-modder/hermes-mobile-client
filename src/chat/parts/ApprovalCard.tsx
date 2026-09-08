import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { respondApproval } from '../../gateway/session-connection'
import type { ApprovalRequest } from '../../gateway/session-stream-reducer'

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
    <View style={styles.container}>
      <Text style={styles.title}>Approval required</Text>
      <Text selectable style={styles.command}>
        {request.command}
      </Text>
      {request.description ? <Text style={styles.description}>{request.description}</Text> : null}
      {request.smartDenied ? <Text style={styles.smartDenied}>Flagged by the guardian — reduced to once/deny.</Text> : null}
      <View style={styles.row}>
        {choices.map(choice => (
          <TouchableOpacity
            disabled={pending !== null}
            key={choice}
            onPress={() => void respond(choice)}
            style={[styles.button, choice === 'deny' ? styles.buttonDeny : null]}
          >
            {pending === choice ? (
              <ActivityIndicator color="#f2f2f5" size="small" />
            ) : (
              <Text style={styles.buttonText}>{CHOICE_LABELS[choice] ?? choice}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonDeny: {
    backgroundColor: '#3a1f24'
  },
  buttonText: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '600'
  },
  command: {
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 4
  },
  container: {
    backgroundColor: '#1c1418',
    borderColor: '#e06c75',
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    padding: 12
  },
  description: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  smartDenied: {
    color: '#e06c75',
    fontSize: 12,
    marginBottom: 8
  },
  title: {
    color: '#e06c75',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  }
})
