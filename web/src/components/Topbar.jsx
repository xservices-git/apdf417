import { LogOut, User, Menu } from 'lucide-react'
import { useState } from 'react'

export default function Topbar({ user, onLogout, activeTab }) {
  return (
    <header className="h-16 border-b border-zinc-800/50 bg-zinc-950/30 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-zinc-100">{activeTab?.label || 'APDF417'}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
          <User className="w-3.5 h-3.5 text-brand-400" />
          <span>{user?.username || 'admin'}</span>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/40 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
