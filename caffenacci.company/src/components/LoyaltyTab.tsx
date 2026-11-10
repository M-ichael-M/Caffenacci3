import { useState, useEffect, useCallback } from 'react'
import { Gift, Receipt, Coins, Bookmark, X } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'

// ── Types ─────────────────────────────────────────────────────────────────

type LoyaltyMode = 'points' | 'stamps'

interface RewardDraft {
  _uid: string
  id?: string
  name: string
  cost_points: string
}

interface RewardOut {
  id: string
  name: string
  cost_points: number
}

interface LoyaltySettingsData {
  id: string
  cafe_id: string
  enabled: boolean
  mode: LoyaltyMode
  stamps_max: number
  stamps_earn_desc: string | null
  stamps_reward_desc: string | null
  rewards: RewardOut[]
}

interface LookupResult {
  client_nick: string
  full_name: string
  loyalty_code: string
  mode: LoyaltyMode
  points: number
  stamps: number
  stamps_max: number
  rewards: RewardOut[]
}

interface Props {
  token: string
}

const API = API_URL

class ApiError extends Error {}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── Toggle (spójny z resztą aplikacji) ───────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        opacity: disabled ? 0.5 : 1,
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--gold-soft)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function LoyaltyTab({ token }: Props) {
  const { t, tApi } = useI18n()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [enabled, setEnabled]   = useState(false)
  const [mode, setMode]         = useState<LoyaltyMode>('points')
  const [rewards, setRewards]   = useState<RewardDraft[]>([])
  const [stampsMax, setStampsMax] = useState(10)
  const [stampsEarnDesc, setStampsEarnDesc]     = useState('')
  const [stampsRewardDesc, setStampsRewardDesc] = useState('')

  // ── Kasa ──────────────────────────────────────────────────────────────
  const [searchCode, setSearchCode]   = useState('')
  const [searching, setSearching]     = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [lookup, setLookup]           = useState<LookupResult | null>(null)
  const [txAmount, setTxAmount]       = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg]     = useState<string | null>(null)

  // Błąd z API → przetłumaczony komunikat; inny wyjątek → komunikat ogólny.
  const failIfNotOk = async (res: Response, fallbackKey: string) => {
    if (res.ok) return
    const e = await res.json().catch(() => null)
    throw new ApiError(tApi(e?.detail, fallbackKey))
  }
  const messageOf = (err: unknown, fallbackKey?: string) =>
    err instanceof ApiError ? err.message : t(fallbackKey ?? 'common.genericError')

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/loyalty/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: LoyaltySettingsData = await res.json()
        setEnabled(data.enabled)
        setMode(data.mode)
        setStampsMax(data.stamps_max)
        setStampsEarnDesc(data.stamps_earn_desc ?? '')
        setStampsRewardDesc(data.stamps_reward_desc ?? '')
        setRewards(data.rewards.map(r => ({ _uid: uid(), id: r.id, name: r.name, cost_points: String(r.cost_points) })))
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  // ── Rewards mutations ─────────────────────────────────────────────────

  const addReward = () => setRewards(prev => [...prev, { _uid: uid(), name: '', cost_points: '' }])
  const removeReward = (u: string) => setRewards(prev => prev.filter(r => r._uid !== u))
  const updateReward = (u: string, patch: Partial<RewardDraft>) =>
    setRewards(prev => prev.map(r => r._uid === u ? { ...r, ...patch } : r))

  // ── Save settings ─────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveMsg(null)

    if (mode === 'points') {
      for (const r of rewards) {
        if (!r.name.trim()) { setSaveMsg({ type: 'err', text: t('loyalty.err.rewardName') }); return }
        const cost = parseInt(r.cost_points, 10)
        if (isNaN(cost) || cost < 1) { setSaveMsg({ type: 'err', text: t('loyalty.err.rewardCost', { name: r.name }) }); return }
      }
    }

    setSaving(true)
    try {
      const body = {
        enabled,
        mode,
        stamps_max: stampsMax,
        stamps_earn_desc: stampsEarnDesc.trim() || null,
        stamps_reward_desc: stampsRewardDesc.trim() || null,
        rewards: rewards.map((r, i) => ({
          name: r.name.trim(),
          cost_points: parseInt(r.cost_points, 10) || 0,
          position: i,
        })),
      }
      const res = await fetch(`${API}/loyalty/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      await failIfNotOk(res, 'loyalty.err.save')
      await fetchSettings()
      setSaveMsg({ type: 'ok', text: t('loyalty.saved') })
    } catch (err: unknown) {
      setSaveMsg({ type: 'err', text: messageOf(err, 'loyalty.err.save') })
    } finally { setSaving(false) }
  }

  // ── Kasa: wyszukiwanie klienta ──────────────────────────────────────────

  const handleSearch = async () => {
    setSearchError(null)
    setLookup(null)
    setActionMsg(null)
    const code = searchCode.trim().toUpperCase()
    if (code.length !== 8) { setSearchError(t('loyalty.err.codeLength')); return }

    setSearching(true)
    try {
      const res = await fetch(`${API}/loyalty/lookup/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await failIfNotOk(res, 'loyalty.err.lookup')
      setLookup(await res.json())
    } catch (err: unknown) {
      setSearchError(messageOf(err, 'loyalty.err.lookup'))
    } finally { setSearching(false) }
  }

  const refreshLookup = async () => {
    if (!lookup) return
    try {
      const res = await fetch(`${API}/loyalty/lookup/${lookup.loyalty_code}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setLookup(await res.json())
    } catch { /* ignore */ }
  }

  /** Wspólny wzorzec dla operacji przy kasie: POST → odśwież saldo → komunikat. */
  const runAction = async (path: string, body: object, okKey: string, after?: () => void) => {
    if (!lookup) return
    setActionLoading(true)
    setActionMsg(null)
    try {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      await failIfNotOk(res, 'loyalty.err.operation')
      after?.()
      await refreshLookup()
      setActionMsg(t(okKey))
    } catch (err: unknown) {
      setActionMsg(messageOf(err, 'loyalty.err.operation'))
    } finally { setActionLoading(false) }
  }

  const handleEarn = () => {
    if (!lookup) return
    const amount = parseFloat(txAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) { setActionMsg(t('loyalty.err.amount')); return }
    runAction('/loyalty/earn', { loyalty_code: lookup.loyalty_code, amount }, 'loyalty.msg.earned', () => setTxAmount(''))
  }

  const handleRedeem = (rewardId: string) => {
    if (!lookup) return
    runAction('/loyalty/redeem', { loyalty_code: lookup.loyalty_code, reward_id: rewardId }, 'loyalty.msg.redeemed')
  }

  const handleAddStamp = () => {
    if (!lookup) return
    runAction('/loyalty/stamp/add', { loyalty_code: lookup.loyalty_code }, 'loyalty.msg.stamped')
  }

  const handleResetStamps = () => {
    if (!lookup) return
    if (!confirm(t('loyalty.till.resetConfirm'))) return
    runAction('/loyalty/stamp/reset', { loyalty_code: lookup.loyalty_code }, 'loyalty.msg.reset')
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>{t('loyalty.loading')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div>
        <div className="page-header__eyebrow" style={{ marginBottom: '0.25rem' }}>
          {t('common.management')}
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
          {t('loyalty.title')}
        </h2>
      </div>

      {saveMsg && <div className={saveMsg.type === 'ok' ? 'form-success' : 'form-error'}>{saveMsg.text}</div>}

      {/* ── Włącz / wyłącz ─────────────────────────────────────────────── */}
      <div className="res-settings-block" style={{ margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>
              {t('loyalty.active.title')}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
              {t('loyalty.active.hint')}
            </div>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <>
          {/* ── Rodzaj programu ─────────────────────────────────────────── */}
          <div className="res-settings-block" style={{ margin: 0 }}>
            <div className="res-settings-block__title">{t('loyalty.kind')}</div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className={`res-mode-btn${mode === 'points' ? ' res-mode-btn--active' : ''}`} onClick={() => setMode('points')}>
                <Coins size={18} />
                {t('loyalty.kind.points')}
              </button>
              <button type="button" className={`res-mode-btn${mode === 'stamps' ? ' res-mode-btn--active' : ''}`} onClick={() => setMode('stamps')}>
                <Bookmark size={18} />
                {t('loyalty.kind.stamps')}
              </button>
            </div>
          </div>

          {/* ── Nagrody (punkty) ────────────────────────────────────────── */}
          {mode === 'points' && (
            <div className="info-card">
              <div className="info-card__header">
                <span className="info-card__icon"><Gift size={20} /></span>
                <h2 className="info-card__title">{t('loyalty.rewards.title')}</h2>
              </div>
              <div className="info-card__body">
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
                  {t('loyalty.rewards.rule')}
                </p>
                {rewards.length === 0 && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('loyalty.rewards.none')}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {rewards.map(r => (
                    <div key={r._uid} className="res-table-row">
                      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="field" style={{ flex: '2 1 200px' }}>
                          <label className="me-label">{t('loyalty.rewards.name')}</label>
                          <input className="me-input" value={r.name}
                            onChange={e => updateReward(r._uid, { name: e.target.value })}
                            placeholder={t('loyalty.rewards.namePlaceholder')} />
                        </div>
                        <div className="field" style={{ flex: '1 1 120px' }}>
                          <label className="me-label">{t('loyalty.rewards.cost')}</label>
                          <input className="me-input" type="number" min={1} value={r.cost_points}
                            onChange={e => updateReward(r._uid, { cost_points: e.target.value })}
                            placeholder="100" />
                        </div>
                        <button type="button" className="me-remove-btn me-remove-item"
                          onClick={() => removeReward(r._uid)}
                          title={t('loyalty.rewards.remove')} aria-label={t('loyalty.rewards.remove')}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="me-add-item-btn" style={{ marginTop: '0.875rem' }} onClick={addReward}>
                  {t('loyalty.rewards.add')}
                </button>
              </div>
            </div>
          )}

          {/* ── Ustawienia pieczątek ─────────────────────────────────────── */}
          {mode === 'stamps' && (
            <div className="info-card">
              <div className="info-card__header">
                <span className="info-card__icon"><Bookmark size={20} /></span>
                <h2 className="info-card__title">{t('loyalty.stamps.title')}</h2>
              </div>
              <div className="info-card__body">
                <div className="field" style={{ maxWidth: 220 }}>
                  <label className="field__label">{t('loyalty.stamps.max')}</label>
                  <input className="field__input" type="number" min={2} max={100} value={stampsMax}
                    onChange={e => setStampsMax(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label className="field__label">{t('loyalty.stamps.earn')}</label>
                  <input className="field__input" value={stampsEarnDesc}
                    onChange={e => setStampsEarnDesc(e.target.value)}
                    placeholder={t('loyalty.stamps.earnPlaceholder')} />
                </div>
                <div className="field">
                  <label className="field__label">{t('loyalty.stamps.reward')}</label>
                  <input className="field__input" value={stampsRewardDesc}
                    onChange={e => setStampsRewardDesc(e.target.value)}
                    placeholder={t('loyalty.stamps.rewardPlaceholder')} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--primary" style={{ width: 'auto', minWidth: 200 }}
              onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('loyalty.save')}
            </button>
          </div>

          {/* ── Kasa ─────────────────────────────────────────────────────── */}
          <div className="info-card">
            <div className="info-card__header">
              <span className="info-card__icon"><Receipt size={20} /></span>
              <h2 className="info-card__title">{t('loyalty.till.title')}</h2>
            </div>
            <div className="info-card__body">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 220px' }}>
                  <label className="field__label">{t('loyalty.till.code')}</label>
                  <input
                    className="field__input"
                    value={searchCode}
                    onChange={e => setSearchCode(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                    placeholder={t('loyalty.till.codePlaceholder')}
                    maxLength={8}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}
                  />
                </div>
                <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0, padding: '0.75rem 1.5rem' }}
                  onClick={handleSearch} disabled={searching}>
                  {searching ? t('loyalty.till.searching') : t('loyalty.till.search')}
                </button>
              </div>

              {searchError && <div className="form-error" style={{ marginTop: '1rem' }}>{searchError}</div>}

              {lookup && (
                <div className="res-table-row" style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div translate="no">
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>{lookup.full_name}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>@{lookup.client_nick} · {lookup.loyalty_code}</div>
                    </div>
                    <div style={{
                      background: 'rgba(169,114,47,0.1)', color: 'var(--gold)', borderRadius: 100,
                      padding: '0.375rem 1rem', fontSize: '1.125rem', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {lookup.mode === 'points'
                        ? t('loyalty.points', { count: lookup.points })
                        : t('loyalty.stampsProgress', { count: lookup.stamps, max: lookup.stamps_max })}
                    </div>
                  </div>

                  {actionMsg && <div className="form-success" style={{ marginBottom: '1rem' }}>{actionMsg}</div>}

                  {lookup.mode === 'points' ? (
                    <>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        <div className="field" style={{ flex: '1 1 160px' }}>
                          <label className="me-label">{t('loyalty.till.amount')}</label>
                          <input className="me-input" type="number" min={0.01} step={0.01} value={txAmount}
                            onChange={e => setTxAmount(e.target.value)} placeholder={t('loyalty.till.amountPlaceholder')} />
                        </div>
                        <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
                          onClick={handleEarn} disabled={actionLoading}>
                          {t('loyalty.till.earn')}
                        </button>
                      </div>

                      <div className="me-label" style={{ marginBottom: '0.625rem' }}>{t('loyalty.till.redeemTitle')}</div>
                      {lookup.rewards.length === 0 ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('loyalty.till.noRewards')}</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {lookup.rewards.map(r => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>
                                {/* Nazwa nagrody wpisana przez właściciela */}
                                <span translate="no">{r.name}</span>{' '}
                                {t('loyalty.till.rewardLine', { name: '', cost: r.cost_points }).replace(/^\s*—\s*/, '— ')}
                              </span>
                              <button type="button" className="btn btn--outline-dark btn--sm" style={{ width: 'auto' }}
                                onClick={() => handleRedeem(r.id)}
                                disabled={actionLoading || lookup.points < r.cost_points}>
                                {t('loyalty.till.redeem')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {lookup.stamps < lookup.stamps_max ? (
                        <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
                          onClick={handleAddStamp} disabled={actionLoading}>
                          {t('loyalty.till.addStamp')}
                        </button>
                      ) : (
                        <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
                          onClick={handleResetStamps} disabled={actionLoading}>
                          {t('loyalty.till.resetStamps')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}