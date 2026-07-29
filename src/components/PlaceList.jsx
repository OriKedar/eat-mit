import { useMemo, useState } from 'react'
import { distanceKm, formatDistance } from '../lib/geo'

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
    <div className="list-panel">
      <div className="filters">
        <input
          className="filter-search"
          placeholder="Filter my places…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filter-row">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="want_to_go">Want to go</option>
            <option value="visited">Visited</option>
          </select>
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            <option value={0}>Any rating</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}★ and up
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([key, { label, needsLocation }]) => (
              <option key={key} value={key} disabled={needsLocation && !me}>
                {label}
                {needsLocation && !me ? ' (locate first)' : ''}
              </option>
            ))}
          </select>
        </div>
        {cuisines.length > 0 && (
          <select
            className="cuisine-filter"
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

      <p className="list-count">
        {visible.length} of {entries.length}
      </p>

      <ul className="entry-list">
        {visible.map((entry) => (
          <li
            key={entry.id}
            className={`entry ${entry.id === selectedId ? 'entry-selected' : ''}`}
            onClick={() => onSelect(entry)}
          >
            <div className="entry-head">
              <span className={`badge badge-${entry.status}`}>
                {entry.status === 'visited' ? 'Visited' : 'Want to go'}
              </span>
              {entry.rating ? <span className="stars">{'★'.repeat(entry.rating)}</span> : null}
              {entry._km != null && (
                <span className="distance">{formatDistance(entry._km)}</span>
              )}
            </div>
            <h3 className="entry-name">{entry.place.name}</h3>
            {entry.place.cuisine && <span className="cuisine-tag">{entry.place.cuisine}</span>}
            {entry.place.address && <p className="entry-address">{entry.place.address}</p>}
            {entry.notes && <p className="entry-notes">{entry.notes}</p>}
            <div className="entry-actions">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(entry)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(entry)
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {!visible.length && <li className="empty">Nothing here yet.</li>}
      </ul>
    </div>
  )
}
