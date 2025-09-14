'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import { getMessageContent } from '@/app/types/ai-extended';
import { MessageAssistant } from '@/components/app/chat/message-assistant';

export default function VerifyChat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/verify',
    }),
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4 font-bold">
        ✅ Chat Verification - AI SDK v5
      </h1>

      <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded">
        <p className="text-green-800">
          <strong>Test Status:</strong>{' '}
          <span className="font-mono">{status}</span> |
          <strong> Messages:</strong> {messages.length}
        </p>
      </div>

      <div className="space-y-4 mb-4">
        {messages.map((message, idx) => {
          const content = getMessageContent(message);

          // Debug logging
          if (typeof window !== 'undefined') {
          }

          if (message.role === 'user') {
            return (
              <div
                key={message.id}
                className="bg-blue-50 p-3 rounded border-l-4 border-blue-400"
              >
                <div className="font-semibold text-blue-800 mb-1">USER:</div>
                <div className="text-blue-700">{content}</div>
              </div>
            );
          }

          if (message.role === 'assistant') {
            return (
              <div
                key={message.id}
                className="bg-white border rounded-lg shadow-sm"
              >
                <div className="p-4">
                  <div className="font-semibold text-gray-800 mb-3">
                    ASSISTANT:
                  </div>

                  {/* Debug info */}
                  <div className="mb-2 p-2 bg-gray-100 text-xs">
                    <strong>Debug Info:</strong>
                    <br />
                    Parts: {message.parts?.length || 0}
                    <br />
                    Content length: {content.length}
                    <br />
                    Status: {idx === messages.length - 1 ? status : 'ready'}
                    <br />
                    Content preview: "{content.substring(0, 50)}..."
                  </div>

                  {/* Use the actual MessageAssistant component */}
                  <MessageAssistant
                    messageId={message.id}
                    parts={message.parts}
                    status={idx === messages.length - 1 ? status : 'ready'}
                    isLast={idx === messages.length - 1}
                  >
                    {content}
                  </MessageAssistant>
                </div>
              </div>
            );
          }

          return null;
        })}

        {status === 'streaming' && (
          <div className="text-center text-gray-500 italic">
            🔄 Streaming response...
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <form
          onSubmit={(e) => {
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
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type 'test' to verify reasoning and response display..."
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            disabled={status !== 'ready' || !input.trim()}
          >
            Send
          </button>
        </form>

        <div className="mt-2 text-sm text-gray-600">
          <strong>Expected behavior:</strong> Reasoning should appear in yellow
          box, followed by main response text.
        </div>
      </div>
    </div>
  );
}
