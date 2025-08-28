/**
 * Extract reasoning traces from AI SDK responses
 * Supports multiple reasoning tag formats commonly used by AI models
 * Specifically designed for GPT-5 thinking models with XML-tagged reasoning sections
 */

export interface ReasoningTrace {
  id: string;
  timestamp: number;
  type:
    | 'reasoning'
    | 'thinking'
    | 'planning'
    | 'analysis'
    | 'conclusion'
    | 'reflection';
  content: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ReasoningContext {
  traces: ReasoningTrace[];
  summary?: string;
  totalTokens?: number;
  processingTime?: number;
  cleanedContent?: string;
  reasoning?: string | null;
}

/**
 * Extract XML-tagged reasoning sections from AI responses
 * Supports various thinking/reasoning tag formats used by GPT-5 and other thinking models
 */
export function extractReasoningFromResponse(
  responseText: string,
  processingTime?: number,
  totalTokens?: number
): ReasoningContext {
  if (!responseText) {
    return {
      traces: [],
      cleanedContent: '',
      reasoning: null,
      processingTime,
      totalTokens,
    };
  }

  // Define reasoning tag patterns to extract
  const reasoningPatterns = [
    // Standard thinking tags
    {
      pattern: /<thinking>([\s\S]*?)<\/thinking>/gi,
      type: 'thinking' as const,
    },
    {
      pattern: /<reasoning>([\s\S]*?)<\/reasoning>/gi,
      type: 'reasoning' as const,
    },
    { pattern: /<thought>([\s\S]*?)<\/thought>/gi, type: 'thinking' as const },
    {
      pattern: /<reflection>([\s\S]*?)<\/reflection>/gi,
      type: 'reflection' as const,
    },

    // Namespaced tags (e.g., antml:thinking)
    {
      pattern: /<[^>]+:thinking>([\s\S]*?)<\/[^>]+:thinking>/gi,
      type: 'thinking' as const,
    },
    {
      pattern: /<[^>]+:reasoning>([\s\S]*?)<\/[^>]+:reasoning>/gi,
      type: 'reasoning' as const,
    },
    {
      pattern: /<[^>]+:reflection>([\s\S]*?)<\/[^>]+:reflection>/gi,
      type: 'reflection' as const,
    },

    // COT (Chain of Thought) tags
    { pattern: /<cot>([\s\S]*?)<\/cot>/gi, type: 'reasoning' as const },
    {
      pattern: /<chain_of_thought>([\s\S]*?)<\/chain_of_thought>/gi,
      type: 'reasoning' as const,
    },

    // Internal reasoning tags
    {
      pattern: /<internal_reasoning>([\s\S]*?)<\/internal_reasoning>/gi,
      type: 'reasoning' as const,
    },
    {
      pattern: /<inner_thoughts>([\s\S]*?)<\/inner_thoughts>/gi,
      type: 'thinking' as const,
    },

    // Planning tags
    {
      pattern: /<planning>([\s\S]*?)<\/planning>/gi,
      type: 'planning' as const,
    },
    {
      pattern: /<analysis>([\s\S]*?)<\/analysis>/gi,
      type: 'analysis' as const,
    },
  ];

  const traces: ReasoningTrace[] = [];
  let cleanedContent = responseText;
  const reasoningParts: string[] = [];

  // Extract all reasoning sections
  for (const { pattern, type } of reasoningPatterns) {
    const matches = Array.from(responseText.matchAll(pattern));
    for (const match of matches) {
      if (match[1]) {
        const content = match[1].trim();
        reasoningParts.push(content);

        // Create a trace for each match
        traces.push({
          id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          type,
          content,
          confidence: 1.0, // XML tags have high confidence
          metadata: {
            tagType: match[0].match(/<([^>]+)>/)?.[1] || 'unknown',
            originalLength: match[0].length,
          },
        });

        // Remove the matched reasoning section from the content
        cleanedContent = cleanedContent.replace(match[0], '');
      }
    }
  }

  // Also check for inline reasoning patterns (fallback for non-XML content)
  if (traces.length === 0) {
    const inlinePatterns = [
      { pattern: /Planning:?\s*([^.!?]+[.!?])/gi, type: 'planning' as const },
      { pattern: /Analysis:?\s*([^.!?]+[.!?])/gi, type: 'analysis' as const },
      { pattern: /Reasoning:?\s*([^.!?]+[.!?])/gi, type: 'reasoning' as const },
      {
        pattern: /Conclusion:?\s*([^.!?]+[.!?])/gi,
        type: 'conclusion' as const,
      },
    ];

    for (const { pattern, type } of inlinePatterns) {
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: Common pattern for regex matching
      while ((match = pattern.exec(responseText)) !== null) {
        const content = match[1]?.trim();
        if (content) {
          traces.push({
            id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            type,
            content,
            confidence: 0.7, // Lower confidence for inline patterns
          });
        }
      }
    }
  }

  // Clean up extra whitespace
  cleanedContent = cleanedContent.trim();

  // Join all reasoning sections if multiple found
  const combinedReasoning =
    reasoningParts.length > 0 ? reasoningParts.join('\n\n---\n\n') : null;

  // Create summary
  let summary: string | undefined;
  if (traces.length > 0) {
    const traceTypes = traces.map((t) => t.type);
    const uniqueTypes = Array.from(new Set(traceTypes));
    summary = `Found ${uniqueTypes.join(', ')} reasoning (${traces.length} sections)`;
  }

  return {
    traces,
    cleanedContent,
    reasoning: combinedReasoning,
    summary,
    processingTime,
    totalTokens,
  };
}

/**
 * Middleware for use with AI SDK streamText
 * Extracts reasoning in real-time during streaming
 */
export function createReasoningMiddleware() {
  let _buffer = '';
  const reasoningBuffer: { type: string; content: string }[] = [];
  let isInsideReasoningTag = false;
  let currentTagName = '';
  let currentTagType: ReasoningTrace['type'] = 'reasoning';
  let currentContent = '';

  const tagTypeMap: Record<string, ReasoningTrace['type']> = {
    thinking: 'thinking',
    reasoning: 'reasoning',
    thought: 'thinking',
    reflection: 'reflection',
    cot: 'reasoning',
    chain_of_thought: 'reasoning',
    internal_reasoning: 'reasoning',
    inner_thoughts: 'thinking',
    planning: 'planning',
    analysis: 'analysis',
  };

  return {
    /**
     * Process streaming chunks
     */
    processChunk(chunk: string): string {
      _buffer += chunk;

      // Check for reasoning tag starts
      const openTagMatch =
        /<([^>]+:)?(thinking|reasoning|thought|reflection|cot|chain_of_thought|internal_reasoning|inner_thoughts|planning|analysis)>/gi.exec(
          chunk
        );
      if (openTagMatch) {
        isInsideReasoningTag = true;
        currentTagName = openTagMatch[2].toLowerCase();
        currentTagType = tagTypeMap[currentTagName] || 'reasoning';
        currentContent = '';
        return ''; // Don't output reasoning tags
      }

      // Check for reasoning tag ends
      if (isInsideReasoningTag) {
        const closeTagMatch = new RegExp(
          `<\\/([^>]+:)?${currentTagName}>`,
          'gi'
        ).exec(chunk);
        if (closeTagMatch) {
          isInsideReasoningTag = false;

          // Save the collected reasoning
          if (currentContent.trim()) {
            reasoningBuffer.push({
              type: currentTagType,
              content: currentContent.trim(),
            });
          }

          currentTagName = '';
          currentContent = '';
          return ''; // Don't output closing tags
        }

        // Collect content while inside tags
        currentContent += chunk;
        return '';
      }

      // Otherwise, return the chunk as-is
      return chunk;
    },

    /**
     * Get collected reasoning after streaming completes
     */
    getReasoning(): string | null {
      return reasoningBuffer.length > 0
        ? reasoningBuffer
            .map((r) => `[${r.type}]: ${r.content}`)
            .join('\n\n---\n\n')
        : null;
    },

    /**
     * Get reasoning traces
     */
    getTraces(): ReasoningTrace[] {
      return reasoningBuffer.map((r, idx) => ({
        id: `trace-stream-${idx}`,
        timestamp: Date.now() + idx,
        type: r.type as ReasoningTrace['type'],
        content: r.content,
        confidence: 1.0,
      }));
    },

    /**
     * Reset the middleware state
     */
    reset() {
      _buffer = '';
      reasoningBuffer.length = 0;
      isInsideReasoningTag = false;
      currentTagName = '';
      currentContent = '';
    },
  };
}

/**
 * Format reasoning traces for display
 */
export function formatReasoningTraces(traces: ReasoningTrace[]): string {
  if (traces.length === 0) return '';

  const typeEmojis: Record<string, string> = {
    planning: '📋',
    analysis: '🔍',
    reasoning: '🤔',
    thinking: '💭',
    conclusion: '💡',
    reflection: '🪞',
  };

  const formatted = traces
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((trace) => {
      const emoji = typeEmojis[trace.type] || '💭';
      const typeLabel =
        trace.type.charAt(0).toUpperCase() + trace.type.slice(1);
      return `${emoji} ${typeLabel}: ${trace.content}`;
    })
    .join('\n\n');

  return `## AI Reasoning Process\n\n${formatted}`;
}

/**
 * Check if content contains reasoning traces
 */
export function hasReasoningTraces(content: string): boolean {
  const patterns = [
    /<[^>]*thinking[^>]*>/i,
    /<[^>]*reasoning[^>]*>/i,
    /<[^>]*thought[^>]*>/i,
    /<[^>]*reflection[^>]*>/i,
    /<cot>/i,
    /<chain_of_thought>/i,
    /<internal_reasoning>/i,
    /<inner_thoughts>/i,
    /<planning>/i,
    /<analysis>/i,
  ];

  return patterns.some((pattern) => pattern.test(content));
}

/**
 * Format reasoning for display with metadata
 */
export function formatReasoningForDisplay(
  reasoning: string | null,
  metadata?: {
    reasoningTokens?: number;
    reasoningTime?: number;
    totalTokens?: number;
  }
): string {
  if (!reasoning) {
    return '';
  }

  let formatted = '### 🤔 AI Reasoning Process\n\n';
  formatted += reasoning;

  if (metadata) {
    formatted += '\n\n---\n\n';
    formatted += '**Metadata:**\n';
    if (metadata.reasoningTokens) {
      formatted += `- Reasoning tokens: ~${metadata.reasoningTokens}\n`;
    }
    if (metadata.reasoningTime) {
      formatted += `- Response time: ${metadata.reasoningTime}ms\n`;
    }
    if (metadata.totalTokens) {
      formatted += `- Total tokens: ${metadata.totalTokens}\n`;
    }
  }

  return formatted;
}
