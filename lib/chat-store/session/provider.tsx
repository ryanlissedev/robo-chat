"use client"

import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, useMemo } from "react"

const ChatSessionContext = createContext<{ chatId: string | null }>({
  chatId: null,
})

export const useChatSession = () => useContext(ChatSessionContext)

export function ChatSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const chatId = useMemo(() => {
    if (pathname?.startsWith("/c/")) return pathname.split("/c/")[1]
    return null
  }, [pathname])

  // Track guest chat ID when navigating to a chat page
  useEffect(() => {
    if (chatId && typeof window !== 'undefined') {
      const storedGuestChatId = localStorage.getItem('guestChatId')
      // If this is the guest chat, ensure it's tracked
      if (!storedGuestChatId || storedGuestChatId === chatId) {
        localStorage.setItem('guestChatId', chatId)
      }
    }
  }, [chatId])

  return (
    <ChatSessionContext.Provider value={{ chatId }}>
      {children}
    </ChatSessionContext.Provider>
  )
}
