import React from 'react';
'use client';

import { type ComponentProps, memo, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
} from './inline-citation';

type ResponseProps = ComponentProps<typeof Streamdown> & {
  sources?: Array<{
    id: string;
    url: string;
    title: string;
    description?: string;
    quote?: string;
  }>;
};

// Helper function to parse citation markers and create inline citations
const parseCitationsInText = (
  text: string,
  sources?: ResponseProps['sources']
) => {
  if (!sources || sources.length === 0) {
    return text;
  }

  // Split text by citation markers like [1], [2], etc.
  const parts = text.split(/(\[\d+\])/);

  return parts.map((part, index) => {
    const citationMatch = part.match(/\[(\d+)\]/);
    if (citationMatch) {
      const citationNumber = citationMatch[1];
      const citation = sources.find(
        (_s, idx) => (idx + 1).toString() === citationNumber
      );

      if (citation) {
        return (
          <InlineCitation key={index}>
            <InlineCitationCard>
              <InlineCitationCardTrigger sources={[citation.url]} />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselPrev />
                    <InlineCitationCarouselNext />
                    <InlineCitationCarouselIndex />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    <InlineCitationCarouselItem>
                      <InlineCitationSource
                        title={citation.title}
                        url={citation.url}
                        description={citation.description}
                      />
                      {citation.quote && (
                        <InlineCitationQuote>
                          {citation.quote}
                        </InlineCitationQuote>
                      )}
                    </InlineCitationCarouselItem>
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        );
      }
    }
    return part;
  });
};

export const Response = memo(
  ({ className, sources, children, ...props }: ResponseProps) => {
    // Process children to add inline citations if sources are provided
    const processedChildren = useMemo(() => {
      if (typeof children === 'string' && sources && sources.length > 0) {
        return parseCitationsInText(children, sources);
      }
      return children;
    }, [children, sources]);

    // If we have processed children with citations, render them directly
    if (
      typeof processedChildren !== 'string' &&
      processedChildren !== children
    ) {
      return (
        <div
          className={cn(
            // Base layout and spacing
            'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            // Typography improvements inspired by Zola
            'prose prose-neutral dark:prose-invert max-w-none',
            // Headings
            'prose-headings:font-semibold prose-headings:tracking-tight',
            'prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-8',
            'prose-h2:text-xl prose-h2:mb-4 prose-h2:mt-6',
            'prose-h3:text-lg prose-h3:mb-3 prose-h3:mt-5',
            'prose-h4:text-base prose-h4:mb-2 prose-h4:mt-4',
            // Paragraphs and text
            'prose-p:leading-7 prose-p:mb-4 prose-p:text-foreground',
            'prose-p:[&:not(:first-child)]:mt-4',
            // Lists
            'prose-ul:my-4 prose-ol:my-4 prose-ul:pl-6 prose-ol:pl-6',
            'prose-li:my-1 prose-li:leading-7',
            'prose-ul:list-disc prose-ol:list-decimal',
            // Code blocks
            'prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg',
            'prose-pre:p-4 prose-pre:overflow-x-auto',
            'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5',
            'prose-code:rounded prose-code:text-sm prose-code:font-mono',
            'prose-code:before:content-none prose-code:after:content-none',
            // Tables
            'prose-table:border-collapse prose-table:border prose-table:rounded-lg',
            'prose-th:border prose-th:bg-muted/50 prose-th:px-4 prose-th:py-2',
            'prose-td:border prose-td:px-4 prose-td:py-2',
            // Links
            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
            // Blockquotes
            'prose-blockquote:border-l-4 prose-blockquote:border-primary/20',
            'prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground',
            // Strong and emphasis
            'prose-strong:font-semibold prose-em:italic',
            // HR
            'prose-hr:border-border prose-hr:my-8',
            className
          )}
        >
          {processedChildren}
        </div>
      );
    }

    // Otherwise use Streamdown for markdown parsing
    return (
      <Streamdown
        className={cn(
          // Base layout and spacing
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // Typography improvements inspired by Zola
          'prose prose-neutral dark:prose-invert max-w-none',
          // Headings
          'prose-headings:font-semibold prose-headings:tracking-tight',
          'prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-8',
          'prose-h2:text-xl prose-h2:mb-4 prose-h2:mt-6',
          'prose-h3:text-lg prose-h3:mb-3 prose-h3:mt-5',
          'prose-h4:text-base prose-h4:mb-2 prose-h4:mt-4',
          // Paragraphs and text
          'prose-p:leading-7 prose-p:mb-4 prose-p:text-foreground',
          'prose-p:[&:not(:first-child)]:mt-4',
          // Lists
          'prose-ul:my-4 prose-ol:my-4 prose-ul:pl-6 prose-ol:pl-6',
          'prose-li:my-1 prose-li:leading-7',
          'prose-ul:list-disc prose-ol:list-decimal',
          // Code blocks
          'prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg',
          'prose-pre:p-4 prose-pre:overflow-x-auto',
          'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5',
          'prose-code:rounded prose-code:text-sm prose-code:font-mono',
          'prose-code:before:content-none prose-code:after:content-none',
          // Tables
          'prose-table:border-collapse prose-table:border prose-table:rounded-lg',
          'prose-th:border prose-th:bg-muted/50 prose-th:px-4 prose-th:py-2',
          'prose-td:border prose-td:px-4 prose-td:py-2',
          // Links
          'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
          // Blockquotes
          'prose-blockquote:border-l-4 prose-blockquote:border-primary/20',
          'prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground',
          // Strong and emphasis
          'prose-strong:font-semibold prose-em:italic',
          // HR
          'prose-hr:border-border prose-hr:my-8',
          className
        )}
        {...props}
      >
        {children}
      </Streamdown>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.sources === nextProps.sources
);

Response.displayName = 'Response';
