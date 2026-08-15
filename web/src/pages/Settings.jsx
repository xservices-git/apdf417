import { useState } from 'react'
import { api, setSessionToken } from '../lib/api'
import { Lock, Loader2, CheckCircle2, KeyRound as Key } from 'lucide-react'

export default function Settings({ user, onUpdateUser, onLogout }) {
  const [username, setUsername] = useState(user?.username || 'admin')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword && newPassword.length < 4) {
      return setError('New password must be at least 4 characters')
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match')
    }
    if (!oldPassword) {
      return setError('Current password is required')
    }

    setLoading(true)
    try {
      const res = await api.changePassword(oldPassword, newPassword || oldPassword, username)
      setSessionToken(res.token)
      onUpdateUser({ username: res.username || username })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Settings updated successfully')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Update admin credentials</p>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-zinc-100">Admin Account</div>
            <div className="text-xs text-zinc-500">Credentials stored in Cloudflare KV JSON</div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Current Password</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              placeholder="Leave blank to keep"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {success}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800/40 text-sm text-zinc-300"
          >
            Sign Out
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}