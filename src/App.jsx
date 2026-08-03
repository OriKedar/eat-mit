import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { usePlaces } from './hooks/usePlaces'
import { useMockPlaces } from './hooks/useMockPlaces'
import { useOnline } from './hooks/useOnline'
import { useGeolocation } from './hooks/useGeolocation'
import Auth from './components/Auth'
import MapView from './components/MapView'
import PlaceList from './components/PlaceList'
import PlaceDialog from './components/PlaceDialog'
import UpdatePrompt from './components/UpdatePrompt'

// TEMP: lets the UI be tested locally with no Supabase project configured —
// skips Auth and feeds the map from useMockPlaces instead. Only ever active
// in `vite dev` with no .env (import.meta.env.DEV is false in prod builds,
// so this is dead code in anything shipped). Delete once real creds are
// available for local testing.
const DEV_MOCK = import.meta.env.DEV && !supabaseConfigured

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

  if (!supabaseConfigured && !DEV_MOCK) return <MissingConfig />
  if (DEV_MOCK) return <Home session={{ user: { id: 'dev-mock-user' } }} />
  return (
    <>
      <UpdatePrompt />
      {!authReady ? (
        <div className="boot">Loading…</div>
      ) : session ? (
        <Home session={session} />
      ) : (
        <Auth />
      )}
    </>
  )
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
  // Reads the module-level constant directly (not a prop) so the minifier
  // can fold this to `usePlaces` and drop useMockPlaces from prod bundles
  // entirely — DEV_MOCK is always false there, but a prop crossing a
  // function boundary can't be constant-folded the same way a same-scope
  // const can.
  const placesHook = DEV_MOCK ? useMockPlaces : usePlaces
  const { entries, loading, error, refresh, addEntry, updateEntry, deleteEntry } = placesHook(userId)
  const online = useOnline()
  const { position: me, state: locateState, locate } = useGeolocation()

  // null | {mode:'add'} | {mode:'edit', entry} | {mode:'pin', coords} | {mode:'nearby', place}
  const [dialog, setDialog] = useState(null)
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
          {!DEV_MOCK && <button onClick={() => supabase.auth.signOut()}>Sign out</button>}
        </div>
      </header>

      {!online && (
        <p className="banner banner-offline">
          Offline — the map still works, but saving and searching need a connection.
        </p>
      )}

      {error && (
        <p className="error banner">
          {error}
          <button className="banner-retry" onClick={refresh}>
            Retry
          </button>
        </p>
      )}

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
          <MapView
            entries={entries}
            focus={selected}
            onSelect={setSelected}
            onSelectNearby={(place) => setDialog({ mode: 'nearby', place })}
            me={me}
            locateState={locateState}
            onLocate={locate}
            onDropPin={(coords) => setDialog({ mode: 'pin', coords })}
          />
        </section>
        <aside className="list-pane">
          {loading && !entries.length ? (
            <ul className="skeleton-list">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="skeleton" />
              ))}
            </ul>
          ) : entries.length ? (
            <PlaceList
              entries={entries}
              selectedId={selected?.id}
              onSelect={setSelected}
              onEdit={(entry) => setDialog({ mode: 'edit', entry })}
              onDelete={handleDelete}
              me={me}
            />
          ) : (
            <div className="empty-state">
              <p>No places yet.</p>
              <button className="primary" onClick={() => setDialog({ mode: 'add' })}>
                Add your first
              </button>
              <p className="hint">Or long-press anywhere on the map to drop a pin.</p>
            </div>
          )}
        </aside>
      </main>

      {dialog && (
        <PlaceDialog
          mode={dialog.mode}
          entry={dialog.entry}
          coords={dialog.coords}
          place={dialog.place}
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
