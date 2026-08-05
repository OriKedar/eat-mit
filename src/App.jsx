import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { usePlaces } from './hooks/usePlaces'
import { useMockPlaces } from './hooks/useMockPlaces'
import { useOnline } from './hooks/useOnline'
import { useGeolocation } from './hooks/useGeolocation'
import { useTheme } from './hooks/useTheme'
import { Button } from '@/components/ui/button'
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
  const { theme, toggleTheme } = useTheme()

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
  if (DEV_MOCK) {
    return <Home session={{ user: { id: 'dev-mock-user' } }} theme={theme} onToggleTheme={toggleTheme} />
  }
  return (
    <>
      <UpdatePrompt />
      {!authReady ? (
        <div className="grid h-full place-content-center p-8 text-center text-muted-foreground">
          Loading…
        </div>
      ) : session ? (
        <Home session={session} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <Auth />
      )}
    </>
  )
}

function MissingConfig() {
  return (
    <div className="mx-auto grid h-full max-w-lg place-content-center gap-2 p-8 text-center">
      <h1>Not configured</h1>
      <p className="text-muted-foreground">
        Copy <code>.env.example</code> to <code>.env</code> and fill in{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from your Supabase
        project, then restart the dev server.
      </p>
    </div>
  )
}

function Home({ session, theme, onToggleTheme }) {
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
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <h1 className="m-0 text-[1.05rem]">Food Map</h1>
        <div className="flex gap-2">
          <Button onClick={() => setDialog({ mode: 'add' })}>+ Add place</Button>
          {!DEV_MOCK && (
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          )}
        </div>
      </header>

      {!online && (
        <p className="m-0 flex items-center justify-between gap-3 bg-amber-950/40 px-4 py-2.5 text-[0.88rem] text-amber-200 dark:bg-amber-950/40">
          Offline — the map still works, but saving and searching need a connection.
        </p>
      )}

      {error && (
        <p className="m-0 flex items-center justify-between gap-3 bg-destructive/15 px-4 py-2.5 text-[0.88rem] text-destructive">
          {error}
          <Button size="sm" variant="outline" onClick={refresh}>
            Retry
          </Button>
        </p>
      )}

      <nav className="mobile-tabs border-b border-border bg-card">
        {['map', 'list'].map((tab) => (
          <button
            key={tab}
            className={`border-none bg-transparent px-0 py-2.5 text-muted-foreground ${
              mobileTab === tab ? 'text-primary shadow-[inset_0_-2px_0_var(--primary)]' : ''
            }`}
            onClick={() => setMobileTab(tab)}
          >
            {tab === 'map' ? 'Map' : 'List'}
          </button>
        ))}
      </nav>

      <main className={`layout show-${mobileTab} grid min-h-0 flex-1 md:grid-cols-[1fr_22rem]`}>
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
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        </section>
        <aside className="list-pane border-l border-border bg-card">
          {loading && !entries.length ? (
            <ul className="m-0 grid list-none gap-2 p-3.5">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="skeleton h-22" />
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
            <div className="grid justify-items-center gap-3 p-10 text-center text-muted-foreground">
              <p>No places yet.</p>
              <Button onClick={() => setDialog({ mode: 'add' })}>Add your first</Button>
              <p className="text-sm">Or long-press anywhere on the map to drop a pin.</p>
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
