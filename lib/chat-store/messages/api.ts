import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { toast } from "@/components/ui/toast"
import type { UIMessage, FileUIPart } from "ai"
import type { Attachment } from "@/app/types/api.types"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

interface MessageWithExtensions extends UIMessage {
  message_group_id?: string
  model?: string
}

// Helper function to safely convert date to ISO string
function toISOStringSafe(date: string | Date | undefined): string {
  if (!date) return new Date().toISOString()
  if (typeof date === 'string') return new Date(date).toISOString()
  return date.toISOString()
}

type DbRow = {
  id: string | number
  content: string | null
  role: string
  experimental_attachments?: FileUIPart[]
  created_at: string | null
  parts?: UIMessage["parts"] | null
  message_group_id?: string | null
  model?: string | null
}

export async function getMessagesFromDb(
  chatId: string
): Promise<UIMessage[]> {
  // fallback to local cache only
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId)
    return cached
  }

  // For guest users, always use cached messages
  // Check if this is a guest chat by looking for the chat ID in localStorage
  if (typeof window !== 'undefined') {
    const guestChatId = localStorage.getItem("guestChatId")
    if (guestChatId === chatId) {
      const cached = await getCachedMessages(chatId)
      return cached
    }
  }

  const supabase = createClient()
  if (!supabase) {
    toast({ title: "Supabase not initialized", status: "error" })
    return []
  }

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, content, role, experimental_attachments, created_at, parts, message_group_id, model"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (!data || error) {
    // For guest users, fallback to cached messages if database fails
    if (error?.code === 'PGRST116' || error?.message?.includes('Row level security')) {
      const cached = await getCachedMessages(chatId)
      if (cached.length > 0) {
        return cached
      }
    }
    
    toast({
      title: "Failed to fetch messages",
      status: "error",
      description: error?.message,
    })
    return []
  }

  return data.map((r: unknown) => {
    const row = r as DbRow
    const existingParts = row.parts ?? undefined
    const content = row.content ?? ""
    let finalParts: UIMessage["parts"]
    if (existingParts && Array.isArray(existingParts) && existingParts.length > 0) {
      finalParts = existingParts
    } else if (content) {
      finalParts = [{ type: "text" as const, text: content }]
    } else {
      finalParts = []
    }

    return {
      id: String(row.id),
      role: row.role as UIMessage["role"],
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      content:
        finalParts.length > 0
          ? finalParts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n")
          : content,
      parts: finalParts,
    } satisfies UIMessage
  })
}

async function insertMessageToDb(chatId: string, message: UIMessage) {
  // For guest users, skip database insertion
  if (typeof window !== 'undefined') {
    const guestChatId = localStorage.getItem("guestChatId")
    if (guestChatId === chatId) {
      return // Guest messages are only stored in IndexedDB
    }
  }
  
  const supabase = createClient()
  if (!supabase) {
    return
  }

  // derive legacy fields from parts for backward compatibility
  let content: string | null = null
  if (message.parts) {
    const textParts = message.parts.filter(
      (p): p is { type: "text"; text: string } => p.type === "text"
    )
    content = textParts.length ? textParts.map((p) => p.text).join("\n") : null
  }
  let experimental_attachments: Attachment[] | undefined = undefined
  const maybe: unknown = message
  if (
    typeof maybe === "object" &&
    maybe !== null &&
    "experimental_attachments" in (maybe as Record<string, unknown>)
  ) {
    const attachments = (maybe as Record<string, unknown>).experimental_attachments
    if (Array.isArray(attachments)) {
      experimental_attachments = attachments as Attachment[]
    }
  }

  await supabase.from("messages").insert({
    chat_id: chatId,
    role: message.role,
    content,
    experimental_attachments,
    created_at: toISOStringSafe(message.createdAt),
    message_group_id:
      (message as MessageWithExtensions).message_group_id || null,
    model: (message as MessageWithExtensions).model || null,
  })
}

async function insertMessagesToDb(chatId: string, messages: UIMessage[]) {
  // For guest users, skip database insertion
  if (typeof window !== 'undefined') {
    const guestChatId = localStorage.getItem("guestChatId")
    if (guestChatId === chatId) {
      return // Guest messages are only stored in IndexedDB
    }
  }
  
  const supabase = createClient()
  if (!supabase) {
    return
  }

  const payload = messages.map((message) => {
    let content: string | null = null
    if (message.parts) {
      const textParts = message.parts.filter(
        (p): p is { type: "text"; text: string } => p.type === "text"
      )
      content = textParts.length
        ? textParts.map((p) => p.text).join("\n")
        : null
    }
    let experimental_attachments: Attachment[] | undefined = undefined
    const maybe: unknown = message
    if (
      typeof maybe === "object" &&
      maybe !== null &&
      "experimental_attachments" in (maybe as Record<string, unknown>)
    ) {
      const attachments = (maybe as Record<string, unknown>).experimental_attachments
      if (Array.isArray(attachments)) {
        experimental_attachments = attachments as Attachment[]
      }
    }
    return {
      chat_id: chatId,
      role: message.role,
      content,
      experimental_attachments,
      created_at: toISOStringSafe(message.createdAt),
      message_group_id:
        (message as MessageWithExtensions).message_group_id || null,
      model: (message as MessageWithExtensions).model || null,
    }
  })

  await supabase.from("messages").insert(payload)
}

async function deleteMessagesFromDb(chatId: string) {
  const supabase = createClient()
  if (!supabase) {
    return
  }

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId)

  if (error) {
    toast({
      title: "Failed to clear messages from database",
      status: "error",
      description: error.message,
    })
  }
}

type ChatMessageEntry = {
  id: string
  messages: UIMessage[]
}

export async function getCachedMessages(
  chatId: string
): Promise<UIMessage[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) {
    return []
  }

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: UIMessage[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: UIMessage
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: UIMessage[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
