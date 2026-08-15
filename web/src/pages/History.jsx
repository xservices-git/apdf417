import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { History as HistoryIcon, Trash2, Download, ImageIcon, ExternalLink, RefreshCw, X } from 'lucide-react'

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.getHistory()
      setHistory(res.history || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleClear = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    try {
      await api.clearHistory()
      setHistory([])
      setConfirming(false)
    } catch (e) {
      alert('Failed to clear: ' + e.message)
    }
  }

  const fmt = (iso) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch {
      return iso
    }
  }

  const downloadItem = (item) => {
    const url = item.pngUrl || item.svgUrl
    if (!url) return
    const link = item.pngUrl ? 'barcode.png' : 'barcode.svg'
    const a = document.createElement('a')
    a.href = `/api/proxy-image?url=${encodeURIComponent(url)}`
    a.download = `${item.id}.${link.split('.').pop()}`
    a.target = '_blank'
    a.click()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <HistoryIcon className="text-brand-400" size={28} />
            Lịch sử Barcode
          </h1>
          <p className="text-slate-400 text-sm mt-1">{history.length} mã vạch đã tạo (tối đa 100)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleClear}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition ${
              confirming
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-rose-300'
            }`}
          >
            <Trash2 size={16} />
            {confirming ? 'Bấm lần nữa để xác nhận' : 'Xóa tất cả'}
          </button>
        </div>
      </div>

      {loading && history.length === 0 ? (
        <div className="text-center text-slate-400 py-20">Loading...</div>
      ) : history.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <ImageIcon size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">Chưa có mã vạch nào. Tạo mã mới ở tab <strong>Barcode Generator</strong>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item) => (
            <div key={item.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-brand-500/50 transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-500 font-mono">{item.id}</div>
                  <div className="text-sm text-slate-300 mt-1">{fmt(item.createdAt)}</div>
                </div>
                {item.state && (
                  <span className="text-xs px-2 py-0.5 bg-brand-500/20 text-brand-300 rounded">{item.state}</span>
                )}
              </div>

              <button
                onClick={() => setPreview(item)}
                className="w-full aspect-video bg-slate-800 rounded-lg flex items-center justify-center mb-3 hover:bg-slate-700 transition overflow-hidden"
              >
                {item.pngUrl ? (
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(item.pngUrl)}`}
                    alt="barcode"
                    className="max-w-full max-h-full"
                    loading="lazy"
                  />
                ) : item.svgUrl ? (
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(item.svgUrl)}`}
                    alt="barcode"
                    className="max-w-full max-h-full"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon size={32} className="text-slate-600" />
                )}
              </button>

              <div className="space-y-1 text-xs">
                {item.tokenName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Token:</span>
                    <span className="text-slate-300 truncate ml-2">{item.tokenName}</span>
                  </div>
                )}
                {item.barcodeType && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="text-slate-300">{item.barcodeType}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => downloadItem(item)}
                  disabled={!item.pngUrl && !item.svgUrl}
                  className="flex-1 px-2 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Download size={14} /> Download
                </button>
                {item.pngUrl && (
                  <a
                    href={`/api/proxy-image?url=${encodeURIComponent(item.pngUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ImageIcon size={20} className="text-brand-400" />
                Mã vạch {preview.id}
              </h3>
              <button
                onClick={() => setPreview(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-center mb-4">
              {preview.pngUrl ? (
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(preview.pngUrl)}`}
                  alt="barcode"
                  className="max-w-full max-h-96"
                />
              ) : preview.svgUrl ? (
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(preview.svgUrl)}`}
                  alt="barcode"
                  className="max-w-full max-h-96"
                />
              ) : (
                <p className="text-slate-500">No image</p>
              )}
            </div>
            <div className="text-xs text-slate-400 space-y-1 font-mono">
              <div>Created: {fmt(preview.createdAt)}</div>
              {preview.state && <div>State: {preview.state}</div>}
              {preview.tokenName && <div>Token: {preview.tokenName}</div>}
              {preview.barcodeType && <div>Type: {preview.barcodeType}</div>}
              {preview.pdf417Data && (
                <div className="mt-3 p-2 bg-slate-800 rounded text-xs overflow-auto max-h-32">
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(preview.pdf417Data, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => downloadItem(preview)}
                disabled={!preview.pngUrl && !preview.svgUrl}
                className="flex-1 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download size={16} /> Download
              </button>
              <button
                onClick={() => setPreview(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
