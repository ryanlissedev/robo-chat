import { toast } from "@/components/ui/toast"
import { SupabaseClient } from "@supabase/supabase-js"
import * as fileType from "file-type"
import { DAILY_FILE_UPLOAD_LIMIT } from "./config"
import { createClient } from "./supabase/client"
import { isSupabaseEnabled } from "./supabase/config"

// AI SDK v5 compatible attachment type
export interface AIAttachment {
  name: string
  contentType: string
  url: string
  // AI SDK v5 fields
  size?: number
  uploadedAt?: Date
  metadata?: Record<string, any>
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export type Attachment = AIAttachment

export async function validateFile(
  file: File
): Promise<{ isValid: boolean; error?: string }> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  const buffer = await file.arrayBuffer()
  const type = await fileType.fileTypeFromBuffer(
    Buffer.from(buffer.slice(0, 4100))
  )

  if (!type || !ALLOWED_FILE_TYPES.includes(type.mime)) {
    return {
      isValid: false,
      error: "File type not supported or doesn't match its extension",
    }
  }

  return { isValid: true }
}

export async function uploadFile(
  supabase: SupabaseClient,
  file: File
): Promise<string> {
  const fileExt = file.name.split(".").pop()
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `uploads/${fileName}`

  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(filePath, file)

  if (error) {
    throw new Error(`Error uploading file: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-attachments").getPublicUrl(filePath)

  return publicUrl
}

export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url,
    size: file.size,
    uploadedAt: new Date(),
  }
}

/**
 * Create optimistic attachments for immediate UI feedback
 * AI SDK v5 pattern for better UX
 */
export function createOptimisticAttachments(files: File[]): Attachment[] {
  return files.map(file => ({
    name: file.name,
    contentType: file.type,
    url: URL.createObjectURL(file),
    size: file.size,
    uploadedAt: new Date(),
    metadata: {
      optimistic: true,
    },
  }))
}

/**
 * Clean up optimistic attachments to prevent memory leaks
 */
export function cleanupOptimisticAttachments(attachments?: Attachment[]) {
  if (!attachments) return
  
  attachments.forEach(attachment => {
    if (attachment.metadata?.optimistic && attachment.url.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.url)
    }
  })
}

export async function processFiles(
  files: File[],
  chatId: string,
  userId: string
): Promise<Attachment[]> {
  const supabase = isSupabaseEnabled ? createClient() : null
  
  // Process files in parallel for better performance
  const filePromises = files.map(async (file) => {
    try {
      const validation = await validateFile(file)
      if (!validation.isValid) {
        console.warn(`File ${file.name} validation failed:`, validation.error)
        toast({
          title: "File validation failed",
          description: validation.error,
          status: "error",
        })
        return null
      }

      const url = supabase
        ? await uploadFile(supabase, file)
        : URL.createObjectURL(file)

      if (supabase) {
        const { error } = await supabase.from("chat_attachments").insert({
          chat_id: chatId,
          user_id: userId,
          file_url: url,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })

        if (error) {
          throw new Error(`Database insertion failed: ${error.message}`)
        }
      }

      // Return AI SDK v5 compatible attachment
      return {
        name: file.name,
        contentType: file.type,
        url,
        size: file.size,
        uploadedAt: new Date(),
        metadata: {
          chatId,
          userId,
        },
      } as Attachment
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      return null
    }
  })

  const results = await Promise.all(filePromises)
  return results.filter((attachment): attachment is Attachment => attachment !== null)
}

export class FileUploadLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_FILE_LIMIT_REACHED"
  }
}

export async function checkFileUploadLimit(userId: string) {
  if (!isSupabaseEnabled) return 0

  const supabase = createClient()

  if (!supabase) {
    toast({
      title: "File upload is not supported in this deployment",
      status: "info",
    })
    return 0
  }

  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const { count, error } = await supabase
    .from("chat_attachments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString())

  if (error) throw new Error(error.message)
  if (count && count >= DAILY_FILE_UPLOAD_LIMIT) {
    throw new FileUploadLimitError("Daily file upload limit reached.")
  }

  return count
}
