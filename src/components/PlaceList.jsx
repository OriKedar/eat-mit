import { useMemo, useState } from 'react'
import { distanceKm, formatDistance } from '../lib/geo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const SORTS = {
  recent: { label: 'Recently added', cmp: (a, b) => b.created_at.localeCompare(a.created_at) },
  rating: { label: 'Rating', cmp: (a, b) => (b.rating || 0) - (a.rating || 0) },
  name: { label: 'Name', cmp: (a, b) => a.place.name.localeCompare(b.place.name) },
  distance: {
    label: 'Distance',
    // Only offered once we have a fix, so _km is always set when this runs.
    cmp: (a, b) => a._km - b._km,
    needsLocation: true,
  },
}

// Native <select> here on purpose, not shadcn's Select — these are plain
// filter controls with no need for custom-styled options, and native selects
// keep keyboard/testing behavior simple (no popup-open choreography).
const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export default function PlaceList({ entries, selectedId, onSelect, onEdit, onDelete, me }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [cuisineFilter, setCuisineFilter] = useState('all')
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState('recent')
  const [query, setQuery] = useState('')

  const cuisines = useMemo(() => {
    const seen = new Set()
    for (const e of entries) if (e.place.cuisine) seen.add(e.place.cuisine)
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [entries])

  const withDistance = useMemo(
    () => entries.map((e) => ({ ...e, _km: me ? distanceKm(me, e.place) : null })),
    [entries, me],
  )

  const activeSort = SORTS[sort].needsLocation && !me ? 'recent' : sort

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return withDistance
      .filter((e) => statusFilter === 'all' || e.status === statusFilter)
      .filter((e) => cuisineFilter === 'all' || e.place.cuisine === cuisineFilter)
      .filter((e) => (e.rating || 0) >= minRating)
      .filter(
        (e) =>
          !q ||
          e.place.name.toLowerCase().includes(q) ||
          (e.place.address || '').toLowerCase().includes(q) ||
          (e.place.cuisine || '').toLowerCase().includes(q) ||
          (e.notes || '').toLowerCase().includes(q),
      )
      .sort(SORTS[activeSort].cmp)
  }, [withDistance, statusFilter, cuisineFilter, minRating, activeSort, query])

  return (
    <div className="p-3.5">
      <div className="grid gap-2">
        <Input
          placeholder="Filter my places…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <select
            className={selectClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="want_to_go">Want to go</option>
            <option value="visited">Visited</option>
          </select>
          <select
            className={selectClass}
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
          >
            <option value={0}>Any rating</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}★ and up
              </option>
            ))}
          </select>
        </div>
        <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([key, { label, needsLocation }]) => (
            <option key={key} value={key} disabled={needsLocation && !me}>
              Sort: {label}
              {needsLocation && !me ? ' (locate first)' : ''}
            </option>
          ))}
        </select>
        {cuisines.length > 0 && (
          <select
            className={selectClass}
            value={cuisineFilter}
            onChange={(e) => setCuisineFilter(e.target.value)}
          >
            <option value="all">Any cuisine</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mt-3 mb-1.5 text-xs text-muted-foreground">
        {visible.length} of {entries.length}
      </p>

      <ul className="m-0 grid list-none gap-2 p-0">
        {visible.map((entry) => (
          <li
            key={entry.id}
            className={`cursor-pointer rounded-lg border bg-card p-3 ${
              entry.id === selectedId ? 'border-primary' : 'border-transparent'
            }`}
            onClick={() => onSelect(entry)}
          >
            <div className="flex items-center gap-2">
              <Badge className={`badge-${entry.status} border-none`}>
                {entry.status === 'visited' ? 'Visited' : 'Want to go'}
              </Badge>
              {entry.rating ? (
                <span className="text-sm text-destructive">{'★'.repeat(entry.rating)}</span>
              ) : null}
              {entry._km != null && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDistance(entry._km)}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 mb-0.5 text-base">{entry.place.name}</h3>
            {entry.place.cuisine && (
              <span className="mt-0.5 inline-block rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                {entry.place.cuisine}
              </span>
            )}
            {entry.place.address && (
              <p className="mt-0.5 mb-0 text-sm text-muted-foreground">{entry.place.address}</p>
            )}
            {entry.notes && <p className="mt-0.5 mb-0 text-sm text-muted-foreground">{entry.notes}</p>}
            <div className="mt-2.5 flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(entry)
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(entry)
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
        {!visible.length && <li className="py-4 text-muted-foreground">Nothing here yet.</li>}
      </ul>
    </div>
  )
}
