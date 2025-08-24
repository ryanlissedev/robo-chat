import type { Tables } from '@/app/types/database.types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseEnabled } from '@/lib/supabase/config';
// Loosen message typing to reduce coupling
import { readFromIndexedDB, writeToIndexedDB } from '../persist';

// Types for messages
type DatabaseMessage = Tables<'messages'>;

export interface MessageFromDB
  extends Omit<DatabaseMessage, 'id' | 'created_at'> {
  id: string;
  created_at?: string;
  createdAt?: Date;
}

type MessageToInsert = {
  role: 'system' | 'user' | 'assistant' | 'data';
  content: string;
  parts?: unknown;
  experimental_attachments?: Array<{
    url: string;
    name: string;
    contentType: string;
  }>;
  message_group_id?: string;
  model?: string;
  createdAt?: Date;
};

export async function getMessagesFromDb(
  chatId: string
): Promise<MessageFromDB[]> {
  // fallback to local cache only
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId);
    return cached;
  }

  const supabase = createClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, content, role, experimental_attachments, created_at, parts, message_group_id, model, chat_id'
    )
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (!data || error) {
    return [];
  }

  return data.map((message: DatabaseMessage): MessageFromDB => {
    const { id, created_at, ...rest } = message;
    return {
      ...rest,
      id: String(id),
      content: message.content ?? '',
      createdAt: new Date(created_at || ''),
      parts: message.parts || null,
      message_group_id: message.message_group_id,
      model: message.model,
    };
  });
}

async function insertMessageToDb(chatId: string, message: MessageToInsert) {
  const supabase = createClient();
  if (!supabase) {
    return;
  }

  await supabase.from('messages').insert({
    chat_id: chatId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimental_attachments?.filter(att => att.url && att.name && att.contentType),
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  });
}

async function insertMessagesToDb(chatId: string, messages: MessageToInsert[]) {
  const supabase = createClient();
  if (!supabase) {
    return;
  }

  const payload = messages.map((message) => ({
    chat_id: chatId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimental_attachments?.filter(att => att.url && att.name && att.contentType),
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  }));

  await supabase.from('messages').insert(payload);
}

async function deleteMessagesFromDb(chatId: string) {
  const supabase = createClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('chat_id', chatId);

  if (error) {
  }
}

type ChatMessageEntry = {
  id: string;
  messages: MessageFromDB[];
};

export async function getCachedMessages(
  chatId: string
): Promise<MessageFromDB[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>('messages', chatId);

  if (!entry || Array.isArray(entry)) {
    return [];
  }

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  );
}

export async function cacheMessages(
  chatId: string,
  messages: MessageFromDB[]
): Promise<void> {
  await writeToIndexedDB('messages', { id: chatId, messages });
}

export async function addMessage(
  chatId: string,
  message: MessageToInsert
): Promise<void> {
  await insertMessageToDb(chatId, message);
  const current = await getCachedMessages(chatId);
  const updated = [...current, message];

  await writeToIndexedDB('messages', { id: chatId, messages: updated });
}

export async function setMessages(
  chatId: string,
  messages: MessageToInsert[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages);
  await writeToIndexedDB('messages', { id: chatId, messages });
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB('messages', { id: chatId, messages: [] });
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId);
  await clearMessagesCache(chatId);
}
