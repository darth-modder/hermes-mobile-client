import { describe, expect, it } from 'vitest'

import type { SessionInfo, SessionMessage } from '../upstream/types/hermes'

import { collectArtifactsForSession } from './artifacts'

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    ended_at: null,
    id: 'sess-1',
    last_active: 1_700_000_000,
    message_count: 0,
    source: 'android',
    started_at: 1_700_000_000,
    title: 'Test session',
    ...overrides
  } as SessionInfo
}

function message(overrides: Partial<SessionMessage> = {}): SessionMessage {
  return { content: '', role: 'assistant', ...overrides } as SessionMessage
}

describe('collectArtifactsForSession', () => {
  it('finds a markdown image in an assistant reply', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: 'Here you go: ![a cat](https://example.com/cat.png)', role: 'assistant' })
    ])

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]).toMatchObject({ kind: 'image', label: 'cat.png', value: 'https://example.com/cat.png' })
  })

  it('finds a bare https link as a link artifact, not a file', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: 'See https://example.com/report for details.', role: 'assistant' })
    ])

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].kind).toBe('link')
  })

  it('ignores plain assistant prose with no path/url/media marker', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: 'The answer is 42, no files involved.', role: 'assistant' })
    ])

    expect(artifacts).toHaveLength(0)
  })

  it('picks up a strong tool-result key (saved_to) from a producer tool', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({
        content: JSON.stringify({ saved_to: '/tmp/output/report.pdf' }),
        role: 'tool',
        tool_name: 'export_report'
      })
    ])

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]).toMatchObject({ kind: 'file', value: '/tmp/output/report.pdf' })
  })

  it('ignores a non-producer tool result with a generic key name', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: JSON.stringify({ path: '/tmp/scratch.txt' }), role: 'tool', tool_name: 'list_directory' })
    ])

    expect(artifacts).toHaveLength(0)
  })

  it('parses a browser_vision screenshot path line', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: 'Screenshot path: /tmp/screens/page-1.png\nDone.', role: 'tool', tool_name: 'browser_vision' })
    ])

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]).toMatchObject({ kind: 'image', value: '/tmp/screens/page-1.png' })
  })

  it('dedupes the same value seen twice in one session', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: 'https://example.com/x.png https://example.com/x.png', role: 'assistant' })
    ])

    expect(artifacts).toHaveLength(1)
  })

  it('skips user and system rows entirely', () => {
    const artifacts = collectArtifactsForSession(session(), [
      message({ content: 'https://example.com/x.png', role: 'user' }),
      message({ content: 'https://example.com/y.png', role: 'system' })
    ])

    expect(artifacts).toHaveLength(0)
  })
})
