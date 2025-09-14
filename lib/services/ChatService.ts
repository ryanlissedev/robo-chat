import { createErrorResponse } from '@/app/api/chat/utils';
import logger from '@/lib/utils/logger';
import { AIStreamHandler } from './AIStreamHandler';
import { ChatContextBuilder } from './ChatContextBuilder';
import { CredentialService } from './CredentialService';
import { ModelConfigurationService } from './ModelConfigurationService';
import { RequestValidator } from './RequestValidator';
import { RetrievalService } from './RetrievalService';
import type { ValidatedChatRequest } from './types';

export class ChatService {
  /**
   * Entry point: process a chat request and return a streamed Response.
   *
   * This method coordinates the entire chat processing workflow by delegating
   * to specialized services for validation, context building, retrieval, and streaming.
   */
  static async processChatRequest(
    req: Request,
    requestData: ValidatedChatRequest
  ): Promise<Response> {
    try {
      const {
        messages,
        chatId,
        userId,
        model,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        messageGroupId,
        reasoningEffort = 'medium',
        verbosity = 'medium',
        reasoningSummary = 'auto',
        context = 'chat',
        personalityMode,
      } = requestData;

      // Step 1: Validate request and resolve model
      const { resolvedModel, effectiveSettings } =
        RequestValidator.validateRequestData(requestData);

      // Step 2: Validate usage and get Supabase client
      const supabase = await RequestValidator.validateAndTrackUsage({
        userId,
        model: resolvedModel,
        isAuthenticated,
        hasGuestCredentials: RequestValidator.hasGuestCredentials(req),
      });

      // Step 3: Prepare and validate messages
      const compatibleMessages =
        RequestValidator.prepareCompatibleMessages(messages);

      // Step 4: Handle user message logging (best-effort; do not block)
      await RequestValidator.handleUserMessageLogging({
        supabase,
        userId,
        chatId,
        messages: compatibleMessages,
        messageGroupId,
      });

      // Step 5: Log user query for monitoring
      ChatContextBuilder.logUserQuery(
        compatibleMessages,
        chatId,
        userId,
        resolvedModel
      );

      // Step 6: Build complete chat context (model, credentials, tools, settings)
      const chatContext = await ChatContextBuilder.buildChatContext({
        resolvedModel,
        model,
        compatibleMessages,
        userId,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        reasoningEffort: effectiveSettings.reasoningEffort,
        verbosity: effectiveSettings.verbosity,
        reasoningSummary,
        context,
        personalityMode,
        chatId,
        headers: req.headers,
      });

      // Step 7: Get model configuration for retrieval decisions
      const modelConfig = await ModelConfigurationService.getModelConfiguration(
        resolvedModel,
        model
      );

      // Step 8: Determine if fallback retrieval is needed
      if (
        RetrievalService.shouldUseFallbackRetrieval(
          enableSearch,
          modelConfig.modelSupportsFileSearchTools
        )
      ) {
        // Use fallback retrieval with augmented system prompt
        return await RetrievalService.handleFallbackRetrieval({
          compatibleMessages,
          languageModel: chatContext.languageModel,
          effectiveSystemPrompt: chatContext.effectiveSystemPrompt,
          apiKey: chatContext.apiKey,
          modelSettings: chatContext.modelSettings,
          modelConfig: chatContext.modelConfig,
          chatId,
          userId,
          resolvedModel,
          isGPT5Model: modelConfig.isGPT5Model,
          reasoningEffort: effectiveSettings.reasoningEffort,
          enableSearch,
          supabase,
          messageGroupId,
          langsmithRunId: chatContext.langsmithRunId,
          messages: compatibleMessages,
          precomputedModelMessages: chatContext.modelMessages,
        });
      }

      // Step 9: Stream response with standard tools
      return await AIStreamHandler.createStreamingResponse({
        languageModel: chatContext.languageModel,
        effectiveSystemPrompt: chatContext.effectiveSystemPrompt,
        modelMessages: chatContext.modelMessages,
        tools: chatContext.tools,
        isGPT5Model: modelConfig.isGPT5Model,
        chatId,
        userId,
        resolvedModel,
        reasoningEffort: effectiveSettings.reasoningEffort,
        enableSearch,
        supabase,
        messageGroupId,
        langsmithRunId: chatContext.langsmithRunId,
      });
    } catch (err: unknown) {
      // Normalize and track error
      const error = err as {
        code?: string;
        message?: string;
        statusCode?: number;
      };

      let modelToUse = 'unknown-model';
      let userIdToUse = 'unknown-user';

      if (requestData) {
        modelToUse = requestData.model || 'unknown-model';
        userIdToUse = requestData.userId || 'unknown-user';
        try {
          modelToUse = ModelConfigurationService.resolveModelId(
            requestData.model
          );
        } catch {
          // Leave as original if resolution fails
        }
      }

      CredentialService.trackCredentialError(err, modelToUse, userIdToUse);
      logger.error({ error: err, at: 'api.chat.POST' }, 'Chat API error');

      return createErrorResponse(error);
    }
  }
}
