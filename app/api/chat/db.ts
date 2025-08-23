import type {
  ContentPart,
  Message,
  StoreAssistantMessageParams,
} from '@/app/types/api.types';
import type { Json } from '@/app/types/database.types';

const DEFAULT_STEP = 0;

type ProcessedMessage = {
  parts: ContentPart[];
  textParts: string[];
  toolMap: Map<string, ContentPart>;
};

function processTextPart(part: ContentPart, processed: ProcessedMessage): void {
  if (part.text) {
    processed.textParts.push(part.text);
  }
  processed.parts.push(part);
}

function processToolInvocation(
  part: ContentPart,
  processed: ProcessedMessage
): void {
  const { toolInvocation } = part;
  if (!toolInvocation?.toolCallId) {
    return;
  }

  const { toolCallId, state } = toolInvocation;
  const existing = processed.toolMap.get(toolCallId);

  if (state === 'result' || !existing) {
    processed.toolMap.set(toolCallId, {
      ...part,
      toolInvocation: {
        ...toolInvocation,
        args: toolInvocation.args || {},
      },
    });
  }
}

function processReasoningPart(
  part: ContentPart,
  processed: ProcessedMessage
): void {
  const reasoningText = part.text || '';
  processed.parts.push({
    type: 'reasoning',
    reasoningText,
    details: [{ type: 'text', text: reasoningText }],
  });
}

function processToolResult(
  part: ContentPart,
  processed: ProcessedMessage
): void {
  const toolCallId = part.toolCallId || '';
  processed.toolMap.set(toolCallId, {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      step: DEFAULT_STEP,
      toolCallId,
      toolName: part.toolName || '',
      result: part.result,
    },
  });
}

function processAssistantContent(
  content: ContentPart[],
  processed: ProcessedMessage
): void {
  for (const part of content) {
    switch (part.type) {
      case 'text':
        processTextPart(part, processed);
        break;
      case 'tool-invocation':
        processToolInvocation(part, processed);
        break;
      case 'reasoning':
        processReasoningPart(part, processed);
        break;
      case 'step-start':
        processed.parts.push(part);
        break;
      default:
        // Ignore unknown part types
        break;
    }
  }
}

function processToolContent(
  content: ContentPart[],
  processed: ProcessedMessage
): void {
  for (const part of content) {
    if (part.type === 'tool-result') {
      processToolResult(part, processed);
    }
  }
}

function processMessages(messages: Message[]): ProcessedMessage {
  const processed: ProcessedMessage = {
    parts: [],
    textParts: [],
    toolMap: new Map(),
  };

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) {
      continue;
    }

    if (msg.role === 'assistant') {
      processAssistantContent(msg.content, processed);
    } else if (msg.role === 'tool') {
      processToolContent(msg.content, processed);
    }
  }

  return processed;
}

// Main function using options pattern (preferred)
export async function storeAssistantMessage(
  params: StoreAssistantMessageParams
): Promise<void> {
  const { supabase, chatId, messages, message_group_id, model } = params;
  const processed = processMessages(messages);

  // Merge tool parts at the end
  processed.parts.push(...processed.toolMap.values());

  const finalPlainText = processed.textParts.join('\n\n');

  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: finalPlainText || '',
    parts: processed.parts as unknown as Json,
    message_group_id,
    model,
  });

  if (error) {
    throw new Error(`Failed to save assistant message: ${error.message}`);
  }
}
