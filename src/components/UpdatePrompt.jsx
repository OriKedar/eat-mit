import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

// registerType is 'prompt', so a new deploy waits behind this bar instead of
// swapping the app out mid-edit.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[1200] flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-card py-2.5 pr-3 pl-4 shadow-lg"
    >
      <span className="flex-1 text-sm">New version available.</span>
      <div className="flex gap-1.5">
        <Button size="sm" className="rounded-full" onClick={() => updateServiceWorker(true)}>
          Reload
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
      </div>
    </div>
  )
}
