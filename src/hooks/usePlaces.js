import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Every row here is one user_places entry joined to its shared place.
// RLS already scopes the select to the logged-in user; the explicit
// .eq('user_id') is belt-and-braces and lets Postgres use the index.
const SELECT = `
  id, status, rating, notes, photo_url, created_at, updated_at, place_id,
  place:places ( id, name, lat, lng, address, osm_id, cuisine )
`

export function usePlaces(userId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('user_places')
      .select(SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else {
      setEntries(data.filter((row) => row.place))
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Reuse an existing place row when the same OSM feature was already added
  // (by anyone) — places is a shared pool, one restaurant should exist once.
  const findOrCreatePlace = useCallback(async (place) => {
    if (place.osm_id) {
      const { data: existing, error } = await supabase
        .from('places')
        .select('id')
        .eq('osm_id', place.osm_id)
        .limit(1)
      if (error) throw error
      if (existing?.length) return existing[0].id
    }

    const { data, error } = await supabase
      .from('places')
      .insert({
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        osm_id: place.osm_id,
        cuisine: place.cuisine,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }, [])

  const addEntry = useCallback(
    async (place, { status, rating, notes, photo_url }) => {
      const placeId = await findOrCreatePlace(place)
      const { error } = await supabase.from('user_places').upsert(
        {
          user_id: userId,
          place_id: placeId,
          status,
          rating: rating || null,
          notes: notes || null,
          photo_url: photo_url || null,
        },
        { onConflict: 'user_id,place_id' },
      )
      if (error) throw error
      await refresh()
    },
    [userId, findOrCreatePlace, refresh],
  )

  const updateEntry = useCallback(
    async (entryId, patch) => {
      const { error } = await supabase
        .from('user_places')
        .update({
          status: patch.status,
          rating: patch.rating || null,
          notes: patch.notes || null,
          photo_url: patch.photo_url || null,
        })
        .eq('id', entryId)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const deleteEntry = useCallback(
    async (entryId) => {
      const { error } = await supabase.from('user_places').delete().eq('id', entryId)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  return { entries, loading, error, refresh, addEntry, updateEntry, deleteEntry }
}
