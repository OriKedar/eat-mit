import { useState } from 'react'
import { supabase, appUrl } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

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
    <div className="grid h-full place-items-center p-6">
      <Card className="w-full max-w-96">
        <CardHeader>
          <CardTitle className="text-xl">Food Map</CardTitle>
          <CardDescription>Restaurants you want to try, and ones you already did.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {status.kind === 'sent' ? (
            <p className="text-muted-foreground">
              Check <strong className="text-foreground">{email}</strong> for a sign-in link. You
              can close this tab.
            </p>
          ) : (
            <form onSubmit={sendMagicLink} className="grid gap-2.5">
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={status.kind === 'sending'}>
                {status.kind === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
            </form>
          )}

          <Button variant="outline" onClick={signInWithGoogle} type="button">
            Continue with Google
          </Button>

          {status.kind === 'error' && <p className="text-destructive">{status.message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
