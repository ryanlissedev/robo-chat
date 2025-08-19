"use client"

import { toast } from "@/components/ui/toast"
import { useChatSession } from "@/lib/chat-store/session/provider"
import type { UIMessage } from "ai"
import { createContext, useContext, useEffect, useState } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  setMessages as saveMessages,
} from "./api"

type MessagesContextType = {
  messages: UIMessage[]
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  refresh: () => Promise<void>
  saveAllMessages: (messages: UIMessage[]) => Promise<void>
  cacheAndAddMessage: (message: UIMessage) => void
  resetMessages: () => void
  deleteMessages: () => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | null>(null)

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context) {
    throw new Error("useMessages must be used within MessagesProvider")
  }
  return context
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { chatId } = useChatSession()

  useEffect(() => {
    if (chatId === null) {
      setMessages([])
      setIsLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    if (!chatId) {
      return
    }

    const load = async () => {
      setIsLoading(true)
      
      // Check if this is a guest user
      const isGuestUser = typeof window !== 'undefined' && 
        localStorage.getItem('guestChatId') === chatId

      if (isGuestUser) {
        // For guest users, only use cached messages
        const cached: UIMessage[] = await getCachedMessages(chatId)
        setMessages(cached)
        setIsLoading(false)
      } else {
        // For authenticated users, load cached first, then fresh
        const cached: UIMessage[] = await getCachedMessages(chatId)
        setMessages(cached)

        try {
          const fresh: UIMessage[] = await getMessagesFromDb(chatId)
          setMessages(fresh)
          cacheMessages(chatId, fresh)
        } catch {
          toast({ title: "Failed to fetch messages", status: "error" })
        } finally {
          setIsLoading(false)
        }
      }
    }

    load()
  }, [chatId])

  const refresh = async () => {
    if (!chatId) {
      return
    }

    try {
      const fresh: UIMessage[] = await getMessagesFromDb(chatId)
      setMessages(fresh)
    } catch {
      toast({ title: "Failed to refresh messages", status: "error" })
    }
  }

  const cacheAndAddMessage = (message: UIMessage) => {
    if (!chatId) {
      return
    }

    try {
      setMessages((prev) => {
        const updated = [...prev, message]
        writeToIndexedDB("messages", { id: chatId, messages: updated })
        return updated
      })
    } catch {
      toast({ title: "Failed to save message", status: "error" })
    }
  }

  const saveAllMessages = async (newMessages: UIMessage[]) => {
    // @todo: manage the case where the chatId is null (first time the user opens the chat)
    if (!chatId) {
      return
    }

    try {
      await saveMessages(chatId, newMessages)
      setMessages(newMessages)
    } catch {
      toast({ title: "Failed to save messages", status: "error" })
    }
  }

  const deleteMessages = async () => {
    if (!chatId) {
      return
    }

    setMessages([])
    await clearMessagesForChat(chatId)
  }

  const resetMessages = () => {
    setMessages([])
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages,
        refresh,
        saveAllMessages,
        cacheAndAddMessage,
        resetMessages,
        deleteMessages,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}
