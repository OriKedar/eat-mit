import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const searchPlaces = vi.fn()
const reverseGeocode = vi.fn()

vi.mock('../lib/nominatim', () => ({
  searchPlaces: (...a) => searchPlaces(...a),
  reverseGeocode: (...a) => reverseGeocode(...a),
}))

const { default: PlaceDialog } = await import('./PlaceDialog')

beforeEach(() => {
  searchPlaces.mockReset()
  reverseGeocode.mockReset()
})

const RESULT = {
  name: 'Found Place',
  displayName: 'Found Place, Berlin',
  lat: 52.5,
  lng: 13.4,
  address: 'Somewhere 1, Berlin',
  osm_id: 'way/1',
  cuisine: 'Italian',
}

describe('PlaceDialog — add mode', () => {
  it('searches after 3+ characters and lets you pick a result', async () => {
    searchPlaces.mockResolvedValue([RESULT])
    const onSubmit = vi.fn().mockResolvedValue()
    const onClose = vi.fn()
    render(<PlaceDialog mode="add" onClose={onClose} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByPlaceholderText(/search a restaurant/i), 'trattoria')

    await waitFor(() => expect(searchPlaces).toHaveBeenCalledWith('trattoria', expect.anything()))
    await userEvent.click(await screen.findByText('Found Place'))

    expect(screen.getByText('Found Place')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add place/i }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        RESULT,
        expect.objectContaining({ status: 'want_to_go' }),
      ),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('does not search under 3 characters', async () => {
    render(<PlaceDialog mode="add" onClose={() => {}} onSubmit={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/search a restaurant/i), 'ab')
    expect(searchPlaces).not.toHaveBeenCalled()
  })

  it('surfaces a save error without closing the dialog', async () => {
    searchPlaces.mockResolvedValue([RESULT])
    const onSubmit = vi.fn().mockRejectedValue(new Error('Save failed'))
    const onClose = vi.fn()
    render(<PlaceDialog mode="add" onClose={onClose} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByPlaceholderText(/search a restaurant/i), 'trattoria')
    await userEvent.click(await screen.findByText('Found Place'))
    await userEvent.click(screen.getByRole('button', { name: /add place/i }))

    expect(await screen.findByText('Save failed')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('PlaceDialog — pin mode', () => {
  it('reverse-geocodes the dropped coordinates then lets the name be edited', async () => {
    reverseGeocode.mockResolvedValue({ address: 'Weserstraße 40', cuisine: 'Middle Eastern' })
    render(
      <PlaceDialog
        mode="pin"
        coords={{ lat: 52.4966, lng: 13.4321 }}
        onClose={() => {}}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByText(/looking up/i)).toBeInTheDocument()
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalledWith(52.4966, 13.4321))
    expect(await screen.findByText('Weserstraße 40')).toBeInTheDocument()
  })

  it('falls back to a blank pin when reverse geocoding fails', async () => {
    reverseGeocode.mockRejectedValue(new Error('offline'))
    render(
      <PlaceDialog
        mode="pin"
        coords={{ lat: 52.4966, lng: 13.4321 }}
        onClose={() => {}}
        onSubmit={vi.fn()}
      />,
    )

    expect(await screen.findByPlaceholderText(/what's this place called/i)).toBeInTheDocument()
  })
})

describe('PlaceDialog — edit mode', () => {
  it('prefills details from the existing entry and submits an update', async () => {
    const entry = {
      status: 'visited',
      rating: 3,
      notes: 'Great tiramisu',
      photo_url: '',
      place: { name: 'Existing Place', address: 'Old St 1' },
    }
    const onSubmit = vi.fn().mockResolvedValue()
    render(<PlaceDialog mode="edit" entry={entry} onClose={() => {}} onSubmit={onSubmit} />)

    expect(screen.getByText('Existing Place')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Great tiramisu')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      entry.place,
      expect.objectContaining({ status: 'visited', rating: 3, notes: 'Great tiramisu' }),
    )
  })
})

describe('PlaceDialog — nearby mode', () => {
  it('starts with the given place already picked', () => {
    render(
      <PlaceDialog mode="nearby" place={RESULT} onClose={() => {}} onSubmit={vi.fn()} />,
    )
    expect(screen.getByText('Found Place')).toBeInTheDocument()
  })
})
