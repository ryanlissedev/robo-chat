import { toast } from '@/components/ui/toast';
import { getOrCreateGuestUserId } from '@/lib/api';
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import type { Attachment } from '@/lib/file-handling';
import type { UserProfile } from '@/lib/user/types';

// Request options type for API calls
export type RequestOptions = {
  body: {
    chatId: string;
    userId: string;
    model: string;
    isAuthenticated: boolean;
    systemPrompt?: string;
    enableSearch?: boolean;
    reasoningEffort?: 'low' | 'medium' | 'high';
  };
  attachments?: Attachment[];
};

/**
 * BDD-style chat operations extracted from use-chat-core.ts
 * Following behavior-driven development patterns for testability
 */

// Types for operation results with enhanced error tracking
export type OperationResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
};

// Error codes for better error tracking
export enum ErrorCode {
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_INPUT = 'INVALID_INPUT',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export type MessageSubmissionContext = {
  input: string;
  files: File[];
  user: UserProfile | null;
  selectedModel: string;
  isAuthenticated: boolean;
  systemPrompt?: string;
  enableSearch: boolean;
  reasoningEffort: 'low' | 'medium' | 'high';
  chatId: string | null;
};

export type OptimisticMessageData = {
  id: string;
  role: 'user';
  createdAt: Date;
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'file'; file: { name: string; contentType: string; url: string } }
  >;
};

export type ChatOperationDependencies = {
  checkLimitsAndNotify: (uid: string) => Promise<boolean>;
  ensureChatExists: (uid: string, input: string) => Promise<string | null>;
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>;
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>;
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void;
};

/**
 * BDD Scenario: "Given user input, When submitting message, Then validate and send"
 *
 * This encapsulates the core message submission business logic:
 * - User authentication validation
 * - Rate limiting checks
 * - Input validation
 * - File upload processing
 * - Message preparation
 */
export async function submitMessageScenario(
  context: MessageSubmissionContext,
  dependencies: ChatOperationDependencies
): Promise<
  | OperationResult<{
      chatId: string;
      requestOptions: RequestOptions;
      optimisticMessage: OptimisticMessageData;
    }>
  | OperationResult<undefined>
> {
  const {
    input,
    files,
    user,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    reasoningEffort,
    chatId,
  } = context;
  void chatId; // Mark as intentionally unused
  const {
    checkLimitsAndNotify,
    ensureChatExists,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
  } = dependencies;
  void cleanupOptimisticAttachments; // Mark as intentionally unused

  try {
    // Given: User wants to submit a message
    const uid = await getOrCreateGuestUserId(user);
    if (!uid) {
      return { success: false, error: 'Failed to get user ID' };
    }

    // When: Checking user limits
    const limitResult = await validateUserLimitsScenario(
      uid,
      checkLimitsAndNotify
    );
    if (!limitResult.success) {
      return {
        success: false,
        data: undefined,
        error: limitResult.error,
        errorCode: ErrorCode.RATE_LIMIT,
        retryable: false,
      };
    }

    // When: Validating input
    const inputValidation = validateMessageInput(input);
    if (!inputValidation.success) {
      return {
        success: false,
        data: undefined,
        error: inputValidation.error,
        errorCode: ErrorCode.INVALID_INPUT,
        retryable: false,
      };
    }

    // When: Ensuring chat exists
    const currentChatId = await ensureChatExists(uid, input);
    if (!currentChatId) {
      return { success: false, error: 'Failed to create or access chat' };
    }

    // When: Processing file uploads
    const fileResult = await handleFileUploadScenario(
      files,
      uid,
      currentChatId,
      handleFileUploads
    );
    if (!fileResult.success) {
      return {
        success: false,
        data: undefined,
        error: fileResult.error,
        errorCode: ErrorCode.FILE_UPLOAD_FAILED,
        retryable: true,
      };
    }

    // When: Creating optimistic message
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : [];
    const optimisticMessage: OptimisticMessageData = {
      id: `optimistic-${Date.now().toString()}`,
      role: 'user',
      createdAt: new Date(),
      parts: [
        { type: 'text', text: input },
        ...(optimisticAttachments.length > 0
          ? optimisticAttachments.map((att) => ({
              type: 'file' as const,
              file: att,
            }))
          : []),
      ],
    };

    // Then: Prepare request options
    const requestOptions = {
      body: {
        chatId: currentChatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        enableSearch,
        reasoningEffort,
      },
      attachments: fileResult.data || undefined,
    };

    return {
      success: true,
      data: {
        chatId: currentChatId,
        requestOptions,
        optimisticMessage,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * BDD Scenario: "Given files selected, When uploading, Then validate and process"
 *
 * Handles file upload validation and processing
 */
export async function handleFileUploadScenario(
  files: File[],
  uid: string,
  chatId: string,
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
): Promise<OperationResult<Attachment[] | null>> {
  if (files.length === 0) {
    return { success: true, data: [] };
  }

  try {
    // Given: Files are selected for upload
    // When: Processing file uploads
    const attachments = await handleFileUploads(uid, chatId);

    if (attachments === null) {
      // Then: Upload failed
      return { success: false, error: 'File upload failed' };
    }

    // Then: Upload succeeded
    return { success: true, data: attachments };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File upload failed',
    };
  }
}

/**
 * BDD Scenario: "Given user action, When checking limits, Then enforce rate limits"
 *
 * Validates user rate limits and permissions
 */
export async function validateUserLimitsScenario(
  uid: string,
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
): Promise<OperationResult> {
  try {
    // Given: User wants to perform an action
    // When: Checking rate limits
    const allowed = await checkLimitsAndNotify(uid);

    if (!allowed) {
      // Then: User has exceeded limits
      return { success: false, error: 'Rate limit exceeded' };
    }

    // Then: User is within limits
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Limit validation failed',
    };
  }
}

/**
 * BDD Scenario: "Given message input, When validating, Then check constraints"
 *
 * Validates message input against business rules
 */
export function validateMessageInput(input: string): OperationResult {
  // Given: User has provided message input
  // When: Validating input length
  if (input.length > MESSAGE_MAX_LENGTH) {
    // Then: Input exceeds maximum length
    return {
      success: false,
      error: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
    };
  }

  if (input.trim().length === 0) {
    // Then: Input is empty
    return {
      success: false,
      error: 'Message cannot be empty',
    };
  }

  // Then: Input is valid
  return { success: true };
}

/**
 * BDD Scenario: "Given suggestion text, When submitting, Then validate and send"
 *
 * Handles suggestion submission with simpler validation
 */
export async function submitSuggestionScenario(
  suggestion: string,
  context: Omit<MessageSubmissionContext, 'input' | 'files'>,
  dependencies: Pick<
    ChatOperationDependencies,
    'checkLimitsAndNotify' | 'ensureChatExists'
  >
): Promise<
  OperationResult<{
    chatId: string;
    requestOptions: RequestOptions;
    optimisticMessage: OptimisticMessageData;
  }>
> {
  const { user, selectedModel, isAuthenticated, reasoningEffort } = context;
  const { checkLimitsAndNotify, ensureChatExists } = dependencies;

  try {
    // Given: User wants to submit a suggestion
    const uid = await getOrCreateGuestUserId(user);
    if (!uid) {
      return { success: false, error: 'Failed to get user ID' };
    }

    // When: Checking user limits
    const limitResult = await validateUserLimitsScenario(
      uid,
      checkLimitsAndNotify
    );
    if (!limitResult.success) {
      return {
        success: false,
        data: undefined,
        error: limitResult.error,
        errorCode: ErrorCode.RATE_LIMIT,
        retryable: false,
      };
    }

    // When: Ensuring chat exists
    const currentChatId = await ensureChatExists(uid, suggestion);
    if (!currentChatId) {
      return { success: false, error: 'Failed to create or access chat' };
    }

    // When: Creating optimistic message for suggestion
    const optimisticMessage: OptimisticMessageData = {
      id: `optimistic-${Date.now().toString()}`,
      role: 'user',
      createdAt: new Date(),
      parts: [{ type: 'text', text: suggestion }],
    };

    // Then: Prepare request options
    const requestOptions = {
      body: {
        chatId: currentChatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    };

    return {
      success: true,
      data: {
        chatId: currentChatId,
        requestOptions,
        optimisticMessage,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * BDD Scenario: "Given chat reload request, When preparing, Then validate and setup"
 *
 * Prepares chat reload with proper context
 */
export async function prepareReloadScenario(context: {
  user: UserProfile | null;
  chatId: string | null;
  selectedModel: string;
  isAuthenticated: boolean;
  systemPrompt?: string;
  reasoningEffort: 'low' | 'medium' | 'high';
}): Promise<OperationResult<{ requestOptions: RequestOptions }>> {
  const {
    user,
    chatId,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    reasoningEffort,
  } = context;

  try {
    // Given: User wants to reload chat
    const uid = await getOrCreateGuestUserId(user);
    if (!uid) {
      return { success: false, error: 'Failed to get user ID' };
    }

    // When: Preparing reload options
    const requestOptions = {
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    };

    // Then: Return prepared options
    return {
      success: true,
      data: { requestOptions },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Reload preparation failed',
    };
  }
}

/**
 * Centralized error handling for chat operations with enhanced tracking
 */
export function handleChatError(
  error: Error | OperationResult<unknown>,
  context = 'Chat operation'
) {
  // Handle both Error objects and OperationResult objects
  const isOperationResult = 'success' in error && !error.success;

  if (isOperationResult) {
    const result = error as OperationResult<unknown>;

    // Show user-friendly error message
    const userMessage = getUserFriendlyErrorMessage(
      result.errorCode,
      result.error
    );

    toast({
      title: userMessage,
      status: 'error',
    });

    // Track error metrics if needed
    trackErrorMetrics(context, result.errorCode, result.metadata);
  } else {
    const err = error as Error;

    let errorMsg = err.message || 'Something went wrong.';

    if (errorMsg === 'An error occurred' || errorMsg === 'fetch failed') {
      errorMsg = 'Something went wrong. Please try again.';
    }

    toast({
      title: errorMsg,
      status: 'error',
    });
  }
}

/**
 * Get user-friendly error messages based on error codes
 */
function getUserFriendlyErrorMessage(
  errorCode?: string,
  defaultMessage?: string
): string {
  switch (errorCode) {
    case ErrorCode.RATE_LIMIT:
      return "You've reached the message limit. Please try again later.";
    case ErrorCode.AUTH_REQUIRED:
      return 'Please sign in to continue.';
    case ErrorCode.INVALID_INPUT:
      return defaultMessage || 'Invalid input. Please check and try again.';
    case ErrorCode.FILE_UPLOAD_FAILED:
      return 'File upload failed. Please try again.';
    case ErrorCode.NETWORK_ERROR:
      return 'Connection error. Please check your internet and try again.';
    case ErrorCode.SERVER_ERROR:
      return 'Server error. Please try again later.';
    default:
      return defaultMessage || 'Something went wrong. Please try again.';
  }
}

/**
 * Track error metrics for monitoring and debugging
 */
function trackErrorMetrics(
  _context: string,
  _errorCode?: string,
  _metadata?: Record<string, unknown>
) {
  void _context; // Mark as intentionally unused
  void _errorCode; // Mark as intentionally unused  
  void _metadata; // Mark as intentionally unused
  // This is where you'd send error metrics to your analytics service
  // For now, just log to console in development
  if (process.env.NODE_ENV === 'development') {
  }
}
