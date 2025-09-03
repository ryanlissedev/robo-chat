'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import { getMessageContent } from '@/app/types/ai-extended';

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
        <p>Status: <span className="font-bold">{status}</span></p>
        <p>Messages count: <span className="font-bold">{messages.length}</span></p>
      </div>

      <div className="border p-4 mb-4 h-96 overflow-y-auto bg-white rounded">
        {messages.map((message, idx) => {
          const content = getMessageContent(message as any);
          return (
            <div key={message.id} className="mb-4 p-3 border rounded">
              <div className="font-bold text-sm text-gray-600 mb-1">
                {message.role.toUpperCase()}
              </div>
              
              {/* Display extracted content */}
              <div className="mb-2">
                {content ? (
                  <div className="text-black">{content}</div>
                ) : (
                  <div className="text-red-500 italic">No content extracted</div>
                )}
              </div>
              
              {/* Debug info */}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Debug Info</summary>
                <div className="mt-2 space-y-1">
                  <div>ID: {message.id}</div>
                  <div>Has parts: {message.parts ? 'Yes (' + message.parts.length + ')' : 'No'}</div>
                  {message.parts && (
                    <div>
                      Parts types: {message.parts.map(p => p.type).join(', ')}
                    </div>
                  )}
                  <div className="mt-2">
                    <strong>Raw structure:</strong>
                    <pre className="bg-gray-100 p-1 mt-1 rounded overflow-x-auto">
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