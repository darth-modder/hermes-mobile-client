import { expect, test } from 'vitest'

import { checkRuntimeCapabilities } from './polyfills'

test('reports a boolean for every checked global', () => {
  const result = checkRuntimeCapabilities()

  expect(Object.keys(result).sort()).toEqual(['AbortSignal', 'DOMException', 'URL', 'URLSearchParams', 'WebSocket'])

  for (const value of Object.values(result)) {
    expect(typeof value).toBe('boolean')
  }
})
