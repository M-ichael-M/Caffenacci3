import { useState, useEffect, useCallback } from 'react'

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
          fontSize: '0.8125rem', color: i < stamps ? '#fff' : 'var(--text-muted)', flexShrink: 0,
        }}>
          {i < stamps ? '☕' : ''}
        </div>
      ))}
    </div>
  )
}

export default function LoyaltyWidget({
  cafeId, mode, stampsMax, stampsEarnDesc, stampsRewardDesc, rewards,
  requireLogin, authToken,
}: Props) {
  const [balance, setBalance] = useState<BalanceOut | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!authToken) { setBalance(null); return }
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:8000/loyalty/client/${cafeId}/mine`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setBalance(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [cafeId, authToken])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  const sortedRewards = rewards.slice().sort((a, b) => a.cost_points - b.cost_points)
  const nextReward = balance && mode === 'points'
    ? sortedRewards.find(r => r.cost_points > balance.points)
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Jak to działa */}
      {mode === 'points' ? (
        <p className="cp-muted-note" style={{ fontStyle: 'normal' }}>
          🪙 Zbieraj punkty za każdy zakup w naszej kawiarni — 3 punkty za każde wydane 10 groszy.
          Wymieniaj je na nagrody wskazane poniżej.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {stampsEarnDesc && (
            <p className="cp-muted-note" style={{ fontStyle: 'normal' }}>🔖 Pieczątkę otrzymujesz {stampsEarnDesc}.</p>
          )}
          {stampsRewardDesc && (
            <p className="cp-muted-note" style={{ fontStyle: 'normal' }}>
              🎁 Po zebraniu {stampsMax} pieczątek otrzymujesz: {stampsRewardDesc}.
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
              <span style={{ fontSize: '0.9375rem', color: 'var(--text-dark)', fontWeight: 600 }}>{r.name}</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--gold)', fontWeight: 700 }}>{r.cost_points} pkt.</span>
            </div>
          ))}
        </div>
      )}

      {/* Twój stan */}
      {authToken ? (
        loading ? (
          <div className="loading-state" style={{ padding: '1rem' }}>
            <div className="loading-spinner" />
          </div>
        ) : balance ? (
          mode === 'points' ? (
            <div className="res-table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Twój stan
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                  {balance.points} pkt.
                </div>
              </div>
              {nextReward && (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Do nagrody „{nextReward.name}" brakuje {nextReward.cost_points - balance.points} pkt.
                </span>
              )}
            </div>
          ) : (
            <div className="res-table-row">
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>
                Twoja karta pieczątek
              </div>
              <StampsTrack stamps={balance.stamps} max={stampsMax} />
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.625rem' }}>
                {balance.stamps} / {stampsMax} pieczątek
                {balance.stamps >= stampsMax && ' · nagroda gotowa do odebrania! 🎉'}
              </div>
            </div>
          )
        ) : null
      ) : (
        <button
          type="button"
          className="btn btn--outline-dark"
          style={{ width: 'auto' }}
          onClick={() => requireLogin(() => {})}
        >
          Zaloguj się, aby zobaczyć swój stan
        </button>
      )}
    </div>
  )
}