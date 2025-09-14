import {
  incrementMessageCount,
  logUserMessage,
  validateAndTrackUsage,
} from '@/app/api/chat/api';
import { getMessageContent } from '@/app/types/ai-extended';
import logger from '@/lib/utils/logger';
import { MessageService } from './MessageService';
import { ModelConfigurationService } from './ModelConfigurationService';
import type {
  ExtendedUIMessage,
  SupabaseClientType,
  ValidatedChatRequest,
} from './types';

export class RequestValidator {
  /**
   * Validates the request and tracks usage, returning the Supabase client for logging/quotas.
   */
  static async validateAndTrackUsage({
    userId,
    model,
    isAuthenticated,
    hasGuestCredentials,
  }: {
    userId: string;
    model: string;
    isAuthenticated: boolean;
    hasGuestCredentials: boolean;
  }): Promise<SupabaseClientType | null> {
    return await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
      hasGuestCredentials,
    });
  }

  /**
   * Checks if the request has guest credentials in headers.
   */
  static hasGuestCredentials(req: Request): boolean {
    // Support common header casings; do not throw if headers absent.
    const h = req.headers;
    return Boolean(h.get('x-provider-api-key') || h.get('X-Provider-Api-Key'));
  }

  /**
   * Prepares messages for the provider by transforming and validating them.
   */
  static prepareCompatibleMessages(raw: unknown[]): ExtendedUIMessage[] {
    const transformed = MessageService.transformMessagesToV5Format(raw);
    if (!Array.isArray(transformed)) {
      throw new Error('Failed to transform messages');
    }

    const validated = MessageService.filterValidMessages(transformed);
    if (validated.length === 0) {
      const err = new Error('No valid messages to process');
      // Throw to be shaped by the outer catch into a Response.
      throw err;
    }

    const uiMessages = MessageService.convertToExtendedUIMessages(validated);
    return MessageService.createCompatibleMessages(uiMessages);
  }

  /**
   * Increment message counters and persist the last user message preview + attachments.
   * Best-effort; never throws.
   */
  static async handleUserMessageLogging({
    supabase,
    userId,
    chatId,
    messages,
    messageGroupId,
  }: {
    supabase: SupabaseClientType | null;
    userId: string;
    chatId: string;
    messages: ExtendedUIMessage[];
    messageGroupId?: string;
  }): Promise<void> {
    if (!supabase) return;

    try {
      type Attachment = import('@ai-sdk/ui-utils').Attachment;

      await incrementMessageCount({ supabase, userId });

      const lastUser = messages.at(-1);
      if (lastUser?.role === 'user') {
        const textContent = getMessageContent(lastUser);
        const attachments = (lastUser.experimental_attachments ||
          []) as Attachment[];

        await logUserMessage({
          supabase,
          userId,
          chatId,
          content: textContent,
          attachments,
          message_group_id: messageGroupId,
        });
      }
    } catch (e) {
      // Swallow logging errors; do not impact the main flow.
      logger.warn(
        { at: 'userMessageLogging', error: e },
        'Non-fatal logging error'
      );
    }
  }

  /**
   * Resolves the model ID and validates the request data.
   */
  static validateRequestData(requestData: ValidatedChatRequest): {
    resolvedModel: string;
    effectiveSettings: {
      reasoningEffort: string;
      verbosity: string;
    };
  } {
    const {
      model,
      reasoningEffort = 'medium',
      verbosity = 'medium',
    } = requestData;

    const resolvedModel = ModelConfigurationService.resolveModelId(model);
    const effectiveSettings = {
      reasoningEffort,
      verbosity,
    };

    return { resolvedModel, effectiveSettings };
  }

  /**
   * Extracts the last user text from messages for logging and retrieval.
   */
  static getLastUserText(messages: ExtendedUIMessage[]): string {
    const last = messages.at(-1);
    return last ? (getMessageContent(last) ?? '') : '';
  }

  /**
   * Creates a preview of text for logging purposes.
   */
  static getPreview(text: string | undefined | null, max = 500): string {
    if (!text) return '';
    const trimmed = String(text).trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  }
}
