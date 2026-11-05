import { useState, useEffect, useCallback } from 'react'
import { CoinIcon, StampIcon, GiftIcon, CoffeeIcon } from './icons'
import { API_URL } from '../../config'
import { formatCurrency, formatNumber } from '../../i18n/localeFormat' // dostosuj ścieżkę jeśli inna
import { useI18n } from '../../i18n/I18nProvider'

interface RewardItem {
  id: string
  name: string
  cost_points: number
}

type LoyaltyMode = 'points' | 'stamps'

interface Props {
  cafeId: string
  mode: LoyaltyMode
  stampsMax: number
  stampsEarnDesc: string | null
  stampsRewardDesc: string | null
  rewards: RewardItem[]
  requireLogin: (action: () => void) => void
  authToken: string | null
  previewMode?: boolean
}

interface BalanceOut {
  points: number
  stamps: number
}

function StampsTrack({ stamps, max }: { stamps: number; max: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${i < stamps ? 'var(--gold)' : 'var(--border)'}`,
          background: i < stamps ? 'var(--gold)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: i < stamps ? '#fff' : 'var(--text-muted)', flexShrink: 0,
        }}>
          {i < stamps ? <CoffeeIcon size={14} /> : null}
        </div>
      ))}
    </div>
  )
}

export default function LoyaltyWidget({
  cafeId, mode, stampsMax, stampsEarnDesc, stampsRewardDesc, rewards,
  requireLogin, authToken, previewMode = false,
}: Props) {
  const { t, fmt } = useI18n()
  const [balance, setBalance] = useState<BalanceOut | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!authToken || previewMode) { setBalance(null); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/loyalty/client/${cafeId}/mine`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setBalance(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [cafeId, authToken, previewMode])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  const sortedRewards = rewards.slice().sort((a, b) => a.cost_points - b.cost_points)
  const nextReward = balance && mode === 'points'
    ? sortedRewards.find(r => r.cost_points > balance.points)
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Jak to działa */}
      {mode === 'points' ? (
        <p className="cp-muted-note" style={{ fontStyle: 'normal', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <CoinIcon size={16} className="cp-inline-icon" />
          <span>
            {t('loyalty.how_points', { amount: formatCurrency(0.1, fmt) })}
          </span>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stampsEarnDesc && (
            <p className="cp-muted-note" style={{ fontStyle: 'normal', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <StampIcon size={16} className="cp-inline-icon" />
              <span>{t('loyalty.stamp_earn', { desc: stampsEarnDesc })}</span>
            </p>
          )}
          {stampsRewardDesc && (
            <p className="cp-muted-note" style={{ fontStyle: 'normal', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <GiftIcon size={16} className="cp-inline-icon" />
              <span>{t('loyalty.stamp_reward', { max: stampsMax, desc: stampsRewardDesc })}</span>
            </p>
          )}
        </div>
      )}

      {/* Nagrody (tylko tryb punktowy) */}
      {mode === 'points' && sortedRewards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {sortedRewards.map(r => (
            <div
              key={r.id}
              className="res-table-row"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span className="lw-reward-name">{r.name}</span>
              <span className="lw-reward-cost">
                {t('loyalty.points', { points: formatNumber(r.cost_points, fmt) })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Twój stan */}
      {authToken && !previewMode ? (
        loading ? (
          <div className="loading-state" style={{ padding: '1rem' }}>
            <div className="loading-spinner" />
          </div>
        ) : balance ? (
          mode === 'points' ? (
            <div className="res-table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div className="lw-label">{t('loyalty.your_balance')}</div>
                <div className="lw-value">
                  {t('loyalty.points', { points: formatNumber(balance.points, fmt) })}
                </div>
              </div>
              {nextReward && (
                <span className="lw-hint">
                  {t('loyalty.next_reward', {
                    name: nextReward.name,
                    points: formatNumber(nextReward.cost_points - balance.points, fmt),
                  })}
                </span>
              )}
            </div>
          ) : (
            <div className="res-table-row">
              <div className="lw-label" style={{ marginBottom: '0.625rem' }}>
                {t('loyalty.stamp_card')}
              </div>
              <StampsTrack stamps={balance.stamps} max={stampsMax} />
              <div className="lw-hint" style={{ marginTop: '0.625rem' }}>
                {t('loyalty.stamps_progress', { count: balance.stamps, max: stampsMax })}
                {balance.stamps >= stampsMax && ` · ${t('loyalty.reward_ready')}`}
              </div>
            </div>
          )
        ) : null
      ) : (
        <button
          type="button"
          className="btn btn--outline-dark"
          style={{ width: 'auto' }}
          onClick={() => { if (!previewMode) requireLogin(() => {}) }}
          disabled={previewMode}
          title={previewMode ? t('preview.unavailable') : undefined}
        >
          {t('loyalty.login_cta')}
        </button>
      )}
    </div>
  )
}