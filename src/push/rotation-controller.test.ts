import { describe, expect, it, vi } from 'vitest'

import { RotationListenerController } from './rotation-controller'

describe('push/rotation-controller RotationListenerController', () => {
  it('attaches on the first enabled=true', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(true)

    expect(attach).toHaveBeenCalledTimes(1)
    expect(detach).not.toHaveBeenCalled()
    expect(controller.isAttached()).toBe(true)
  })

  it('never attaches if the first value is enabled=false', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(false)

    expect(attach).not.toHaveBeenCalled()
    expect(controller.isAttached()).toBe(false)
  })

  it('detaches when toggled off after being on', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(true)
    controller.onEnabledChange(false)

    expect(detach).toHaveBeenCalledTimes(1)
    expect(controller.isAttached()).toBe(false)
  })

  it('re-attaches when toggled back on', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(true)
    controller.onEnabledChange(false)
    controller.onEnabledChange(true)

    expect(attach).toHaveBeenCalledTimes(2)
    expect(controller.isAttached()).toBe(true)
  })

  it('is idempotent — repeated true or false values attach/detach only once', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(true)
    controller.onEnabledChange(true)
    controller.onEnabledChange(true)

    expect(attach).toHaveBeenCalledTimes(1)

    controller.onEnabledChange(false)
    controller.onEnabledChange(false)

    expect(detach).toHaveBeenCalledTimes(1)
  })

  it('dispose detaches an attached listener', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(true)
    controller.dispose()

    expect(detach).toHaveBeenCalledTimes(1)
    expect(controller.isAttached()).toBe(false)
  })

  it('dispose is a no-op when nothing is attached', () => {
    const attach = vi.fn()
    const detach = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.dispose()

    expect(detach).not.toHaveBeenCalled()
  })

  /**
   * The regression this whole module exists for: once a token rotation fires while push is
   * enabled, the listener must not go on calling back after the user disables push — that
   * would silently re-register the device, contradicting settings.ts's "off unregisters"
   * contract (the bug fixed in 8f89171).
   */
  it('a rotation callback registered while attached never fires after detach', () => {
    let rotationCallback: (() => void) | undefined

    const attach = vi.fn(() => {
      rotationCallback = onRotate
    })

    const detach = vi.fn(() => {
      rotationCallback = undefined
    })

    const onRotate = vi.fn()
    const controller = new RotationListenerController({ attach, detach })

    controller.onEnabledChange(true)
    expect(rotationCallback).toBe(onRotate)

    controller.onEnabledChange(false)

    // The real hook's `detach()` calls `subscription.remove()`, which is exactly what makes a
    // later token rotation not reach `onRotate` at all — modeled here as the callback
    // reference itself being cleared.
    expect(rotationCallback).toBeUndefined()
  })
})

/**
 * `MountOnceListener` reconstructs the pre-8f89171 control flow verbatim from the diff: the
 * listener is attached exactly once, the moment `enabled` is first observed truthy, and is
 * never revisited on a later `false` — there was no code path that could detach it, because
 * attach/detach weren't modeled as a single piece of state at all (a `useRef` snapshot at
 * mount plus a wholly separate effect for register/unregister). Run through the SAME regression
 * scenario as the real controller above, this reconstruction fails it — proving the bug was
 * real and the fix (making "attached" one piece of state every enabled-change decision reads)
 * addresses it. Not exported; exists only for this one comparison.
 */
class MountOnceListener {
  private attachedOnce = false

  constructor(private readonly actions: { attach: () => void; detach: () => void }) {}

  // The pre-fix hook read `enabledRef.current` inside a mount-only effect (`useEffect(..., [])`)
  // — equivalent to "attach once, the first time this is called with true, and never again."
  onEnabledChange(enabled: boolean): void {
    if (enabled && !this.attachedOnce) {
      this.actions.attach()
      this.attachedOnce = true
    }
    // No `else` branch reachable from the mount-only effect: a later `false` had nothing wired
    // to it that would detach the rotation listener.
  }
}

describe('MountOnceListener (pre-8f89171 reconstruction) — demonstrates the bug was real', () => {
  it('FAILS the same regression scenario RotationListenerController passes', () => {
    let rotationCallback: (() => void) | undefined
    const onRotate = vi.fn()

    const legacy = new MountOnceListener({
      attach: () => {
        rotationCallback = onRotate
      },
      detach: () => {
        rotationCallback = undefined
      }
    })

    legacy.onEnabledChange(true)
    expect(rotationCallback).toBe(onRotate)

    legacy.onEnabledChange(false)

    // This is the bug: the callback is STILL attached after opt-out, because MountOnceListener
    // has no detach path at all. A real token rotation here would still call ensureRegistered()
    // and silently re-register the device.
    expect(rotationCallback).toBe(onRotate)
  })
})
