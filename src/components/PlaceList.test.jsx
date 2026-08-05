import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlaceList from './PlaceList'

function entry(overrides) {
  return {
    id: '1',
    status: 'want_to_go',
    rating: 0,
    notes: '',
    created_at: '2026-08-01T00:00:00Z',
    place: { name: 'Place', lat: 52.5, lng: 13.4, cuisine: 'Italian', address: 'Somewhere 1' },
    ...overrides,
  }
}

const ENTRIES = [
  entry({ id: '1', status: 'want_to_go', place: { name: 'Alpha', lat: 52.5, lng: 13.4, cuisine: 'Italian', address: 'A' } }),
  entry({
    id: '2',
    status: 'visited',
    rating: 4,
    place: { name: 'Beta', lat: 52.51, lng: 13.41, cuisine: 'Japanese', address: 'B' },
  }),
]

describe('PlaceList', () => {
  it('renders every entry with its status badge', () => {
    render(<PlaceList entries={ENTRIES} onSelect={() => {}} onEdit={() => {}} onDelete={() => {}} />)

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(document.querySelector('.badge-want_to_go')).toHaveTextContent('Want to go')
    expect(document.querySelector('.badge-visited')).toHaveTextContent('Visited')
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(<PlaceList entries={ENTRIES} onSelect={() => {}} onEdit={() => {}} onDelete={() => {}} />)

    await userEvent.selectOptions(screen.getByDisplayValue('All'), 'visited')

    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('filters by free-text search across name/address/cuisine/notes', async () => {
    render(<PlaceList entries={ENTRIES} onSelect={() => {}} onEdit={() => {}} onDelete={() => {}} />)

    await userEvent.type(screen.getByPlaceholderText('Filter my places…'), 'japanese')

    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    render(<PlaceList entries={ENTRIES} onSelect={() => {}} onEdit={() => {}} onDelete={() => {}} />)

    await userEvent.type(screen.getByPlaceholderText('Filter my places…'), 'nonexistent place')

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('calls onSelect when a row is clicked, and onEdit/onDelete for their buttons without bubbling', async () => {
    const onSelect = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<PlaceList entries={ENTRIES} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />)

    await userEvent.click(screen.getByText('Alpha'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))

    onSelect.mockClear()
    await userEvent.click(screen.getAllByText('Edit')[0])
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
    expect(onSelect).not.toHaveBeenCalled()

    await userEvent.click(screen.getAllByText('Delete')[0])
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('offers distance sort only once a location fix is available', () => {
    const { rerender } = render(
      <PlaceList entries={ENTRIES} onSelect={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    )
    expect(screen.getByRole('option', { name: /distance/i })).toBeDisabled()

    rerender(
      <PlaceList
        entries={ENTRIES}
        onSelect={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        me={{ lat: 52.5, lng: 13.4 }}
      />,
    )
    expect(screen.getByRole('option', { name: 'Sort: Distance' })).not.toBeDisabled()
  })
})
