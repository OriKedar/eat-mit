import { useMemo, useState } from 'react'

const SORTS = {
  recent: { label: 'Recently added', cmp: (a, b) => b.created_at.localeCompare(a.created_at) },
  rating: { label: 'Rating', cmp: (a, b) => (b.rating || 0) - (a.rating || 0) },
  name: { label: 'Name', cmp: (a, b) => a.place.name.localeCompare(b.place.name) },
}

export default function PlaceList({ entries, selectedId, onSelect, onEdit, onDelete }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState('recent')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => statusFilter === 'all' || e.status === statusFilter)
      .filter((e) => (e.rating || 0) >= minRating)
      .filter(
        (e) =>
          !q ||
          e.place.name.toLowerCase().includes(q) ||
          (e.place.address || '').toLowerCase().includes(q) ||
          (e.notes || '').toLowerCase().includes(q),
      )
      .sort(SORTS[sort].cmp)
  }, [entries, statusFilter, minRating, sort, query])

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
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
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
            </div>
            <h3 className="entry-name">{entry.place.name}</h3>
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
