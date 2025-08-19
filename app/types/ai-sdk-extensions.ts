// Module augmentation to extend AI SDK types
import type { FileUIPart } from 'ai';
import type { Attachment } from './api.types';

declare module 'ai' {
  interface UIMessage {
    // Add missing properties that our application expects
    createdAt?: Date | string;
    content?: string;
    attachments?: FileUIPart[];
    experimental_attachments?: FileUIPart[] | Attachment[];
  }
}