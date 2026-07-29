import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { usePlaces } from './hooks/usePlaces'
import Auth from './components/Auth'
import MapView from './components/MapView'
import PlaceList from './components/PlaceList'
import PlaceDialog from './components/PlaceDialog'

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) return <MissingConfig />
  if (!authReady) return <div className="boot">Loading…</div>
  if (!session) return <Auth />
  return <Home session={session} />
}

function MissingConfig() {
  return (
    <div className="boot boot-error">
      <h1>Not configured</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env</code> and fill in{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from your Supabase
        project, then restart the dev server.
      </p>
    </div>
  )
}

function Home({ session }) {
  const userId = session.user.id
  const { entries, loading, error, addEntry, updateEntry, deleteEntry } = usePlaces(userId)

  const [dialog, setDialog] = useState(null) // null | {mode:'add'} | {mode:'edit', entry}
  const [selected, setSelected] = useState(null)
  const [mobileTab, setMobileTab] = useState('map')

  async function handleDelete(entry) {
    if (!window.confirm(`Delete "${entry.place.name}" from your map?`)) return
    if (selected?.id === entry.id) setSelected(null)
    await deleteEntry(entry.id)
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Food Map</h1>
        <div className="topbar-right">
          <button className="primary" onClick={() => setDialog({ mode: 'add' })}>
            + Add place
          </button>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      <nav className="mobile-tabs">
        {['map', 'list'].map((tab) => (
          <button
            key={tab}
            className={mobileTab === tab ? 'active' : ''}
            onClick={() => setMobileTab(tab)}
          >
            {tab === 'map' ? 'Map' : 'List'}
          </button>
        ))}
      </nav>

      <main className={`layout show-${mobileTab}`}>
        <section className="map-pane">
          <MapView entries={entries} focus={selected} onSelect={setSelected} />
        </section>
        <aside className="list-pane">
          {loading ? (
            <p className="hint pad">Loading your places…</p>
          ) : entries.length ? (
            <PlaceList
              entries={entries}
              selectedId={selected?.id}
              onSelect={setSelected}
              onEdit={(entry) => setDialog({ mode: 'edit', entry })}
              onDelete={handleDelete}
            />
          ) : (
            <div className="empty-state">
              <p>No places yet.</p>
              <button className="primary" onClick={() => setDialog({ mode: 'add' })}>
                Add your first
              </button>
            </div>
          )}
        </aside>
      </main>

      {dialog && (
        <PlaceDialog
          mode={dialog.mode}
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onSubmit={(place, details) =>
            dialog.mode === 'edit'
              ? updateEntry(dialog.entry.id, details)
              : addEntry(place, details)
          }
        />
      )}
    </div>
  )
}
