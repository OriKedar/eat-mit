import { useEffect, useRef, useState } from 'react'
import { searchPlaces, reverseGeocode } from '../lib/nominatim'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const EMPTY_DETAILS = { status: 'want_to_go', rating: 0, notes: '', photo_url: '' }

// One dialog, four modes:
//   'add'    — search Nominatim, pick a result, then fill in details
//   'pin'    — coordinates came from a long-press; name it by hand
//   'nearby' — place came from a nearby-restaurant pin; already fully known
//   'edit'   — place is fixed, only the personal details are editable
export default function PlaceDialog({ mode, entry, coords, place, onClose, onSubmit }) {
  const editing = mode === 'edit'
  const dropped = mode === 'pin'
  const nearby = mode === 'nearby'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [picked, setPicked] = useState(editing ? entry.place : nearby ? place : null)
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {resolving ? (
          <p className="text-muted-foreground">Looking up that spot…</p>
        ) : !picked ? (
          <div className="grid gap-2.5">
            <Input
              autoFocus
              placeholder="Search a restaurant by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <p className="text-muted-foreground">Searching…</p>}
            {searchError && <p className="text-destructive">{searchError}</p>}
            {!searching && query.trim().length >= 3 && !results.length && (
              <p className="text-muted-foreground">
                No results. Try adding the city name — or close this and long-press the map where
                the place is.
              </p>
            )}
            <ul className="m-0 grid max-h-72 list-none gap-1.5 overflow-y-auto p-0">
              {results.map((r) => (
                <li key={`${r.osm_id}-${r.lat}`}>
                  <button
                    type="button"
                    className="grid w-full gap-0.5 rounded-lg bg-muted p-2 text-left hover:bg-muted/70"
                    onClick={() => setPicked(r)}
                  >
                    <strong>{r.name}</strong>
                    <span className="text-sm text-muted-foreground">{r.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form className="grid gap-3.5" onSubmit={handleSubmit}>
            {dropped ? (
              <div className="grid gap-1">
                <Label>Name</Label>
                <Input
                  autoFocus
                  required
                  placeholder="What's this place called?"
                  value={picked.name}
                  onChange={(e) => setPicked((p) => ({ ...p, name: e.target.value }))}
                />
                {picked.address && (
                  <span className="text-sm text-muted-foreground">{picked.address}</span>
                )}
              </div>
            ) : (
              <div className="grid gap-0.5 rounded-lg bg-muted p-2.5">
                <strong>{picked.name}</strong>
                {picked.address && (
                  <span className="text-sm text-muted-foreground">{picked.address}</span>
                )}
                {!editing && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto justify-self-start p-0 text-sm"
                    onClick={() => setPicked(null)}
                  >
                    Choose a different place
                  </Button>
                )}
              </div>
            )}

            {!editing && (
              <div className="grid gap-1">
                <Label>Cuisine (optional)</Label>
                <Input
                  list="cuisine-suggestions"
                  placeholder="Italian, sushi, ramen…"
                  value={picked.cuisine || ''}
                  onChange={(e) => setPicked((p) => ({ ...p, cuisine: e.target.value }))}
                />
                <datalist id="cuisine-suggestions">
                  {[
                    'Italian', 'Japanese', 'Sushi', 'Ramen', 'Thai', 'Vietnamese', 'Indian',
                    'Chinese', 'Korean', 'Mexican', 'Turkish', 'Middle Eastern', 'Greek',
                    'French', 'German', 'Vegan', 'Pizza', 'Burger', 'Breakfast', 'Bakery',
                    'Cafe', 'Bar',
                  ].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            )}

            <fieldset className="grid gap-1 border-none p-0 m-0">
              <Label>Status</Label>
              <div className="flex gap-2">
                {[
                  ['want_to_go', 'Want to go'],
                  ['visited', 'Visited'],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex-1 cursor-pointer rounded-lg border py-2 text-center text-sm ${
                      details.status === value ? 'border-primary text-primary' : 'border-input'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={details.status === value}
                      onChange={() => setDetails((d) => ({ ...d, status: value }))}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rating</span>
              <div className="flex gap-0.5">
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

            <div className="grid gap-1">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                placeholder="What to order, who recommended it…"
                value={details.notes}
                onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>

            <div className="grid gap-1">
              <Label>Photo URL (optional)</Label>
              <Input
                type="url"
                placeholder="https://…"
                value={details.photo_url}
                onChange={(e) => setDetails((d) => ({ ...d, photo_url: e.target.value }))}
              />
            </div>

            {saveError && <p className="text-destructive">{saveError}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add place'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
