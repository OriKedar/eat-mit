import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setNeedRefresh = vi.fn()
const updateServiceWorker = vi.fn()
let needRefresh = false

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  }),
}))

const { default: UpdatePrompt } = await import('./UpdatePrompt')

beforeEach(() => {
  needRefresh = false
  setNeedRefresh.mockClear()
  updateServiceWorker.mockClear()
})

describe('UpdatePrompt', () => {
  it('renders nothing when no update is pending', () => {
    const { container } = render(<UpdatePrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the bar and reloads on click when an update is pending', async () => {
    needRefresh = true
    render(<UpdatePrompt />)

    expect(screen.getByText('New version available.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('dismisses via Later without reloading', async () => {
    needRefresh = true
    render(<UpdatePrompt />)

    await userEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
