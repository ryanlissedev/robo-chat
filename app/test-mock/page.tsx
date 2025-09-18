'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import { getMessageContent } from '@/app/types/ai-extended';
import {
  generatePartKey,
  isReasoningPart,
  isTextPart,
  type MessagePart,
} from '@/app/types/message-parts';

export default function TestMock() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/test',
    }),
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4">Test Mock Chat - Debugging AI SDK v5</h1>

      <div className="mb-4 bg-gray-100 p-2 rounded">
        <p>
          Status: <span className="font-bold">{status}</span>
        </p>
        <p>
          Messages count: <span className="font-bold">{messages.length}</span>
        </p>
      </div>

      <div className="border p-4 mb-4 h-96 overflow-y-auto bg-white rounded">
        {messages.map((message, _idx) => {
          const content = getMessageContent(message);

          // Extract reasoning and text parts using type-safe utilities
          const messageParts = (message.parts as MessagePart[]) || [];
          const reasoningParts = messageParts.filter(isReasoningPart);
          const textParts = messageParts.filter(isTextPart);

          return (
            <div key={message.id} className="mb-4 p-3 border rounded">
              <div className="font-bold text-sm text-gray-600 mb-2">
                {message.role.toUpperCase()}
              </div>

              {/* Display reasoning if available */}
              {reasoningParts.length > 0 && (
                <div className="mb-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <div className="text-xs font-semibold text-yellow-800 mb-1">
                    REASONING:
                  </div>
                  <div className="text-sm text-yellow-700">
                    {reasoningParts.map((part, i) => (
                      <span key={generatePartKey(part, i)}>{part.text}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Display main content */}
              <div className="mb-2">
                {content ? (
                  <div className="text-black whitespace-pre-wrap">
                    {content}
                  </div>
                ) : textParts.length > 0 ? (
                  <div className="text-black whitespace-pre-wrap">
                    {textParts.map((part, i) => (
                      <span key={generatePartKey(part, i)}>{part.text}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-500 italic">
                    No content available
                  </div>
                )}
              </div>

              {/* Parts breakdown */}
              {message.parts && message.parts.length > 0 && (
                <div className="text-xs text-gray-600 mb-2">
                  Parts:{' '}
                  {messageParts.map((part, i) => (
                    <span
                      key={generatePartKey(part, i)}
                      className="mr-2 px-1 bg-gray-100 rounded"
                    >
                      {part.type}
                    </span>
                  ))}
                </div>
              )}

              {/* Debug info */}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Debug Info</summary>
                <div className="mt-2 space-y-1">
                  <div>ID: {message.id}</div>
                  <div>Parts count: {message.parts?.length || 0}</div>
                  <div>Reasoning parts: {reasoningParts.length}</div>
                  <div>Text parts: {textParts.length}</div>
                  <div className="mt-2">
                    <strong>Raw message:</strong>
                    <pre className="bg-gray-100 p-1 mt-1 rounded overflow-x-auto text-xs">
                      {JSON.stringify(message, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          );
        })}

        {status === 'streaming' && (
          <div className="text-gray-500 italic">Streaming...</div>
        )}
      </div>

      <form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput('');
          }
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          className="flex-1 border p-2 rounded"
          placeholder="Type a message..."
          disabled={status !== 'ready'}
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          disabled={status !== 'ready' || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
