import { KeyRound } from 'lucide-react'

export default function Sidebar({ tabs, active, onSelect }) {
  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 border-r border-zinc-800/50 bg-zinc-950/40 backdrop-blur-md p-4 flex-col gap-1">
      <div className="flex items-center gap-3 px-3 py-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-semibold text-zinc-100">APDF417</div>
          <div className="text-xs text-zinc-500">Barcode Manager</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
