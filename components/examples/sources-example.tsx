'use client';

import React from 'react';
import { Sources } from '@/components/ai-elements/sources';

// Example usage of the Sources component
export function SourcesExample() {
  const sampleSources = [
    {
      id: '1',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      title: 'JavaScript - MDN Web Docs',
      domain: 'developer.mozilla.org',
      favicon: 'https://developer.mozilla.org/favicon-48x48.cbbd161b5b0b.png',
    },
    {
      id: '2',
      url: 'https://react.dev/learn',
      title: 'Learn React - React Documentation',
      domain: 'react.dev',
      favicon: 'https://react.dev/favicon.ico',
    },
    {
      id: '3',
      url: 'https://nextjs.org/docs',
      title: 'Next.js Documentation',
      domain: 'nextjs.org',
      favicon: 'https://nextjs.org/favicon.ico',
    },
    {
      id: '4',
      url: 'https://tailwindcss.com/docs',
      title: 'Tailwind CSS Documentation',
      domain: 'tailwindcss.com',
      favicon: 'https://tailwindcss.com/favicons/favicon-32x32.png',
    },
    {
      id: '5',
      url: 'https://www.typescriptlang.org/docs/',
      title: 'TypeScript Documentation',
      domain: 'typescriptlang.org',
      favicon: 'https://www.typescriptlang.org/favicon-32x32.png',
    },
  ];

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-semibold">Sources Component Example</h2>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            With Multiple Sources (shows overflow):
          </h3>
          <Sources sources={sampleSources} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            With Few Sources (no overflow):
          </h3>
          <Sources sources={sampleSources.slice(0, 2)} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Single Source:
          </h3>
          <Sources sources={sampleSources.slice(0, 1)} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Empty Sources:
          </h3>
          <Sources sources={[]} />
        </div>
      </div>
    </div>
  );
}