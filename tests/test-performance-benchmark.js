#!/usr/bin/env node
// Performance benchmark test for RoboRail chat API
const fetch = require('node-fetch');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class PerformanceBenchmark {
  constructor() {
    this.results = {
      requests: [],
      successCount: 0,
      failureCount: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      avgTime: 0,
      p95Time: 0,
      p99Time: 0,
    };
  }

  async runBenchmark(config = {}) {
    const {
      iterations = 10,
      concurrent = false,
      concurrentBatch = 3,
      delay = 1000,
    } = config;

    console.log(`${COLORS.bright}${COLORS.cyan}🚀 PERFORMANCE BENCHMARK${COLORS.reset}\n`);
    console.log('='.repeat(60));
    console.log(`${COLORS.bright}Configuration:${COLORS.reset}`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Mode: ${concurrent ? `Concurrent (batch of ${concurrentBatch})` : 'Sequential'}`);
    console.log(`  Delay: ${delay}ms between requests`);
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    if (concurrent) {
      await this.runConcurrent(iterations, concurrentBatch, delay);
    } else {
      await this.runSequential(iterations, delay);
    }

    const totalDuration = Date.now() - startTime;
    this.calculateStats();
    this.displayResults(totalDuration);
  }

  async runSequential(iterations, delay) {
    console.log(`${COLORS.bright}Running Sequential Tests...${COLORS.reset}\n`);
    
    for (let i = 0; i < iterations; i++) {
      await this.makeRequest(i + 1);
      if (i < iterations - 1 && delay > 0) {
        await this.sleep(delay);
      }
    }
  }

  async runConcurrent(iterations, batchSize, delay) {
    console.log(`${COLORS.bright}Running Concurrent Tests...${COLORS.reset}\n`);
    
    const batches = Math.ceil(iterations / batchSize);
    let requestCount = 0;

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises = [];
      const remainingIterations = iterations - requestCount;
      const currentBatchSize = Math.min(batchSize, remainingIterations);

      for (let i = 0; i < currentBatchSize; i++) {
        batchPromises.push(this.makeRequest(requestCount + i + 1));
      }

      await Promise.all(batchPromises);
      requestCount += currentBatchSize;

      if (batch < batches - 1 && delay > 0) {
        await this.sleep(delay);
      }
    }
  }

  async makeRequest(iteration) {
    const testId = `perf-${Date.now()}-${iteration}`;
    const payload = {
      messages: [
        {
          role: 'user',
          parts: [{ 
            type: 'text', 
            text: `Performance test ${iteration}: What safety equipment is required for RoboRail maintenance?` 
          }]
        }
      ],
      chatId: testId,
      userId: `guest-perf-${Date.now()}`,
      model: 'gpt-5-mini',
      isAuthenticated: false,
      enableSearch: false,
      reasoningEffort: 'medium',
      verbosity: 'low', // Low verbosity for performance testing
    };

    const startTime = Date.now();
    let status = 'pending';
    let responseSize = 0;
    let firstByteTime = 0;
    let error = null;

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      firstByteTime = Date.now() - startTime;

      if (response.ok) {
        // Read full response to measure total time
        const responseText = await response.text();
        responseSize = responseText.length;
        status = 'success';
        this.results.successCount++;
        
        console.log(`${COLORS.green}✓${COLORS.reset} Request ${iteration}: ${Date.now() - startTime}ms (${responseSize} bytes)`);
      } else {
        status = 'failure';
        error = `HTTP ${response.status}`;
        this.results.failureCount++;
        console.log(`${COLORS.red}✗${COLORS.reset} Request ${iteration}: Failed with ${response.status}`);
      }
    } catch (err) {
      status = 'error';
      error = err.message;
      this.results.failureCount++;
      console.log(`${COLORS.red}✗${COLORS.reset} Request ${iteration}: ${err.message}`);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    this.results.requests.push({
      iteration,
      status,
      totalTime,
      firstByteTime,
      responseSize,
      error,
    });

    this.results.totalTime += totalTime;
    this.results.minTime = Math.min(this.results.minTime, totalTime);
    this.results.maxTime = Math.max(this.results.maxTime, totalTime);

    return { status, totalTime };
  }

  calculateStats() {
    const successfulRequests = this.results.requests.filter(r => r.status === 'success');
    
    if (successfulRequests.length > 0) {
      // Calculate average
      const successTimes = successfulRequests.map(r => r.totalTime);
      this.results.avgTime = successTimes.reduce((a, b) => a + b, 0) / successTimes.length;

      // Calculate percentiles
      successTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(successTimes.length * 0.95);
      const p99Index = Math.floor(successTimes.length * 0.99);
      
      this.results.p95Time = successTimes[p95Index] || successTimes[successTimes.length - 1];
      this.results.p99Time = successTimes[p99Index] || successTimes[successTimes.length - 1];

      // Calculate average response size
      const avgSize = successfulRequests.reduce((sum, r) => sum + r.responseSize, 0) / successfulRequests.length;
      this.results.avgResponseSize = avgSize;

      // Calculate average first byte time
      const avgFirstByte = successfulRequests.reduce((sum, r) => sum + r.firstByteTime, 0) / successfulRequests.length;
      this.results.avgFirstByteTime = avgFirstByte;
    }
  }

  displayResults(totalDuration) {
    console.log('\n' + '='.repeat(60));
    console.log(`${COLORS.bright}${COLORS.cyan}📊 BENCHMARK RESULTS${COLORS.reset}`);
    console.log('='.repeat(60));

    const successRate = (this.results.successCount / this.results.requests.length * 100).toFixed(1);
    
    console.log(`\n${COLORS.bright}Summary:${COLORS.reset}`);
    console.log(`  Total Requests: ${this.results.requests.length}`);
    console.log(`  Successful: ${COLORS.green}${this.results.successCount}${COLORS.reset}`);
    console.log(`  Failed: ${COLORS.red}${this.results.failureCount}${COLORS.reset}`);
    console.log(`  Success Rate: ${successRate >= 95 ? COLORS.green : successRate >= 80 ? COLORS.yellow : COLORS.red}${successRate}%${COLORS.reset}`);
    console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    if (this.results.successCount > 0) {
      console.log(`\n${COLORS.bright}Response Times:${COLORS.reset}`);
      console.log(`  Min: ${COLORS.green}${this.results.minTime}ms${COLORS.reset}`);
      console.log(`  Max: ${COLORS.yellow}${this.results.maxTime}ms${COLORS.reset}`);
      console.log(`  Average: ${COLORS.blue}${Math.round(this.results.avgTime)}ms${COLORS.reset}`);
      console.log(`  P95: ${this.results.p95Time}ms`);
      console.log(`  P99: ${this.results.p99Time}ms`);
      
      console.log(`\n${COLORS.bright}Performance Metrics:${COLORS.reset}`);
      console.log(`  Avg First Byte: ${Math.round(this.results.avgFirstByteTime)}ms`);
      console.log(`  Avg Response Size: ${Math.round(this.results.avgResponseSize)} bytes`);
      console.log(`  Throughput: ${(this.results.successCount / (totalDuration / 1000)).toFixed(2)} req/s`);
    }

    // Performance rating
    console.log(`\n${COLORS.bright}Performance Rating:${COLORS.reset}`);
    const rating = this.getPerformanceRating();
    console.log(`  ${rating}`);

    console.log('\n' + '='.repeat(60));
  }

  getPerformanceRating() {
    const avgTime = this.results.avgTime;
    const successRate = (this.results.successCount / this.results.requests.length * 100);

    if (successRate === 100 && avgTime < 500) {
      return `${COLORS.green}⭐⭐⭐⭐⭐ EXCELLENT - Lightning fast with perfect reliability${COLORS.reset}`;
    } else if (successRate >= 95 && avgTime < 1000) {
      return `${COLORS.green}⭐⭐⭐⭐ VERY GOOD - Fast and reliable${COLORS.reset}`;
    } else if (successRate >= 90 && avgTime < 2000) {
      return `${COLORS.blue}⭐⭐⭐ GOOD - Acceptable performance${COLORS.reset}`;
    } else if (successRate >= 80 && avgTime < 3000) {
      return `${COLORS.yellow}⭐⭐ FAIR - Needs optimization${COLORS.reset}`;
    } else {
      return `${COLORS.red}⭐ POOR - Significant performance issues${COLORS.reset}`;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const config = {
    iterations: 10,
    concurrent: false,
    concurrentBatch: 3,
    delay: 500,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--iterations':
      case '-i':
        config.iterations = parseInt(args[++i]) || 10;
        break;
      case '--concurrent':
      case '-c':
        config.concurrent = true;
        break;
      case '--batch':
      case '-b':
        config.concurrentBatch = parseInt(args[++i]) || 3;
        break;
      case '--delay':
      case '-d':
        config.delay = parseInt(args[++i]) || 500;
        break;
      case '--help':
      case '-h':
        console.log(`
${COLORS.bright}RoboRail Chat API Performance Benchmark${COLORS.reset}

Usage: node test-performance-benchmark.js [options]

Options:
  -i, --iterations <n>  Number of test iterations (default: 10)
  -c, --concurrent      Run tests concurrently
  -b, --batch <n>       Concurrent batch size (default: 3)
  -d, --delay <ms>      Delay between requests in ms (default: 500)
  -h, --help           Show this help message

Examples:
  node test-performance-benchmark.js                    # Run 10 sequential tests
  node test-performance-benchmark.js -i 20 -c          # Run 20 concurrent tests
  node test-performance-benchmark.js -i 50 -c -b 5     # Run 50 tests, 5 at a time
  node test-performance-benchmark.js -i 100 -d 100     # Run 100 tests with 100ms delay
        `);
        process.exit(0);
    }
  }

  const benchmark = new PerformanceBenchmark();
  await benchmark.runBenchmark(config);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmark;