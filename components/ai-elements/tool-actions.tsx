'use client';

import React from 'react';
import { Search, FileText, Code, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ToolActionContainer,
  ToolActionKind,
  ToolActionContent,
  type ToolActionContainerProps,
} from './tool-action';

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export interface WebSearchToolActionProps {
  query: string;
  results: SearchResult[];
  isLoading?: boolean;
  className?: string;
}

/**
 * WebSearchToolAction - Displays web search results with query and results list
 */
export const WebSearchToolAction = React.forwardRef<HTMLDivElement, WebSearchToolActionProps>(
  ({ query, results, isLoading = false, className }, ref) => {
    return (
      <ToolActionContainer
        ref={ref}
        isLoading={isLoading}
        className={cn('space-y-3', className)}
      >
        <ToolActionKind icon={Search} name="Web Search" />

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">
            Query: "{query}"
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Results ({results.length})
              </div>
              <div className="space-y-1">
                {results.map((result, index) => (
                  <ToolActionContent
                    key={`${result.url}-${index}`}
                    title={result.title}
                    url={result.url}
                    domain={result.domain}
                  />
                ))}
              </div>
            </div>
          )}

          {isLoading && results.length === 0 && (
            <div className="text-sm text-muted-foreground animate-pulse">
              Searching for results...
            </div>
          )}
        </div>
      </ToolActionContainer>
    );
  }
);

WebSearchToolAction.displayName = 'WebSearchToolAction';

export interface DocumentToolActionProps {
  title: string;
  content: string;
  fileType: string;
  url?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * DocumentToolAction - Displays document information with content preview
 */
export const DocumentToolAction = React.forwardRef<HTMLDivElement, DocumentToolActionProps>(
  ({ title, content, fileType, url, isLoading = false, className }, ref) => {
    const domain = React.useMemo(() => {
      if (!url) return undefined;
      try {
        return new URL(url).hostname;
      } catch {
        return undefined;
      }
    }, [url]);

    return (
      <ToolActionContainer
        ref={ref}
        isLoading={isLoading}
        className={cn('space-y-3', className)}
      >
        <ToolActionKind icon={FileText} name="Document" />

        <div className="space-y-2">
          <ToolActionContent
            title={title}
            url={url}
            domain={domain}
          />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="bg-muted px-2 py-1 rounded-md font-mono">
              {fileType.toUpperCase()}
            </span>
          </div>

          {content && (
            <div className="mt-2 p-3 bg-muted/50 rounded-md">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Content Preview
              </div>
              <div className="text-sm text-foreground line-clamp-3">
                {content}
              </div>
            </div>
          )}
        </div>
      </ToolActionContainer>
    );
  }
);

DocumentToolAction.displayName = 'DocumentToolAction';

export interface CodeExecutionToolActionProps {
  language: string;
  code: string;
  output: string;
  error?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * CodeExecutionToolAction - Displays code execution with language, code, and output
 */
export const CodeExecutionToolAction = React.forwardRef<HTMLDivElement, CodeExecutionToolActionProps>(
  ({ language, code, output, error = false, isLoading = false, className }, ref) => {
    return (
      <ToolActionContainer
        ref={ref}
        isLoading={isLoading}
        className={cn('space-y-3', className)}
      >
        <ToolActionKind icon={Code} name="Code Execution" />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="w-3 h-3" />
            <span className="bg-muted px-2 py-1 rounded-md font-mono">
              {language.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Code
            </div>
            <div className="p-3 bg-muted/50 rounded-md">
              <pre className="text-sm font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
                <code>{code}</code>
              </pre>
            </div>
          </div>

          {output && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {error ? 'Error Output' : 'Output'}
              </div>
              <div className={cn(
                'p-3 rounded-md text-sm font-mono whitespace-pre-wrap overflow-x-auto',
                error
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-muted/50 text-foreground'
              )}>
                {output}
              </div>
            </div>
          )}

          {isLoading && !output && (
            <div className="text-sm text-muted-foreground animate-pulse">
              Executing code...
            </div>
          )}
        </div>
      </ToolActionContainer>
    );
  }
);

CodeExecutionToolAction.displayName = 'CodeExecutionToolAction';