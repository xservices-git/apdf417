import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import {
  ScanLine,
  Loader2,
  Download,
  Copy,
  RefreshCw,
  Image as ImageIcon,
  FileCode,
  CheckCircle2,
  Circle,
  ChevronDown
} from 'lucide-react'

export default function Generator() {
  const [states, setStates] = useState([])
  const [state, setState] = useState('CA')
  const [mode, setMode] = useState('full') // brief | full
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({})
  const [loadingStates, setLoadingStates] = useState(true)
  const [loadingFields, setLoadingFields] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeToken, setActiveToken] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const { available_states = [] } = await api.getStates()
        setStates(available_states || [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoadingStates(false)
      }
      try {
        const t = await api.getTokens()
        const act = (t.tokens || []).find(x => x.active)
        setActiveToken(act || (t.tokens || [])[0] || null)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!state) return
      setLoadingFields(true)
      setFields([])
      try {
        const data = await api.getFields(state, mode)
        if (mode === 'full') {
          setFields(data.fields || [])
        } else {
          // brief: values object -> list
          setFields(
            Object.keys(data).map((code) => ({
              code,
              name: code,
              required: false,
              type: 'text'
            }))
          )
          setValues(data)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoadingFields(false)
      }
    })()
  }, [state, mode])

  const onChangeValue = (code, value) => {
    setValues((prev) => ({ ...prev, [code]: value }))
  }

  const onGenerate = async () => {
    setError('')
    setResult(null)
    setGenerating(true)
    try {
      const payload = { ...values, STATE: state }
      const res = await api.generateBarcode(payload)
      setResult(res)
      // Refresh active token stats
      try {
        const t = await api.getTokens()
        setActiveToken((prev) => {
          const updated = (t.tokens || []).find(x => x.id === res.used_token?.id)
          return updated || prev
        })
      } catch {}
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Barcode Generator</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Create PDF417 barcodes via PDF417.PRO API
          {activeToken && (
            <span className="ml-2 text-zinc-600">
              · Token: <span className="text-brand-300 font-mono text-xs">{activeToken.name}</span>
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">State</label>
              <div className="relative">
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={loadingStates}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm appearance-none pr-9 cursor-pointer"
                >
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.state}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Mode</label>
              <div className="grid grid-cols-2 rounded-lg border border-zinc-800 p-0.5 bg-zinc-900/40">
                {['brief', 'full'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                      mode === m ? 'bg-brand-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setLoadingFields(true)
                  setFields([])
                  setTimeout(async () => {
                    try {
                      const data = await api.getFields(state, mode)
                      if (mode === 'full') setFields(data.fields || [])
                      else {
                        setFields(Object.keys(data).map(code => ({ code, name: code, required: false, type: 'text' })))
                        setValues(data)
                      }
                    } catch (e) { setError(e.message) } finally { setLoadingFields(false) }
                  }, 0)
                }}
                disabled={loadingFields}
                className="px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 text-sm text-zinc-300 flex items-center gap-2 transition-colors w-full justify-center"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFields ? 'animate-spin' : ''}`} />
                Reload Fields
              </button>
            </div>
          </div>

          {loadingFields ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading fields for {state}...
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-500">
              No fields available. Try reloading.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-2">
              {fields.map((f) => (
                <div key={f.code} className={f.code === 'STATE' ? 'sm:col-span-2' : ''}>
                  <label className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                    <span className="font-mono">
                      {f.name || f.code}
                      {f.required && <span className="text-rose-400 ml-1">*</span>}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono">{f.code}</span>
                  </label>
                  <input
                    type="text"
                    value={values[f.code] ?? ''}
                    onChange={(e) => onChangeValue(f.code, e.target.value)}
                    placeholder={f.placeholder || ''}
                    pattern={f.pattern || undefined}
                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-zinc-800 pt-4 flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => {
                setValues({})
              }}
              disabled={generating}
              className="px-4 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800/40 text-sm text-zinc-300"
            >
              Reset
            </button>
            <button
              onClick={onGenerate}
              disabled={generating || fields.length === 0}
              className="btn-gradient px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ScanLine className="w-4 h-4" />
                  Generate Barcode
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* RESULT */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-brand-400" />
              Result
            </h2>
            {!result ? (
              <div className="text-center py-12 text-zinc-600">
                <ScanLine className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <div className="text-xs">Generate barcode to preview</div>
              </div>
            ) : (
              <ResultView result={result} />
            )}
          </div>

          {result && (
            <div className="card p-5 space-y-2">
              <div className="text-xs text-zinc-500 font-mono break-all">{result.file_svg || result.file_png}</div>
              {result.used_token && (
                <div className="text-xs text-zinc-500">
                  Used token: <span className="text-brand-300">{result.used_token.name}</span>
                </div>
              )}
              <button
                onClick={() => download(`https://pdf417.pro${result.file_png}`, 'barcode.png')}
                className="w-full px-3 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800/40 text-xs text-zinc-300 flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download PNG
              </button>
              <button
                onClick={() => download(`https://pdf417.pro${result.file_svg}`, 'barcode.svg')}
                className="w-full px-3 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800/40 text-xs text-zinc-300 flex items-center justify-center gap-2"
              >
                <FileCode className="w-3.5 h-3.5" />
                Download SVG
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultView({ result }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg overflow-hidden bg-white p-2 border border-zinc-800">
        <img
          src={`/api/proxy-image?url=${encodeURIComponent(`https://pdf417.pro${result.file_png}`)}`}
          alt="Barcode preview"
          className="w-full h-auto"
          onError={(e) => (e.target.src = `https://pdf417.pro${result.file_png}`)}
        />
      </div>
      <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Barcode generated successfully
      </div>
    </div>
  )
}

async function download(url, name) {
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (e) {
    window.open(url, '_blank')
  }
}