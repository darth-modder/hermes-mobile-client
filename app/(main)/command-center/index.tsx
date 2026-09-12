// Placeholder — full build (Usage) lands in this milestone's own
// "command center" commit (M14 task list order). Exists now only so the
// drawer row added in the drawer-order commit isn't a dead link. Not yet
// ported — see src/lib/route-replicates.test.ts's PENDING list.
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'

export default function CommandCenterScreen() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: tokens.background, flex: 1 }}>
      <ScreenHeader title={t.commandCenter.commandCenter} />
      <View />
    </SafeAreaView>
  )
}
