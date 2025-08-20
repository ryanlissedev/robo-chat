"use client"

import { toast } from "@/components/ui/toast"
import { useChatSession } from "@/lib/chat-store/session/provider"
import type { UIMessage as MessageAISDK } from "ai"
import { createContext, useContext } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  setMessages as saveMessages,
} from "./api"
import { useQuery, useQueryClient } from "@tanstack/react-query"

interface MessagesContextType {
  messages: undefined[]
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<undefined[]>>
  refresh: () => Promise<void>
  saveAllMessages: (messages: undefined[]) => Promise<void>
  cacheAndAddMessage: (message: undefined) => Promise<void>
  resetMessages: () => Promise<void>
  deleteMessages: () => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | null>(null)

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context)
    throw new Error("useMessages must be used within MessagesProvider")
  return context
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { chatId } = useChatSession()
  const queryClient = useQueryClient()

  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ["messages", chatId],
    enabled: Boolean(chatId),
    queryFn: async () => {
      const cached = await getCachedMessages(chatId!)
      try {
        const fresh = await getMessagesFromDb(chatId!)
        await cacheMessages(chatId!, fresh)
        return fresh
      } catch (error) {
        console.error("Failed to fetch messages:", error)
        return cached
      }
    },
    initialData: chatId ? undefined : [],
  })

  const refresh = async () => {
    if (!chatId) return
    try {
      await queryClient.invalidateQueries({ queryKey: ["messages", chatId] })
    } catch {
      toast({ title: "Failed to refresh messages", status: "error" })
    }
  }

  const cacheAndAddMessage = async (message: any) => {
    if (!chatId) return
    try {
      queryClient.setQueryData<any[]>(["messages", chatId], (prev) => {
        const updated = [
          ...((prev as undefined[] | undefined) || []),
          message,
        ]
        writeToIndexedDB("messages", { id: chatId, messages: updated })
        return updated
      })
    } catch {
      toast({ title: "Failed to save message", status: "error" })
    }
  }

  const saveAllMessages = async (newMessages: any[]) => {
    if (!chatId) return
    try {
      await saveMessages(chatId, newMessages)
      queryClient.setQueryData(["messages", chatId], newMessages)
    } catch {
      toast({ title: "Failed to save messages", status: "error" })
    }
  }

  const deleteMessages = async () => {
    if (!chatId) return
    queryClient.setQueryData(["messages", chatId], [])
    await clearMessagesForChat(chatId)
  }

  const resetMessages = async () => {
    if (!chatId) return
    queryClient.setQueryData(["messages", chatId], [])
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages: (updater) => {
          if (!chatId) return
          const key = ["messages", chatId]
          const current = queryClient.getQueryData<undefined[]>(key) || []
          const next =
            typeof updater === "function"
              ? (updater as (prev: undefined[]) => undefined[])(current)
              : updater
          queryClient.setQueryData(key, next)
        },
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
