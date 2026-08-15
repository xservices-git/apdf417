import { useState, useEffect } from 'react'
import { api, getSessionToken, setSessionToken } from './lib/api'
import Login from './pages/Login'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Generator from './pages/Generator'
import TokensManager from './pages/TokensManager'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import { LayoutDashboard, ScanLine, KeyRound, Settings as SettingsIcon } from 'lucide-react'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    (async () => {
      const token = getSessionToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const me = await api.checkMe()
        setAuthed(true)
        setUser(me.user)
      } catch {
        setSessionToken('')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleLogin = async (username, password) => {
    const res = await api.login(username, password)
    setSessionToken(res.token)
    setAuthed(true)
    setUser({ username: res.username })
  }

  const handleLogout = () => {
    setSessionToken('')
    setAuthed(false)
    setUser(null)
    setActiveTab('dashboard')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return <Login onLogin={handleLogin} />
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'generator', label: 'Barcode Generator', icon: ScanLine },
    { id: 'tokens', label: 'API Tokens', icon: KeyRound },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ]

  return (
    <div className="h-full flex flex-col md:flex-row tap-highlight-none">
      <Sidebar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onLogout={handleLogout} activeTab={tabs.find(t => t.id === activeTab)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'generator' && <Generator />}
          {activeTab === 'tokens' && <TokensManager />}
          {activeTab === 'settings' && <Settings user={user} onUpdateUser={setUser} onLogout={handleLogout} />}
        </main>
      </div>
    </div>
  )
}
