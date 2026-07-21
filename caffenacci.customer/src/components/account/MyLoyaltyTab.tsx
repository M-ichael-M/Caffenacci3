import { useState, useEffect, useCallback } from 'react'
import { Gift, Coffee, RefreshCw, PartyPopper } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface RewardItem {
  id: string
  name: string
  cost_points: number
}

interface CafeLoyaltyItem {
  cafe_id: string
  cafe_name: string
  logo_url: string | null
  mode: 'points' | 'stamps'
  points: number
  stamps: number
  stamps_max: number
  rewards: RewardItem[]
}

interface Props { token: string }

const API = 'http://localhost:8000'

// ── Ślad pieczątek ────────────────────────────────────────────────────────

function StampsTrack({ stamps, max }: { stamps: number; max: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 26, height: 26, borderRadius: '50%',
          border: `2px solid ${i < stamps ? 'var(--gold)' : 'var(--border)'}`,
          background: i < stamps ? 'var(--gold)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: i < stamps ? '#fff' : 'var(--text-muted)', flexShrink: 0,
        }}>
          {i < stamps ? <Coffee size={13} /> : null}
        </div>
      ))}
    </div>
  )
}

// ── Karta kawiarni ────────────────────────────────────────────────────────

function CafeLoyaltyCard({ c }: { c: CafeLoyaltyItem }) {
  const nextReward = c.mode === 'points'
    ? c.rewards.filter(r => r.cost_points > c.points).sort((a, b) => a.cost_points - b.cost_points)[0]
    : undefined
  const stampsReady = c.mode === 'stamps' && c.stamps >= c.stamps_max
  const pointsReady = c.mode === 'points' && c.rewards.length > 0 && !nextReward

  return (
    <div className="entity-card">
      <div className="entity-card__body" style={{ alignItems: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-2)', color: 'var(--gold)',
        }}>
          {c.logo_url ? (
            <img src={`${API}${c.logo_url}`} alt={c.cafe_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Coffee size={20} />
          )}
        </div>

        <div className="entity-card__main">
          <div className="entity-card__header">
            <span className="entity-card__cafe">{c.cafe_name}</span>
          </div>

          {c.mode === 'points' ? (
            <>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold)', marginTop: '0.25rem' }}>
                {c.points} pkt.
              </div>
              {c.rewards.length > 0 && (
                <div className="entity-card__sub" style={{ marginTop: '0.375rem' }}>
                  {pointsReady && <PartyPopper size={13} />}
                  {nextReward
                    ? `Do nagrody „${nextReward.name}" brakuje ${nextReward.cost_points - c.points} pkt.`
                    : 'Masz wystarczająco punktów na dostępną nagrodę!'}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <StampsTrack stamps={c.stamps} max={c.stamps_max} />
              <div className="entity-card__sub" style={{ marginTop: '0.5rem' }}>
                {stampsReady && <PartyPopper size={13} />}
                {c.stamps} / {c.stamps_max} pieczątek
                {stampsReady && ' · nagroda gotowa do odebrania!'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════

export default function MyLoyaltyTab({ token }: Props) {
  const [cafes, setCafes]     = useState<CafeLoyaltyItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/loyalty/client/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCafes(data.cafes ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Wczytywanie Twoich kawiarni…</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">Twoje konto</div>
          <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>Moje kawiarnie</h1>
        </div>
        <button className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={fetchAll}>
          <RefreshCw size={15} />
          Odśwież
        </button>
      </div>

      {cafes.length === 0 ? (
        <div className="res-empty-card">
          <div className="res-empty-icon"><Gift size={44} strokeWidth={1.4} /></div>
          <div className="res-empty-title">Brak punktów i pieczątek</div>
          <div className="res-empty-sub">
            Pokaż swój kod lojalnościowy w kawiarni przy zakupie, aby zacząć zbierać punkty lub pieczątki.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {cafes.map(c => <CafeLoyaltyCard key={c.cafe_id} c={c} />)}
        </div>
      )}
    </div>
  )
}
