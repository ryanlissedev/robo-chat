'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import {
  generatePartKey,
  isReasoningPart,
  isTextPart,
  type MessagePart,
  type TypedMessage,
} from '@/app/types/message-parts';

export default function TestChat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Test Chat - Debug AI SDK v5</h1>

      <div className="mb-4">
        <p>Status: {status}</p>
        <p>Messages count: {messages.length}</p>
      </div>

      <div className="border p-4 mb-4 h-96 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} className="mb-2 p-2 border">
            <div className="font-bold">{message.role}:</div>

            {/* Debug: Show raw message structure */}
            <details>
              <summary>Raw message data</summary>
              <pre className="text-xs">{JSON.stringify(message, null, 2)}</pre>
            </details>

            {/* Show content if it exists (v4 compatibility) */}
            {'content' in message &&
              typeof (message as TypedMessage).content === 'string' && (
                <div>Content (string): {(message as TypedMessage).content}</div>
              )}

            {/* Show parts if they exist */}
            {message.parts && message.parts.length > 0 && (
              <div>
                Parts:
                {message.parts.map((part, i) => {
                  const typedPart = part as MessagePart;
                  return (
                    <div key={generatePartKey(typedPart, i)} className="ml-4">
                      {isTextPart(typedPart) && (
                        <span>Text: {typedPart.text}</span>
                      )}
                      {isReasoningPart(typedPart) && (
                        <span>Reasoning: {typedPart.text}</span>
                      )}
                      {!isTextPart(typedPart) &&
                        !isReasoningPart(typedPart) && (
                          <span>Type: {typedPart.type}</span>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          if (input.trim()) {
            // Send message with proper format for AI SDK v5
            sendMessage({ text: input });
            setInput('');
          }
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInput(e.target.value)
          }
          className="flex-1 border p-2"
          placeholder="Type a message..."
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white">
          Send
        </button>
      </form>
    </div>
  );
}
