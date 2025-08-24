'use client';

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

// Types
export type ReasoningEffort = 'low' | 'medium' | 'high';

export type DialogState = {
  auth: boolean;
  feedback: boolean;
  createProject: boolean;
  deleteChat: boolean;
  deleteProject: boolean;
  settings: boolean;
  publish: boolean;
};

export type ChatUIState = {
  enableSearch: boolean;
  reasoningEffort: ReasoningEffort;
  isSubmitting: boolean;
  hasDialogAuth: boolean;
  quotedText: {
    text: string;
    messageId: string;
  } | null;
};

export type FormState = {
  // Temporary form data for optimistic updates
  createProjectName: string;
  feedbackComment: string;
  editingMessageId: string | null;
  editingContent: string;
};

export type ExpandableStates = {
  // Track which components are expanded/collapsed
  toolInvocations: Record<string, boolean>;
  sourcesList: Record<string, boolean>;
  reasoning: Record<string, boolean>;
};

export type LoadingStates = {
  // Track loading states for various operations
  googleSignIn: boolean;
  feedbackSubmission: boolean;
  fileUpload: boolean;
  messageEdit: boolean;
  projectCreation: boolean;
  projectDeletion: boolean;
  chatDeletion: boolean;
};

export type ErrorStates = {
  // Track error states
  googleSignIn: string | null;
  feedbackSubmission: string | null;
  fileUpload: string | null;
  messageEdit: string | null;
  projectCreation: string | null;
};

export type UIState = {
  dialogs: DialogState;
  chatUI: ChatUIState;
  forms: FormState;
  expandable: ExpandableStates;
  loading: LoadingStates;
  errors: ErrorStates;
};

// Initial state
const initialDialogState: DialogState = {
  auth: false,
  feedback: false,
  createProject: false,
  deleteChat: false,
  deleteProject: false,
  settings: false,
  publish: false,
};

const initialChatUIState: ChatUIState = {
  enableSearch: true, // Search is always enabled, but handoff behavior differs
  reasoningEffort: 'medium',
  isSubmitting: false,
  hasDialogAuth: false,
  quotedText: null,
};

const initialFormState: FormState = {
  createProjectName: '',
  feedbackComment: '',
  editingMessageId: null,
  editingContent: '',
};

const initialExpandableStates: ExpandableStates = {
  toolInvocations: {},
  sourcesList: {},
  reasoning: {},
};

const initialLoadingStates: LoadingStates = {
  googleSignIn: false,
  feedbackSubmission: false,
  fileUpload: false,
  messageEdit: false,
  projectCreation: false,
  projectDeletion: false,
  chatDeletion: false,
};

const initialErrorStates: ErrorStates = {
  googleSignIn: null,
  feedbackSubmission: null,
  fileUpload: null,
  messageEdit: null,
  projectCreation: null,
};

// Store definition
export interface UIStore extends UIState {
  // Dialog actions
  openDialog: (dialog: keyof DialogState) => void;
  closeDialog: (dialog: keyof DialogState) => void;
  closeAllDialogs: () => void;

  // Chat UI actions
  setEnableSearch: (enabled: boolean) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setHasDialogAuth: (hasAuth: boolean) => void;
  setQuotedText: (quoted: ChatUIState['quotedText']) => void;
  clearQuotedText: () => void;

  // Form actions
  setFormField: <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => void;
  clearForm: () => void;
  clearFormField: (field: keyof FormState) => void;

  // Expandable actions
  setExpanded: (
    category: keyof ExpandableStates,
    id: string,
    expanded: boolean
  ) => void;
  toggleExpanded: (category: keyof ExpandableStates, id: string) => void;
  clearExpandedStates: (category?: keyof ExpandableStates) => void;

  // Loading actions
  setLoading: (operation: keyof LoadingStates, loading: boolean) => void;
  clearAllLoading: () => void;

  // Error actions
  setError: (operation: keyof ErrorStates, error: string | null) => void;
  clearError: (operation: keyof ErrorStates) => void;
  clearAllErrors: () => void;

  // Utility actions
  reset: () => void;
  resetDialog: (dialog: keyof DialogState) => void;
}

// Create the store
export const useUIStore = create<UIStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // State
      dialogs: initialDialogState,
      chatUI: initialChatUIState,
      forms: initialFormState,
      expandable: initialExpandableStates,
      loading: initialLoadingStates,
      errors: initialErrorStates,

      // Dialog actions
      openDialog: (dialog) =>
        set(
          (state) => ({
            dialogs: { ...state.dialogs, [dialog]: true },
          }),
          false,
          `openDialog/${dialog}`
        ),

      closeDialog: (dialog) =>
        set(
          (state) => ({
            dialogs: { ...state.dialogs, [dialog]: false },
          }),
          false,
          `closeDialog/${dialog}`
        ),

      closeAllDialogs: () =>
        set({ dialogs: initialDialogState }, false, 'closeAllDialogs'),

      // Chat UI actions
      setEnableSearch: (enabled) =>
        set(
          (state) => ({
            chatUI: { ...state.chatUI, enableSearch: enabled },
          }),
          false,
          `setEnableSearch/${enabled}`
        ),

      setReasoningEffort: (effort) =>
        set(
          (state) => ({
            chatUI: { ...state.chatUI, reasoningEffort: effort },
          }),
          false,
          `setReasoningEffort/${effort}`
        ),

      setIsSubmitting: (isSubmitting) =>
        set(
          (state) => ({
            chatUI: { ...state.chatUI, isSubmitting },
          }),
          false,
          `setIsSubmitting/${isSubmitting}`
        ),

      setHasDialogAuth: (hasAuth) =>
        set(
          (state) => ({
            chatUI: { ...state.chatUI, hasDialogAuth: hasAuth },
          }),
          false,
          `setHasDialogAuth/${hasAuth}`
        ),

      setQuotedText: (quoted) =>
        set(
          (state) => ({
            chatUI: { ...state.chatUI, quotedText: quoted },
          }),
          false,
          'setQuotedText'
        ),

      clearQuotedText: () =>
        set(
          (state) => ({
            chatUI: { ...state.chatUI, quotedText: null },
          }),
          false,
          'clearQuotedText'
        ),

      // Form actions
      setFormField: (field, value) =>
        set(
          (state) => ({
            forms: { ...state.forms, [field]: value },
          }),
          false,
          `setFormField/${field}`
        ),

      clearForm: () => set({ forms: initialFormState }, false, 'clearForm'),

      clearFormField: (field) =>
        set(
          (state) => ({
            forms: { ...state.forms, [field]: initialFormState[field] },
          }),
          false,
          `clearFormField/${field}`
        ),

      // Expandable actions
      setExpanded: (category, id, expanded) =>
        set(
          (state) => ({
            expandable: {
              ...state.expandable,
              [category]: {
                ...state.expandable[category],
                [id]: expanded,
              },
            },
          }),
          false,
          `setExpanded/${category}/${id}/${expanded}`
        ),

      toggleExpanded: (category, id) => {
        const currentState = get().expandable[category][id] ?? false;
        set(
          (state) => ({
            expandable: {
              ...state.expandable,
              [category]: {
                ...state.expandable[category],
                [id]: !currentState,
              },
            },
          }),
          false,
          `toggleExpanded/${category}/${id}`
        );
      },

      clearExpandedStates: (category) =>
        set(
          (state) => ({
            expandable: category
              ? { ...state.expandable, [category]: {} }
              : initialExpandableStates,
          }),
          false,
          `clearExpandedStates/${category || 'all'}`
        ),

      // Loading actions
      setLoading: (operation, loading) =>
        set(
          (state) => ({
            loading: { ...state.loading, [operation]: loading },
          }),
          false,
          `setLoading/${operation}/${loading}`
        ),

      clearAllLoading: () =>
        set({ loading: initialLoadingStates }, false, 'clearAllLoading'),

      // Error actions
      setError: (operation, error) =>
        set(
          (state) => ({
            errors: { ...state.errors, [operation]: error },
          }),
          false,
          `setError/${operation}`
        ),

      clearError: (operation) =>
        set(
          (state) => ({
            errors: { ...state.errors, [operation]: null },
          }),
          false,
          `clearError/${operation}`
        ),

      clearAllErrors: () =>
        set({ errors: initialErrorStates }, false, 'clearAllErrors'),

      // Utility actions
      reset: () =>
        set(
          {
            dialogs: initialDialogState,
            chatUI: initialChatUIState,
            forms: initialFormState,
            expandable: initialExpandableStates,
            loading: initialLoadingStates,
            errors: initialErrorStates,
          },
          false,
          'reset'
        ),

      resetDialog: (dialog) =>
        set(
          (state) => ({
            dialogs: { ...state.dialogs, [dialog]: false },
            // Clear all errors and loading to ensure clean dialog state
            errors: initialErrorStates,
            loading: initialLoadingStates,
          }),
          false,
          `resetDialog/${dialog}`
        ),
    })),
    {
      name: 'ui-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selectors for performance optimization
export const useDialogState = (dialog: keyof DialogState) =>
  useUIStore((state) => state.dialogs[dialog]);

export const useChatUIState = () => useUIStore((state) => state.chatUI);

export const useFormState = () => useUIStore((state) => state.forms);

export const useExpandableState = (
  category: keyof ExpandableStates,
  id: string
) => useUIStore((state) => state.expandable[category][id] ?? false);

export const useLoadingState = (operation: keyof LoadingStates) =>
  useUIStore((state) => state.loading[operation]);

export const useErrorState = (operation: keyof ErrorStates) =>
  useUIStore((state) => state.errors[operation]);

// Compound selectors
export const useDialogActions = () => {
  const openDialog = useUIStore((state) => state.openDialog);
  const closeDialog = useUIStore((state) => state.closeDialog);
  const closeAllDialogs = useUIStore((state) => state.closeAllDialogs);
  const resetDialog = useUIStore((state) => state.resetDialog);

  return { openDialog, closeDialog, closeAllDialogs, resetDialog };
};

export const useChatUIActions = () => {
  const setEnableSearch = useUIStore((state) => state.setEnableSearch);
  const setReasoningEffort = useUIStore((state) => state.setReasoningEffort);
  const setIsSubmitting = useUIStore((state) => state.setIsSubmitting);
  const setHasDialogAuth = useUIStore((state) => state.setHasDialogAuth);
  const setQuotedText = useUIStore((state) => state.setQuotedText);
  const clearQuotedText = useUIStore((state) => state.clearQuotedText);

  return {
    setEnableSearch,
    setReasoningEffort,
    setIsSubmitting,
    setHasDialogAuth,
    setQuotedText,
    clearQuotedText,
  };
};

export const useFormActions = () => {
  const setFormField = useUIStore((state) => state.setFormField);
  const clearForm = useUIStore((state) => state.clearForm);
  const clearFormField = useUIStore((state) => state.clearFormField);

  return { setFormField, clearForm, clearFormField };
};

export const useExpandableActions = () => {
  const setExpanded = useUIStore((state) => state.setExpanded);
  const toggleExpanded = useUIStore((state) => state.toggleExpanded);
  const clearExpandedStates = useUIStore((state) => state.clearExpandedStates);

  return { setExpanded, toggleExpanded, clearExpandedStates };
};

export const useLoadingActions = () => {
  const setLoading = useUIStore((state) => state.setLoading);
  const clearAllLoading = useUIStore((state) => state.clearAllLoading);

  return { setLoading, clearAllLoading };
};

export const useErrorActions = () => {
  const setError = useUIStore((state) => state.setError);
  const clearError = useUIStore((state) => state.clearError);
  const clearAllErrors = useUIStore((state) => state.clearAllErrors);

  return { setError, clearError, clearAllErrors };
};

// Utility hooks for common patterns
export const useDialogToggle = (dialog: keyof DialogState) => {
  const isOpen = useDialogState(dialog);
  const openDialog = useUIStore((state) => state.openDialog);
  const closeDialog = useUIStore((state) => state.closeDialog);

  const open = () => openDialog(dialog);
  const close = () => closeDialog(dialog);
  const toggle = () => (isOpen ? closeDialog(dialog) : openDialog(dialog));

  return { isOpen, open, close, toggle };
};

export const useOptimisticState = <T>(
  _initialValue: T,
  operation: keyof LoadingStates
) => {
  const isLoading = useLoadingState(operation);
  const error = useErrorState(operation as keyof ErrorStates);
  const setLoading = useUIStore((state) => state.setLoading);
  const setError = useUIStore((state) => state.setError);
  const clearError = useUIStore((state) => state.clearError);

  const execute = async (asyncFn: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(operation, true);
      clearError(operation as keyof ErrorStates);
      const result = await asyncFn();
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(operation as keyof ErrorStates, errorMessage);
      return null;
    } finally {
      setLoading(operation, false);
    }
  };

  return {
    isLoading,
    error,
    execute,
  };
};
