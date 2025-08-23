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
      minTime: Number.POSITIVE_INFINITY,
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
    for (let i = 0; i < iterations; i++) {
      await this.makeRequest(i + 1);
      if (i < iterations - 1 && delay > 0) {
        await this.sleep(delay);
      }
    }
  }

  async runConcurrent(iterations, batchSize, delay) {
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
          parts: [
            {
              type: 'text',
              text: `Performance test ${iteration}: What safety equipment is required for RoboRail maintenance?`,
            },
          ],
        },
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
      } else {
        status = 'failure';
        error = `HTTP ${response.status}`;
        this.results.failureCount++;
      }
    } catch (err) {
      status = 'error';
      error = err.message;
      this.results.failureCount++;
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
    const successfulRequests = this.results.requests.filter(
      (r) => r.status === 'success'
    );

    if (successfulRequests.length > 0) {
      // Calculate average
      const successTimes = successfulRequests.map((r) => r.totalTime);
      this.results.avgTime =
        successTimes.reduce((a, b) => a + b, 0) / successTimes.length;

      // Calculate percentiles
      successTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(successTimes.length * 0.95);
      const p99Index = Math.floor(successTimes.length * 0.99);

      this.results.p95Time = successTimes[p95Index] || successTimes.at(-1);
      this.results.p99Time = successTimes[p99Index] || successTimes.at(-1);

      // Calculate average response size
      const avgSize =
        successfulRequests.reduce((sum, r) => sum + r.responseSize, 0) /
        successfulRequests.length;
      this.results.avgResponseSize = avgSize;

      // Calculate average first byte time
      const avgFirstByte =
        successfulRequests.reduce((sum, r) => sum + r.firstByteTime, 0) /
        successfulRequests.length;
      this.results.avgFirstByteTime = avgFirstByte;
    }
  }

  displayResults(_totalDuration) {
    const _successRate = (
      (this.results.successCount / this.results.requests.length) *
      100
    ).toFixed(1);

    if (this.results.successCount > 0) {
    }
    const _rating = this.getPerformanceRating();
  }

  getPerformanceRating() {
    const avgTime = this.results.avgTime;
    const successRate =
      (this.results.successCount / this.results.requests.length) * 100;

    if (successRate === 100 && avgTime < 500) {
      return `${COLORS.green}⭐⭐⭐⭐⭐ EXCELLENT - Lightning fast with perfect reliability${COLORS.reset}`;
    }
    if (successRate >= 95 && avgTime < 1000) {
      return `${COLORS.green}⭐⭐⭐⭐ VERY GOOD - Fast and reliable${COLORS.reset}`;
    }
    if (successRate >= 90 && avgTime < 2000) {
      return `${COLORS.blue}⭐⭐⭐ GOOD - Acceptable performance${COLORS.reset}`;
    }
    if (successRate >= 80 && avgTime < 3000) {
      return `${COLORS.yellow}⭐⭐ FAIR - Needs optimization${COLORS.reset}`;
    }
    return `${COLORS.red}⭐ POOR - Significant performance issues${COLORS.reset}`;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        config.iterations = Number.parseInt(args[++i], 10) || 10;
        break;
      case '--concurrent':
      case '-c':
        config.concurrent = true;
        break;
      case '--batch':
      case '-b':
        config.concurrentBatch = Number.parseInt(args[++i], 10) || 3;
        break;
      case '--delay':
      case '-d':
        config.delay = Number.parseInt(args[++i], 10) || 500;
        break;
      case '--help':
      case '-h':
        process.exit(0);
    }
  }

  const benchmark = new PerformanceBenchmark();
  await benchmark.runBenchmark(config);
}

// Run if executed directly
if (require.main === module) {
  main().catch((_error) => {
    process.exit(1);
  });
}

module.exports = PerformanceBenchmark;
