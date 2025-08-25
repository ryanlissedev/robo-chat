'use client'

import { useEffect, useState } from 'react'
import { GuestKeyModal, type StorageScope } from './GuestKeyModal'

export function GuestKeyPortal() {
  const [open, setOpen] = useState(false)
  const [defaultProviderId, setDefaultProviderId] = useState<string | undefined>(undefined)
  const [, setLastSaved] = useState<{ provider: string; masked: string; scope: StorageScope } | null>(null)

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail as { providerId?: string }
      setDefaultProviderId(detail?.providerId)
      setOpen(true)
    }
    window.addEventListener('guest-byok:open', onOpen as EventListener)
    return () => window.removeEventListener('guest-byok:open', onOpen as EventListener)
  }, [])

  return (
    <GuestKeyModal
      open={open}
      onOpenChange={setOpen}
      defaultProviderId={defaultProviderId}
      onSaved={(v) => setLastSaved(v)}
    />
  )
}

