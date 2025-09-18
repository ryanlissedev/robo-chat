'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
  hasManualInteraction: boolean;
  startTime: number | null;
  setStartTime: (time: number | null) => void;
  setDuration: (duration: number) => void;
  setHasManualInteraction: (hasInteraction: boolean) => void;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoningContext = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error('useReasoningContext must be used within a ReasoningProvider');
  }
  return context;
};

export type ReasoningProviderProps = {
  children: ReactNode;
  value: ReasoningContextValue;
};

export const ReasoningProvider = ({ children, value }: ReasoningProviderProps) => {
  return (
    <ReasoningContext.Provider value={value}>
      {children}
    </ReasoningContext.Provider>
  );
};

ReasoningProvider.displayName = 'ReasoningProvider';