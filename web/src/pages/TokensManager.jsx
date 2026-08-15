import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import {
  KeyRound,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Power,
  AlertCircle
} from 'lucide-react'
import Modal from '../components/Modal'

export default function TokensManager() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [workingId, setWorkingId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getTokens()
      setTokens(data.tokens || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onAdd = async (token, name) => {
    const res = await api.addToken(token, name)
    await load()
    return res
  }

  const onDelete = async (id) => {
    if (!confirm('Delete this API token?')) return
    setWorkingId(id)
    try {
      const res = await api.deleteToken(id)
      setTokens(res.tokens || [])
    } finally {
      setWorkingId(null)
    }
  }

  const onCheck = async (id) => {
    setWorkingId(id)
    try {
      const res = await api.checkToken(id)
      setTokens(prev => prev.map(t => (t.id === id ? res.token : t)))
    } catch (e) {
      alert(e.message)
    } finally {
      setWorkingId(null)
    }
  }

  const onToggle = async (id) => {
    setWorkingId(id)
    try {
      const res = await api.toggleToken(id)
      setTokens(res.tokens || [])
    } finally {
      setWorkingId(null)
    }
  }

  const onCheckAll = async () => {
    setLoading(true)
    try {
      const res = await api.checkAllTokens()
      setTokens(res.tokens || [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">API Tokens</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage multiple PDF417.PRO API keys with auto failover</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCheckAll}
            disabled={tokens.length === 0 || loading}
            className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 text-sm text-zinc-300 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Check All
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Token
          </button>
        </div>
      </div>

      {tokens.length === 0 && !loading && (
        <div className="card p-12 text-center">
          <KeyRound className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">No tokens configured</h3>
          <p className="text-sm text-zinc-500 mb-6">
            Add your PDF417.PRO API tokens. Stored securely in Cloudflare KV.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Token
          </button>
        </div>
      )}

      {loading && tokens.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
      ) : null}

      <div className="space-y-3">
        {tokens.map((t) => {
          const isError = !!t.info?.error
          return (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-zinc-100">{t.name}</h3>
                    {t.active && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-[10px] font-semibold border border-brand-500/30">
                        ACTIVE
                      </span>
                    )}
                    {isError ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-semibold border border-rose-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        ERROR
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        OK
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs font-mono text-zinc-500">
                    {t.token.slice(0, 8)}…{t.token.slice(-12)}
                  </div>

                  {!isError && t.info && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <Info label="User" value={t.info.username || '—'} />
                      <Info label="Available" value={t.info.available_barcodes?.toLocaleString() ?? '—'} highlight />
                      <Info label="Limit" value={t.info.barcodes_limit?.toLocaleString() ?? '—'} />
                      <Info label="Created" value={t.info.barcodes_created?.toLocaleString() ?? '—'} />
                    </div>
                  )}
                  {isError && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                      {t.info?.error}
                    </div>
                  )}
                  {t.lastCheck && (
                    <div className="mt-2 text-[10px] text-zinc-600">
                      Last checked: {new Date(t.lastCheck).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onToggle(t.id)}
                    disabled={workingId === t.id || t.active}
                    title={t.active ? 'Already active' : 'Set as active'}
                    className="p-2 rounded-lg text-zinc-400 hover:text-brand-300 hover:bg-zinc-800/40 transition-colors disabled:opacity-30"
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onCheck(t.id)}
                    disabled={workingId === t.id}
                    className="p-2 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800/40 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${workingId === t.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => onDelete(t.id)}
                    disabled={workingId === t.id}
                    className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && <AddTokenModal onClose={() => setShowAdd(false)} onAdd={onAdd} />}
    </div>
  )
}

function Info({ label, value, highlight }) {
  return (
    <div className="px-2 py-1.5 rounded-md bg-zinc-900/50 border border-zinc-800">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono ${highlight ? 'text-emerald-400' : 'text-zinc-200'} font-semibold`}>
        {value}
      </div>
    </div>
  )
}

function AddTokenModal({ onClose, onAdd }) {
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token.trim()) return setError('API token is required')
    if (token.trim().length < 30) return setError('Invalid token format')

    setLoading(true)
    try {
      await onAdd(token.trim(), name.trim() || undefined)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add PDF417 API Token" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Label</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm"
            placeholder="e.g. Work account"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">AUTH-TOKEN</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm font-mono"
            placeholder="6c1a0f0f-ce4e-4c73-8f97-31484ce8551e"
          />
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Found in your PDF417.PRO account settings. Stored encrypted in Cloudflare KV.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800/40 text-sm text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Token
          </button>
        </div>
      </form>
    </Modal>
  )
}