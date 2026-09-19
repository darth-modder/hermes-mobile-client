// Pure logic for the blocking-input dock (D25): which of the four blocking
// cards (secret, sudo, approval, clarify) show, in what order, and how tall
// the dock is allowed to get. Kept out of InputDock.tsx so the ordering rule
// is unit-testable without mounting KeyboardStickyView/ScrollView.

/** D25.3: "about half the window height." */
export const DOCK_HEIGHT_FRACTION = 0.5

export type DockCardKind = 'approval' | 'clarify' | 'secret' | 'sudo'

/** D25.4: with more than one request pending, today's stacking order holds:
 *  secret, sudo, approval, clarify. */
const ORDER: DockCardKind[] = ['secret', 'sudo', 'approval', 'clarify']

export function dockedCardOrder(present: Record<DockCardKind, boolean>): DockCardKind[] {
  return ORDER.filter(kind => present[kind])
}
