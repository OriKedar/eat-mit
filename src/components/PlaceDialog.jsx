import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/nominatim'

const EMPTY_DETAILS = { status: 'want_to_go', rating: 0, notes: '', photo_url: '' }

// One dialog, two modes:
//   mode 'add'  — search Nominatim, pick a result, then fill in details
//   mode 'edit' — place is fixed, only the personal details are editable
export default function PlaceDialog({ mode, entry, onClose, onSubmit }) {
  const editing = mode === 'edit'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [picked, setPicked] = useState(editing ? entry.place : null)

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

  // Debounced search — also keeps us well inside Nominatim's 1 req/sec policy.
  useEffect(() => {
    if (editing || picked) return
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
  }, [query, picked, editing])

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? 'Edit entry' : 'Add a place'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!picked ? (
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
              <p className="hint">No results. Try adding the city name.</p>
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
            <div className="picked">
              <strong>{picked.name}</strong>
              {picked.address && <span>{picked.address}</span>}
              {!editing && (
                <button type="button" className="link" onClick={() => setPicked(null)}>
                  Choose a different place
                </button>
              )}
            </div>

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
