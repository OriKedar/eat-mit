import { useEffect, useRef, useState } from 'react'
import { searchPlaces, reverseGeocode } from '../lib/nominatim'

const EMPTY_DETAILS = { status: 'want_to_go', rating: 0, notes: '', photo_url: '' }

// One dialog, three modes:
//   'add'  — search Nominatim, pick a result, then fill in details
//   'pin'  — coordinates came from a long-press; name it by hand
//   'edit' — place is fixed, only the personal details are editable
export default function PlaceDialog({ mode, entry, coords, onClose, onSubmit }) {
  const editing = mode === 'edit'
  const dropped = mode === 'pin'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [picked, setPicked] = useState(editing ? entry.place : null)
  const [resolving, setResolving] = useState(dropped)

  const [details, setDetails] = useState(
    editing
      ? {
          status: entry.status,
          rating: entry.rating || 0,
          notes: entry.notes || '',
          photo_url: entry.photo_url || '',
        }
      : EMPTY_DETAILS,
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const abortRef = useRef(null)

  // Dropped pin: look up an address for the coordinates, but let the user
  // proceed with a blank one if Nominatim has nothing there.
  useEffect(() => {
    if (!dropped) return
    let cancelled = false
    ;(async () => {
      let resolved = null
      try {
        resolved = await reverseGeocode(coords.lat, coords.lng)
      } catch {
        // Non-fatal — fall through to an unnamed pin.
      }
      if (cancelled) return
      setPicked({
        name: '',
        lat: coords.lat,
        lng: coords.lng,
        address: resolved?.address || '',
        osm_id: null, // hand-placed, so never deduped against an OSM feature
        cuisine: resolved?.cuisine || '',
      })
      setResolving(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dropped, coords])

  // Debounced search — also keeps us well inside Nominatim's 1 req/sec policy.
  useEffect(() => {
    if (editing || dropped || picked) return
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSearching(true)
      setSearchError(null)
      try {
        setResults(await searchPlaces(q, { signal: controller.signal }))
      } catch (err) {
        if (err.name !== 'AbortError') setSearchError(err.message)
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [query, picked, editing, dropped])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await onSubmit(picked, details)
      onClose()
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
    }
  }

  const title = editing ? 'Edit entry' : dropped ? 'Add a place here' : 'Add a place'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {resolving ? (
          <p className="hint pad">Looking up that spot…</p>
        ) : !picked ? (
          <div className="search-step">
            <input
              autoFocus
              placeholder="Search a restaurant by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <p className="hint">Searching…</p>}
            {searchError && <p className="error">{searchError}</p>}
            {!searching && query.trim().length >= 3 && !results.length && (
              <p className="hint">
                No results. Try adding the city name — or close this and long-press the map where
                the place is.
              </p>
            )}
            <ul className="results">
              {results.map((r) => (
                <li key={`${r.osm_id}-${r.lat}`}>
                  <button type="button" onClick={() => setPicked(r)}>
                    <strong>{r.name}</strong>
                    <span>{r.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form className="details-step" onSubmit={handleSubmit}>
            {dropped ? (
              <label className="field">
                Name
                <input
                  autoFocus
                  required
                  placeholder="What's this place called?"
                  value={picked.name}
                  onChange={(e) => setPicked((p) => ({ ...p, name: e.target.value }))}
                />
                {picked.address && <span className="sub">{picked.address}</span>}
              </label>
            ) : (
              <div className="picked">
                <strong>{picked.name}</strong>
                {picked.address && <span>{picked.address}</span>}
                {!editing && (
                  <button type="button" className="link" onClick={() => setPicked(null)}>
                    Choose a different place
                  </button>
                )}
              </div>
            )}

            {!editing && (
              <label className="field">
                Cuisine (optional)
                <input
                  list="cuisine-suggestions"
                  placeholder="Italian, sushi, ramen…"
                  value={picked.cuisine || ''}
                  onChange={(e) => setPicked((p) => ({ ...p, cuisine: e.target.value }))}
                />
                <datalist id="cuisine-suggestions">
                  {['Italian', 'Japanese', 'Sushi', 'Ramen', 'Thai', 'Vietnamese', 'Indian',
                    'Chinese', 'Korean', 'Mexican', 'Turkish', 'Middle Eastern', 'Greek',
                    'French', 'German', 'Vegan', 'Pizza', 'Burger', 'Breakfast', 'Bakery',
                    'Cafe', 'Bar'].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            )}

            <fieldset className="status-toggle">
              <legend>Status</legend>
              {[
                ['want_to_go', 'Want to go'],
                ['visited', 'Visited'],
              ].map(([value, label]) => (
                <label key={value} className={details.status === value ? 'active' : ''}>
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    checked={details.status === value}
                    onChange={() => setDetails((d) => ({ ...d, status: value }))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <div className="rating-row">
              <span>Rating</span>
              <div className="stars-input">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={r <= details.rating ? 'star on' : 'star'}
                    onClick={() => setDetails((d) => ({ ...d, rating: d.rating === r ? 0 : r }))}
                    aria-label={`${r} star${r > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              Notes
              <textarea
                rows={3}
                placeholder="What to order, who recommended it…"
                value={details.notes}
                onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))}
              />
            </label>

            <label className="field">
              Photo URL (optional)
              <input
                type="url"
                placeholder="https://…"
                value={details.photo_url}
                onChange={(e) => setDetails((d) => ({ ...d, photo_url: e.target.value }))}
              />
            </label>

            {saveError && <p className="error">{saveError}</p>}

            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add place'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
