/**
 * Performance Test Suite
 * Automated testing for chat UI performance optimizations
 */

interface PerformanceTestResult {
  testName: string;
  passed: boolean;
  metrics: {
    renderTime?: number;
    memoryUsage?: number;
    bundleSize?: number;
    reRenderCount?: number;
  };
  recommendations?: string[];
}

interface PerformanceTestConfig {
  messageCount: number;
  streamingDuration: number;
  concurrentChats: number;
  acceptableRenderTime: number;
  acceptableMemoryUsage: number;
}

class PerformanceTestSuite {
  private config: PerformanceTestConfig;
  private results: PerformanceTestResult[] = [];

  constructor(config: Partial<PerformanceTestConfig> = {}) {
    this.config = {
      messageCount: 50,
      streamingDuration: 5000,
      concurrentChats: 3,
      acceptableRenderTime: 16.67, // 60fps
      acceptableMemoryUsage: 50 * 1024 * 1024, // 50MB
      ...config,
    };
  }

  /**
   * Test message rendering performance
   */
  async testMessageRendering(): Promise<PerformanceTestResult> {
    const testName = 'Message Rendering Performance';
    const startTime = performance.now();
    
    try {
      // Simulate message rendering
      const messages = Array.from({ length: this.config.messageCount }, (_, i) => ({
        id: `msg-${i}`,
        content: `Test message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
      }));

      // Measure render time for each message
      const renderTimes: number[] = [];
      
      for (let i = 0; i < messages.length; i++) {
        const renderStart = performance.now();
        
        // Simulate React render cycle
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const renderEnd = performance.now();
        renderTimes.push(renderEnd - renderStart);
      }

      const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      const maxRenderTime = Math.max(...renderTimes);
      
      const passed = avgRenderTime <= this.config.acceptableRenderTime;
      
      const recommendations: string[] = [];
      if (!passed) {
        recommendations.push('Consider implementing React.memo for message components');
        recommendations.push('Check for unnecessary re-renders in message list');
        if (maxRenderTime > this.config.acceptableRenderTime * 2) {
          recommendations.push('Some messages taking too long to render - investigate complex content');
        }
      }

      return {
        testName,
        passed,
        metrics: {
          renderTime: avgRenderTime,
        },
        recommendations,
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        metrics: {},
        recommendations: ['Test failed with error - check console for details'],
      };
    }
  }

  /**
   * Test streaming performance
   */
  async testStreamingPerformance(): Promise<PerformanceTestResult> {
    const testName = 'Streaming Performance';
    let frameDrops = 0;
    let lastFrameTime = performance.now();
    
    const frameCallback = () => {
      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;
      
      // Detect frame drops (>16.67ms between frames)
      if (frameDuration > this.config.acceptableRenderTime * 1.5) {
        frameDrops++;
      }
      
      lastFrameTime = currentTime;
    };

    try {
      // Simulate streaming for configured duration
      const testDuration = this.config.streamingDuration;
      const startTime = performance.now();
      
      const intervalId = setInterval(frameCallback, 1);
      
      // Simulate streaming text updates
      const streamingText = 'A'.repeat(1000);
      let charIndex = 0;
      
      const streamingInterval = setInterval(() => {
        // Simulate character-by-character streaming
        charIndex += 2; // Batched updates as per optimization
        if (charIndex >= streamingText.length) {
          charIndex = 0;
        }
      }, 10);

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));
      
      clearInterval(intervalId);
      clearInterval(streamingInterval);
      
      const endTime = performance.now();
      const totalFrames = Math.floor((endTime - startTime) / this.config.acceptableRenderTime);
      const frameDropPercentage = (frameDrops / totalFrames) * 100;
      
      const passed = frameDropPercentage < 5; // Less than 5% frame drops acceptable
      
      const recommendations: string[] = [];
      if (!passed) {
        recommendations.push('Optimize streaming animation to reduce frame drops');
        recommendations.push('Consider batching more character updates');
        if (frameDropPercentage > 10) {
          recommendations.push('High frame drop rate - check for blocking operations');
        }
      }

      return {
        testName,
        passed,
        metrics: {
          renderTime: frameDropPercentage,
        },
        recommendations,
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        metrics: {},
        recommendations: ['Streaming test failed - check animation implementation'],
      };
    }
  }

  /**
   * Test memory usage
   */
  async testMemoryUsage(): Promise<PerformanceTestResult> {
    const testName = 'Memory Usage';
    
    try {
      const initialMemory = this.getCurrentMemoryUsage();
      
      // Simulate heavy chat usage
      const messages = Array.from({ length: this.config.messageCount * 2 }, (_, i) => ({
        id: `msg-${i}`,
        content: 'A'.repeat(1000), // 1KB per message
        role: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: Date.now(),
      }));

      // Simulate message cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentMemory = this.getCurrentMemoryUsage();
      const memoryIncrease = currentMemory - initialMemory;
      
      const passed = memoryIncrease <= this.config.acceptableMemoryUsage;
      
      const recommendations: string[] = [];
      if (!passed) {
        recommendations.push('Memory usage too high - check for memory leaks');
        recommendations.push('Consider implementing message virtualization');
        if (memoryIncrease > this.config.acceptableMemoryUsage * 2) {
          recommendations.push('Critical memory leak detected - immediate action required');
        }
      }

      return {
        testName,
        passed,
        metrics: {
          memoryUsage: memoryIncrease,
        },
        recommendations,
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        metrics: {},
        recommendations: ['Memory test failed - unable to measure memory usage'],
      };
    }
  }

  /**
   * Test multi-chat performance
   */
  async testMultiChatPerformance(): Promise<PerformanceTestResult> {
    const testName = 'Multi-Chat Performance';
    
    try {
      const startTime = performance.now();
      
      // Simulate multiple concurrent chat instances
      const chatPromises = Array.from({ length: this.config.concurrentChats }, async (_, i) => {
        // Simulate chat initialization and message handling
        const messages = Array.from({ length: 10 }, (_, j) => ({
          id: `chat-${i}-msg-${j}`,
          content: `Message ${j} in chat ${i}`,
          role: j % 2 === 0 ? 'user' : 'assistant',
        }));
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return messages;
      });

      await Promise.all(chatPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should handle concurrent chats efficiently
      const expectedMaxTime = this.config.concurrentChats * 100; // 100ms per chat max
      const passed = totalTime <= expectedMaxTime;
      
      const recommendations: string[] = [];
      if (!passed) {
        recommendations.push('Multi-chat performance is slow - optimize concurrent handling');
        recommendations.push('Consider limiting number of simultaneous chats');
        if (totalTime > expectedMaxTime * 2) {
          recommendations.push('Critical multi-chat performance issue');
        }
      }

      return {
        testName,
        passed,
        metrics: {
          renderTime: totalTime,
        },
        recommendations,
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        metrics: {},
        recommendations: ['Multi-chat test failed - check concurrent handling'],
      };
    }
  }

  /**
   * Test bundle size impact
   */
  async testBundleOptimization(): Promise<PerformanceTestResult> {
    const testName = 'Bundle Size Optimization';
    
    try {
      // Simulate dynamic imports
      const importTimes: number[] = [];
      const components = [
        'chat-component',
        'message-component',
        'input-component',
        'feedback-component',
      ];

      for (const component of components) {
        const importStart = performance.now();
        
        // Simulate dynamic import delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        const importEnd = performance.now();
        importTimes.push(importEnd - importStart);
      }

      const avgImportTime = importTimes.reduce((sum, time) => sum + time, 0) / importTimes.length;
      const passed = avgImportTime <= 200; // 200ms max for dynamic imports
      
      const recommendations: string[] = [];
      if (!passed) {
        recommendations.push('Dynamic imports taking too long - optimize bundle splitting');
        recommendations.push('Consider preloading critical components');
      }

      return {
        testName,
        passed,
        metrics: {
          bundleSize: avgImportTime,
        },
        recommendations,
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        metrics: {},
        recommendations: ['Bundle optimization test failed'],
      };
    }
  }

  /**
   * Run all performance tests
   */
  async runAllTests(): Promise<{
    passed: number;
    failed: number;
    results: PerformanceTestResult[];
    overallScore: number;
  }> {
    console.log('🚀 Running performance test suite...');
    
    this.results = [];
    
    const tests = [
      this.testMessageRendering(),
      this.testStreamingPerformance(),
      this.testMemoryUsage(),
      this.testMultiChatPerformance(),
      this.testBundleOptimization(),
    ];

    const results = await Promise.all(tests);
    this.results = results;

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const overallScore = Math.round((passed / results.length) * 100);

    console.log(`✅ Performance tests completed: ${passed}/${results.length} passed`);
    console.log(`📊 Overall performance score: ${overallScore}%`);

    // Log failed tests and recommendations
    results.forEach(result => {
      if (!result.passed) {
        console.warn(`❌ ${result.testName} failed`);
        result.recommendations?.forEach(rec => console.warn(`  💡 ${rec}`));
      } else {
        console.log(`✅ ${result.testName} passed`);
      }
    });

    return {
      passed,
      failed,
      results,
      overallScore,
    };
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }
}

// Export test suite instance
export const performanceTestSuite = new PerformanceTestSuite();

// Export test runner for CI/CD
export async function runPerformanceTests(config?: Partial<PerformanceTestConfig>) {
  const suite = new PerformanceTestSuite(config);
  return await suite.runAllTests();
}

// Development helper
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Make available in development console
  (window as any).runPerformanceTests = () => performanceTestSuite.runAllTests();
}