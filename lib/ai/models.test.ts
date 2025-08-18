/**
 * Mock AI Models for Testing RoboRail Assistant
 * Based on chat-sdk.dev testing patterns with controlled responses
 */

import { ReadableStream } from 'stream/web';

export interface MockModelResponse {
  content: string;
  delay?: number;
  chunks?: string[];
  toolCalls?: any[];
  reasoning?: string;
}

/**
 * Create a mock readable stream with controlled response timing
 */
function createMockStream(response: MockModelResponse): ReadableStream<Uint8Array> {
  const { content, delay = 100, chunks } = response;
  const responseChunks = chunks || content.split(' ').map(word => word + ' ');
  
  let index = 0;
  
  return new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        if (index < responseChunks.length) {
          const chunk = responseChunks[index];
          const encoded = new TextEncoder().encode(
            `data: ${JSON.stringify({ content: chunk })}\n\n`
          );
          controller.enqueue(encoded);
          index++;
        } else {
          controller.enqueue(
            new TextEncoder().encode(`data: [DONE]\n\n`)
          );
          controller.close();
          clearInterval(interval);
        }
      }, delay);
    }
  });
}

/**
 * Mock model responses for RoboRail technical support scenarios
 */
export const mockResponses: Record<string, MockModelResponse> = {
  // Basic RoboRail questions
  "what is roborail": {
    content: "RoboRail is HGG Group's all-in-one robotic plasma cutting machine designed for processing railings, channels, and structural components. It features advanced automation with Stäubli robotics and Hypertherm plasma systems.",
    delay: 80,
    chunks: [
      "RoboRail is HGG Group's all-in-one robotic plasma cutting machine",
      " designed for processing railings, channels, and structural components.",
      " It features advanced automation with Stäubli robotics and Hypertherm plasma systems."
    ]
  },

  "roborail specifications": {
    content: "The RoboRail can cut 12-inch channel, tube columns and angles up to 8\" x 8\", and 1-1/4\" to 10\" pipe. It has two footprint options: 21 feet (7.3m) and 40 feet (12m) for material in-feed length. The system includes ProCAM software for seamless CAD integration.",
    delay: 100,
    reasoning: "Providing detailed technical specifications for the RoboRail machine"
  },

  "plasma cutting troubleshooting": {
    content: "For plasma cutting issues on RoboRail: 1) Check consumables - ensure proper electrode and nozzle condition, 2) Verify air pressure settings, 3) Inspect cut quality - adjust cutting speed if needed, 4) Check material grounding, 5) Review CAD programming for proper cut sequences.",
    delay: 120,
    chunks: [
      "For plasma cutting issues on RoboRail: ",
      "1) Check consumables - ensure proper electrode and nozzle condition, ",
      "2) Verify air pressure settings, ",
      "3) Inspect cut quality - adjust cutting speed if needed, ",
      "4) Check material grounding, ",
      "5) Review CAD programming for proper cut sequences."
    ]
  },

  // Error handling scenarios
  "machine error": {
    content: "I understand you're experiencing a machine error. To help diagnose the issue, could you please provide: 1) The specific error code displayed, 2) What operation was being performed, 3) Any unusual sounds or behaviors observed. This will help me provide targeted troubleshooting steps.",
    delay: 90
  },

  // General greetings
  "hello": {
    content: "Hello! I'm your RoboRail Assistant, here to help with technical support for your HGG RoboRail plasma cutting system. How can I assist you today?",
    delay: 60
  },

  "hi": {
    content: "Hi there! Welcome to RoboRail technical support. I can help with machine operations, troubleshooting, maintenance, and CAD integration questions. What do you need assistance with?",
    delay: 50
  },

  // Testing edge cases
  "long response test": {
    content: "This is a very long response designed to test streaming capabilities and UI rendering with extensive content. ".repeat(20),
    delay: 50,
    chunks: Array(40).fill("This is a chunk of streaming text. ")
  },

  "empty response": {
    content: "",
    delay: 10
  },

  "special characters": {
    content: "Testing special characters: áéíóú ñ ¡¿ €£¥ «»‹› —–''""…",
    delay: 70
  },

  // CAD and software questions
  "cad integration": {
    content: "RoboRail supports DSTV and STEP files directly from CAD systems like SDS/2, Tekla Structures, SolidWorks, and Inventor. The ProCAM software converts your CAD files into cutting files seamlessly. Would you like help with a specific CAD integration issue?",
    delay: 90
  },

  // Maintenance questions
  "maintenance schedule": {
    content: "Regular maintenance for RoboRail includes: Daily - check consumables and air pressure; Weekly - inspect robot arm and torch assembly; Monthly - calibrate system and check software updates; Quarterly - comprehensive system inspection. Would you like details on any specific maintenance task?",
    delay: 100
  }
};

/**
 * Mock model that returns different responses based on input
 */
export class MockRoboRailModel {
  private responses: Record<string, MockModelResponse>;

  constructor(customResponses: Record<string, MockModelResponse> = {}) {
    this.responses = { ...mockResponses, ...customResponses };
  }

  /**
   * Generate response based on input prompt
   */
  async generateStream(prompt: string): Promise<ReadableStream<Uint8Array>> {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Find matching response
    let response = this.responses["default"] || {
      content: "I'm here to help with RoboRail technical support. Could you please rephrase your question?",
      delay: 80
    };

    // Check for exact matches first
    if (this.responses[normalizedPrompt]) {
      response = this.responses[normalizedPrompt];
    } else {
      // Check for partial matches
      for (const [key, value] of Object.entries(this.responses)) {
        if (normalizedPrompt.includes(key) || key.includes(normalizedPrompt)) {
          response = value;
          break;
        }
      }
    }

    return createMockStream(response);
  }

  /**
   * Add new mock responses for testing
   */
  addResponse(prompt: string, response: MockModelResponse) {
    this.responses[prompt.toLowerCase().trim()] = response;
  }

  /**
   * Simulate network delay or errors
   */
  async generateWithDelay(prompt: string, delay: number): Promise<ReadableStream<Uint8Array>> {
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.generateStream(prompt);
  }

  /**
   * Simulate error responses
   */
  generateError(errorMessage: string): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.error(new Error(errorMessage));
      }
    });
  }

  /**
   * Test resumable streams by simulating interruption
   */
  generateInterruptedStream(prompt: string, interruptAfter: number): ReadableStream<Uint8Array> {
    const response = this.responses[prompt.toLowerCase().trim()] || this.responses["default"];
    let chunkCount = 0;

    return new ReadableStream({
      start(controller) {
        const interval = setInterval(() => {
          if (chunkCount < interruptAfter) {
            const chunk = `Chunk ${chunkCount + 1} of response. `;
            const encoded = new TextEncoder().encode(
              `data: ${JSON.stringify({ content: chunk })}\n\n`
            );
            controller.enqueue(encoded);
            chunkCount++;
          } else {
            // Simulate interruption
            controller.error(new Error("Connection interrupted"));
            clearInterval(interval);
          }
        }, 100);
      }
    });
  }
}

// Export default mock model instance
export const mockModel = new MockRoboRailModel();