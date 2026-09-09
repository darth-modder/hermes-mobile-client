/**
 * Pure control-flow for whether the Expo push-token rotation listener should be attached —
 * extracted from usePushRegistration.ts so the bug fixed in 8f89171 (a stale rotation listener
 * kept firing after the user disabled push, silently re-registering the device) has a unit a
 * test can pin down. Nothing in this repo has a React-render test harness
 * (no `@testing-library/react-native`), so `usePushRegistration.ts` itself stays untested by
 * the same convention as `useNotifications.ts` — this is the part of it worth protecting on
 * its own.
 *
 * The bug: the pre-fix hook attached the rotation listener once, in an effect that ran only at
 * mount, gated on whatever `$pushEnabled` happened to be *at that instant*. Toggling push off
 * later never detached it (a separate effect handled un/registering the device, entirely
 * independently), so a token rotation after opt-out still called `ensureRegistered()` and
 * silently re-registered the device — the exact contrary of `settings.ts`'s "off unregisters"
 * contract. This controller makes "attached" an explicit, single piece of state that every
 * enabled-change decision reads and updates, so attach/detach can never drift out of sync with
 * the current enabled value the way two independent effects did.
 */

export interface RotationListenerActions {
  attach: () => void
  detach: () => void
}

export class RotationListenerController {
  private attached = false

  constructor(private readonly actions: RotationListenerActions) {}

  isAttached(): boolean {
    return this.attached
  }

  /** Call on every `$pushEnabled` value, including the initial one — idempotent either way
   *  (attaching when already attached, or detaching when already detached, is a no-op). */
  onEnabledChange(enabled: boolean): void {
    if (enabled) {
      if (!this.attached) {
        this.actions.attach()
        this.attached = true
      }

      return
    }

    if (this.attached) {
      this.actions.detach()
      this.attached = false
    }
  }

  /** Call on unmount. */
  dispose(): void {
    if (this.attached) {
      this.actions.detach()
      this.attached = false
    }
  }
}
