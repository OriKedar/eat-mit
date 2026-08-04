import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: (...a) => signInWithOtp(...a), signInWithOAuth: (...a) => signInWithOAuth(...a) } },
  appUrl: () => 'https://example.com/eat-mit/',
}))

const { default: Auth } = await import('./Auth')

beforeEach(() => {
  signInWithOtp.mockReset()
  signInWithOAuth.mockReset()
})

describe('Auth', () => {
  it('sends a magic link and shows the confirmation', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    render(<Auth />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: /email me a sign-in link/i }))

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      options: { emailRedirectTo: 'https://example.com/eat-mit/' },
    })
    expect(await screen.findByText(/check/i)).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
  })

  it('shows an error message when the magic link request fails', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Rate limited' } })
    render(<Auth />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'me@example.com')
    await userEvent.click(screen.getByRole('button', { name: /email me a sign-in link/i }))

    expect(await screen.findByText('Rate limited')).toBeInTheDocument()
  })

  it('starts a Google OAuth sign-in', async () => {
    signInWithOAuth.mockResolvedValue({ error: null })
    render(<Auth />)

    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://example.com/eat-mit/' },
    })
  })
})
