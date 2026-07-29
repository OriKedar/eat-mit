import { useState } from 'react'
import { supabase, appUrl } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({ kind: 'idle' })

  async function sendMagicLink(e) {
    e.preventDefault()
    setStatus({ kind: 'sending' })
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: appUrl() },
    })
    setStatus(error ? { kind: 'error', message: error.message } : { kind: 'sent' })
  }

  async function signInWithGoogle() {
    setStatus({ kind: 'sending' })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: appUrl() },
    })
    if (error) setStatus({ kind: 'error', message: error.message })
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Food Map</h1>
        <p className="auth-sub">Restaurants you want to try, and ones you already did.</p>

        {status.kind === 'sent' ? (
          <p className="auth-sent">
            Check <strong>{email}</strong> for a sign-in link. You can close this tab.
          </p>
        ) : (
          <form onSubmit={sendMagicLink} className="auth-form">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={status.kind === 'sending'}>
              {status.kind === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        <button className="auth-google" onClick={signInWithGoogle} type="button">
          Continue with Google
        </button>

        {status.kind === 'error' && <p className="auth-error">{status.message}</p>}
      </div>
    </div>
  )
}
