import { Button, Stack, Text } from 'cordisx/ui'
import { petVisibleBalance } from './pet-balance.js'
import type { PetState } from './pet-domain.js'
import type { PetEconomyStatus } from './pet-economy.js'
import type { PetUsageStatus } from './pet-usage.js'
import type { WorkRewardStatus } from './pet-work-rewards.js'

export function PetWallet({ state, economy, usage, migrate, refresh, connect, busy, workRewards, connectSponsor }: {
  workRewards?: WorkRewardStatus
  connectSponsor?: () => void
  state: PetState
  economy?: PetEconomyStatus
  usage?: PetUsageStatus
  busy?: boolean
  migrate?: () => void
  refresh?: () => void
  connect?: () => void
}) {
  const balance = petVisibleBalance(state, economy)
  return (
    <Stack gap='small'>
      {connect && (
        <Button disabled={busy} onClick={connect}>{economy?.binding ? '重新授权共享钱包' : '连接共享钱包'}</Button>
      )}
      <Text>
        <strong>{balance === null ? '余额待同步' : `${balance.toLocaleString()} 宠物币`}</strong>
      </Text>
      {(state.economy || economy?.binding) && (
        <Text tone='muted'>
          共享实例 {state.economy?.binding.instanceId ?? economy?.binding?.instanceId} · 账户{' '}
          {state.economy?.binding.accountId ?? economy?.binding?.accountId}
        </Text>
      )}
      {economy?.status === 'ready' && (
        <Text tone='muted'>与游戏共用余额 · 冻结 {economy.wallet?.reserved ?? '待同步'} 币</Text>
      )}
      {economy?.status === 'migration-required' && (
        <>
          <Text tone='muted'>
            旧存档保留 {state.wallet.balance} 币。先备份，再由经济服务管理员按迁移政策批准；批准成功后启用共享购买。
          </Text>
          <Button disabled={busy} onClick={migrate}>备份并申请迁移</Button>
        </>
      )}
      {state.economy?.migration.status === 'pending' && (
        <Text tone='muted'>原始备份已保存，迁移待批准。宠物存档已保护，照顾计时暂停。</Text>
      )}
      {state.economy?.migration.status === 'pending' && (
        <Text tone='muted'>迁移申请摘要：{state.economy.migration.snapshotHash}</Text>
      )}
      {state.economy?.pending && <Text tone='muted'>购买待对账；物品收据可恢复。请恢复原订单后再购买。</Text>}
      {economy?.status === 'unavailable' && <Text tone='muted'>{economy.reason}</Text>}
      {(state.economy || economy?.binding) && (
        <Button variant='ghost' disabled={busy} onClick={refresh}>同步钱包与恢复事务</Button>
      )}
      {connectSponsor && <Button disabled={busy} onClick={connectSponsor}>授权工作奖励赞助服务</Button>}
      <Text tone='muted'>{workRewards?.reason ?? '工作奖励未配置赞助连接；期间用量不补发'}</Text>
      {workRewards?.earned !== undefined && <Text tone='muted'>共享工作奖励累计 {workRewards.earned} 币</Text>}
      <Text tone='muted'>
        {usage?.status === 'ready'
          ? '仅统计可归因的正常根任务工作；游戏、分叉、子任务和未知来源不计入。'
          : usage?.status === 'unavailable' && usage.reason === 'permission-denied'
          ? '使用奖励未开启。可在插件权限中管理。'
          : '有效工作用量暂不可用；恢复后建立新基线，不补发期间用量。'}
      </Text>
    </Stack>
  )
}
