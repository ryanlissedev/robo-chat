'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

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
            
            {/* Show content if it exists */}
            {typeof message.content === 'string' && (
              <div>Content (string): {message.content}</div>
            )}
            
            {/* Show parts if they exist */}
            {message.parts && message.parts.length > 0 && (
              <div>
                Parts:
                {message.parts.map((part, i) => (
                  <div key={i} className="ml-4">
                    {part.type === 'text' && <span>Text: {part.text}</span>}
                    {part.type === 'reasoning' && <span>Reasoning: {part.text}</span>}
                    {part.type !== 'text' && part.type !== 'reasoning' && (
                      <span>Type: {part.type}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
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
          onChange={(e) => setInput(e.target.value)}
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
