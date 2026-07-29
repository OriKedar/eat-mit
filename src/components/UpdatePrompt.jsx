import { useRegisterSW } from 'virtual:pwa-register/react'

// registerType is 'prompt', so a new deploy waits behind this bar instead of
// swapping the app out mid-edit.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="update-bar" role="status">
      <span>New version available.</span>
      <div>
        <button className="primary" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
        <button onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    </div>
  )
}
