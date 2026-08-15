import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { KeyRound, ScanLine, Activity, AlertCircle, RefreshCw, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'

export default function Dashboard({ onNavigate }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await api.getTokens()
      setTokens(data.tokens || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalAvailable = tokens.reduce((sum, t) => sum + (t.info?.available_barcodes || 0), 0)
  const totalLimit = tokens.reduce((sum, t) => sum + (t.info?.barcodes_limit || 0), 0)
  const totalCreated = tokens.reduce((sum, t) => sum + (t.info?.barcodes_created || 0), 0)
  const activeToken = tokens.find(t => t.active)
  const errorTokens = tokens.filter(t => t.info?.error)

  const refreshAll = async () => {
    setRefreshing(true)
    try {
      const data = await api.checkAllTokens()
      setTokens(data.tokens || [])
    } catch (e) {
      console.error(e)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Overview of your PDF417 API tokens and usage</p>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing || tokens.length === 0}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 text-sm text-zinc-300 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="card p-12 text-center">
          <KeyRound className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">No API Tokens Yet</h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
            Add your first PDF417.PRO API token to start generating barcodes. Tokens are stored securely in Cloudflare KV.
          </p>
          <button
            onClick={() => onNavigate('tokens')}
            className="btn-gradient px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
          >
            Add API Token
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={KeyRound}
              label="Total Tokens"
              value={tokens.length}
              color="from-brand-500 to-fuchsia-500"
            />
            <StatCard
              icon={Activity}
              label="Available Barcodes"
              value={totalAvailable.toLocaleString()}
              color="from-emerald-500 to-teal-500"
            />
            <StatCard
              icon={ScanLine}
              label="Total Created"
              value={totalCreated.toLocaleString()}
              color="from-amber-500 to-orange-500"
            />
            <StatCard
              icon={AlertCircle}
              label="Token Errors"
              value={errorTokens.length}
              color={errorTokens.length > 0 ? "from-rose-500 to-pink-500" : "from-zinc-700 to-zinc-800"}
            />
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-100">Active Token</h2>
              <button
                onClick={() => onNavigate('generator')}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                Generate Barcode <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {activeToken ? (
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-semibold text-zinc-100">{activeToken.name}</div>
                  <div className="text-xs font-mono text-zinc-500 mt-1">
                    {activeToken.token.slice(0, 8)}...{activeToken.token.slice(-8)}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="text-zinc-400">
                      <span className="text-zinc-500">User:</span> <span className="font-mono">{activeToken.info?.username || '—'}</span>
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="px-4 py-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="text-2xl font-bold text-emerald-400">{activeToken.info?.available_barcodes ?? '—'}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Available</div>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="text-2xl font-bold text-amber-400">{activeToken.info?.barcodes_limit ?? '—'}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Limit</div>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="text-2xl font-bold text-fuchsia-400">{activeToken.info?.barcodes_created ?? '—'}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Created</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No active token selected</div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-zinc-100 mb-4">All Tokens</h2>
            <div className="space-y-2">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {t.info?.error ? (
                      <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-200 truncate">{t.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {t.token.slice(0, 6)}…{t.token.slice(-4)} · {t.info?.available_barcodes ?? '?'} avail
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.active && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-[10px] font-semibold border border-brand-500/30">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold text-zinc-100 mt-2">{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  )
}