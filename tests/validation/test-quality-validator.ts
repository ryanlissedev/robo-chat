/**
 * Test Quality Validator
 * Comprehensive validation of test suite quality and coverage
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface TestQualityMetrics {
  coverage: CoverageMetrics;
  testCounts: TestCounts;
  qualityChecks: QualityChecks;
  recommendations: string[];
}

interface CoverageMetrics {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncoveredFiles: string[];
}

interface TestCounts {
  unit: number;
  integration: number;
  e2e: number;
  total: number;
}

interface QualityChecks {
  hasErrorHandling: boolean;
  hasEdgeCases: boolean;
  hasAccessibilityTests: boolean;
  hasPerformanceTests: boolean;
  hasMockingStrategy: boolean;
  hasSetupTeardown: boolean;
  followsNamingConventions: boolean;
}

export class TestQualityValidator {
  private projectRoot: string;
  private testsRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.testsRoot = path.join(projectRoot, 'tests');
  }

  /**
   * Run comprehensive test quality validation
   */
  async validateTestQuality(): Promise<TestQualityMetrics> {
    console.log('🔍 Starting comprehensive test quality validation...\n');

    const [coverage, testCounts, qualityChecks] = await Promise.all([
      this.analyzeCoverage(),
      this.countTests(),
      this.performQualityChecks(),
    ]);

    const recommendations = this.generateRecommendations(
      coverage,
      testCounts,
      qualityChecks
    );

    const metrics: TestQualityMetrics = {
      coverage,
      testCounts,
      qualityChecks,
      recommendations,
    };

    this.printReport(metrics);
    return metrics;
  }

  /**
   * Analyze test coverage metrics
   */
  private async analyzeCoverage(): Promise<CoverageMetrics> {
    console.log('📊 Analyzing test coverage...');

    try {
      // Run coverage analysis
      const { stdout: _stdout } = await execAsync('npm run test:coverage', {
        cwd: this.projectRoot,
        env: { ...process.env, CI: 'true' },
      });

      // Parse coverage from JSON report if available
      const coverageReportPath = path.join(
        this.projectRoot,
        'coverage',
        'coverage-summary.json'
      );

      if (fs.existsSync(coverageReportPath)) {
        const coverageData = JSON.parse(
          fs.readFileSync(coverageReportPath, 'utf8')
        );
        const total = coverageData.total;

        return {
          statements: total.statements.pct,
          branches: total.branches.pct,
          functions: total.functions.pct,
          lines: total.lines.pct,
          uncoveredFiles: this.findUncoveredFiles(coverageData),
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not run coverage analysis:', error);
    }

    // Fallback analysis
    return this.estimateCoverage();
  }

  /**
   * Count different types of tests
   */
  private async countTests(): Promise<TestCounts> {
    console.log('📝 Counting test files...');

    const testTypes = {
      unit: path.join(this.testsRoot, 'unit'),
      integration: path.join(this.testsRoot, 'integration'),
      e2e: path.join(this.testsRoot, 'e2e'),
    };

    const counts = {
      unit: 0,
      integration: 0,
      e2e: 0,
      total: 0,
    };

    for (const [type, dir] of Object.entries(testTypes)) {
      if (fs.existsSync(dir)) {
        const testFiles = this.findTestFiles(dir);
        counts[type as keyof typeof testTypes] = testFiles.length;
      }
    }

    counts.total = counts.unit + counts.integration + counts.e2e;
    return counts;
  }

  /**
   * Perform qualitative checks on test suite
   */
  private async performQualityChecks(): Promise<QualityChecks> {
    console.log('✅ Performing quality checks...');

    const allTestFiles = this.getAllTestFiles();

    return {
      hasErrorHandling: this.checkErrorHandlingTests(allTestFiles),
      hasEdgeCases: this.checkEdgeCaseTests(allTestFiles),
      hasAccessibilityTests: this.checkAccessibilityTests(allTestFiles),
      hasPerformanceTests: this.checkPerformanceTests(allTestFiles),
      hasMockingStrategy: this.checkMockingStrategy(allTestFiles),
      hasSetupTeardown: this.checkSetupTeardown(allTestFiles),
      followsNamingConventions: this.checkNamingConventions(allTestFiles),
    };
  }

  /**
   * Find uncovered files from coverage report
   */
  private findUncoveredFiles(coverageData: any): string[] {
    const uncovered: string[] = [];

    for (const [filePath, fileData] of Object.entries<any>(coverageData)) {
      if (filePath !== 'total') {
        const coverage = fileData.statements?.pct || 0;
        if (coverage < 80) {
          uncovered.push(filePath);
        }
      }
    }

    return uncovered.slice(0, 10); // Limit to top 10 for readability
  }

  /**
   * Estimate coverage based on file analysis
   */
  private estimateCoverage(): CoverageMetrics {
    const sourceFiles = this.findSourceFiles();
    const testFiles = this.getAllTestFiles();

    // Simple heuristic: estimate coverage based on test file count
    const estimatedCoverage = Math.min(
      (testFiles.length / sourceFiles.length) * 100,
      100
    );

    return {
      statements: estimatedCoverage,
      branches: estimatedCoverage * 0.9,
      functions: estimatedCoverage * 0.95,
      lines: estimatedCoverage,
      uncoveredFiles: sourceFiles.slice(testFiles.length), // Rough estimate
    };
  }

  /**
   * Find all source files in the project
   */
  private findSourceFiles(): string[] {
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    const sourceDirs = ['app', 'components', 'lib', 'pages'];
    const files: string[] = [];

    for (const dir of sourceDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        files.push(...this.findFilesRecursive(fullPath, sourceExtensions));
      }
    }

    return files;
  }

  /**
   * Find all test files
   */
  private getAllTestFiles(): string[] {
    if (!fs.existsSync(this.testsRoot)) {
      return [];
    }

    return this.findTestFiles(this.testsRoot);
  }

  /**
   * Find test files in a directory
   */
  private findTestFiles(dir: string): string[] {
    const testExtensions = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];
    return this.findFilesRecursive(dir, testExtensions);
  }

  /**
   * Find files recursively
   */
  private findFilesRecursive(dir: string, extensions: string[]): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && item.name !== 'node_modules') {
          files.push(...this.findFilesRecursive(fullPath, extensions));
        }
      } else if (item.isFile()) {
        if (extensions.some((ext) => item.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Check if tests include error handling scenarios
   */
  private checkErrorHandlingTests(testFiles: string[]): boolean {
    const errorKeywords = [
      'error',
      'throw',
      'catch',
      'fail',
      'reject',
      'exception',
    ];
    return this.checkTestContent(testFiles, errorKeywords);
  }

  /**
   * Check if tests include edge cases
   */
  private checkEdgeCaseTests(testFiles: string[]): boolean {
    const edgeCaseKeywords = [
      'edge',
      'boundary',
      'limit',
      'empty',
      'null',
      'undefined',
      'zero',
      'max',
    ];
    return this.checkTestContent(testFiles, edgeCaseKeywords);
  }

  /**
   * Check if tests include accessibility testing
   */
  private checkAccessibilityTests(testFiles: string[]): boolean {
    const a11yKeywords = [
      'accessibility',
      'a11y',
      'aria',
      'role',
      'keyboard',
      'screen reader',
      'focus',
    ];
    return this.checkTestContent(testFiles, a11yKeywords);
  }

  /**
   * Check if tests include performance testing
   */
  private checkPerformanceTests(testFiles: string[]): boolean {
    const perfKeywords = [
      'performance',
      'perf',
      'timing',
      'speed',
      'memory',
      'load',
      'concurrent',
    ];
    return this.checkTestContent(testFiles, perfKeywords);
  }

  /**
   * Check if tests use proper mocking strategies
   */
  private checkMockingStrategy(testFiles: string[]): boolean {
    const mockKeywords = [
      'mock',
      'stub',
      'spy',
      'vi.fn',
      'jest.fn',
      'mockImplementation',
    ];
    return this.checkTestContent(testFiles, mockKeywords);
  }

  /**
   * Check if tests have proper setup and teardown
   */
  private checkSetupTeardown(testFiles: string[]): boolean {
    const setupKeywords = [
      'beforeEach',
      'afterEach',
      'beforeAll',
      'afterAll',
      'setup',
      'teardown',
    ];
    return this.checkTestContent(testFiles, setupKeywords);
  }

  /**
   * Check if test files follow naming conventions
   */
  private checkNamingConventions(testFiles: string[]): boolean {
    const conventionPattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
    return testFiles.every((file) => conventionPattern.test(file));
  }

  /**
   * Check if test files contain specific keywords
   */
  private checkTestContent(testFiles: string[], keywords: string[]): boolean {
    let foundCount = 0;
    const minRequired = Math.ceil(testFiles.length * 0.1); // At least 10% of test files

    for (const file of testFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8').toLowerCase();
        if (keywords.some((keyword) => content.includes(keyword))) {
          foundCount++;
        }
      } catch (_error) {}
    }

    return foundCount >= minRequired;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    coverage: CoverageMetrics,
    testCounts: TestCounts,
    qualityChecks: QualityChecks
  ): string[] {
    const recommendations: string[] = [];

    // Coverage recommendations
    if (coverage.statements < 90) {
      recommendations.push(
        `📈 Increase statement coverage from ${coverage.statements}% to 90%+`
      );
    }
    if (coverage.branches < 85) {
      recommendations.push(
        `🌳 Increase branch coverage from ${coverage.branches}% to 85%+`
      );
    }
    if (coverage.functions < 95) {
      recommendations.push(
        `⚡ Increase function coverage from ${coverage.functions}% to 95%+`
      );
    }

    // Test count recommendations
    const sourceFiles = this.findSourceFiles().length;
    const testRatio = testCounts.total / Math.max(sourceFiles, 1);

    if (testRatio < 0.5) {
      recommendations.push(
        `📝 Add more tests. Current ratio: ${testRatio.toFixed(2)} tests per source file`
      );
    }

    if (testCounts.integration < 10) {
      recommendations.push(
        '🔗 Add more integration tests to test component interactions'
      );
    }

    if (testCounts.e2e < 5) {
      recommendations.push(
        '🎭 Add more end-to-end tests for critical user journeys'
      );
    }

    // Quality check recommendations
    if (!qualityChecks.hasErrorHandling) {
      recommendations.push(
        '❌ Add error handling and exception testing scenarios'
      );
    }
    if (!qualityChecks.hasEdgeCases) {
      recommendations.push('🎯 Add edge case and boundary condition tests');
    }
    if (!qualityChecks.hasAccessibilityTests) {
      recommendations.push(
        '♿ Add accessibility testing with screen readers and keyboard navigation'
      );
    }
    if (!qualityChecks.hasPerformanceTests) {
      recommendations.push('⚡ Add performance tests for critical code paths');
    }
    if (!qualityChecks.hasMockingStrategy) {
      recommendations.push(
        '🎭 Implement consistent mocking strategy for external dependencies'
      );
    }
    if (!qualityChecks.hasSetupTeardown) {
      recommendations.push('🔧 Add proper test setup and teardown procedures');
    }
    if (!qualityChecks.followsNamingConventions) {
      recommendations.push(
        '📝 Follow consistent test file naming conventions (.test.ts/.spec.ts)'
      );
    }

    // Uncovered files recommendations
    if (coverage.uncoveredFiles.length > 0) {
      recommendations.push(
        `📄 Add tests for uncovered files: ${coverage.uncoveredFiles.slice(0, 3).join(', ')}${coverage.uncoveredFiles.length > 3 ? '...' : ''}`
      );
    }

    return recommendations;
  }

  /**
   * Print comprehensive validation report
   */
  private printReport(metrics: TestQualityMetrics): void {
    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 TEST QUALITY VALIDATION REPORT');
    console.log('='.repeat(80));

    // Coverage Summary
    console.log('\n📊 COVERAGE METRICS:');
    console.log(`  Statements: ${metrics.coverage.statements.toFixed(1)}%`);
    console.log(`  Branches:   ${metrics.coverage.branches.toFixed(1)}%`);
    console.log(`  Functions:  ${metrics.coverage.functions.toFixed(1)}%`);
    console.log(`  Lines:      ${metrics.coverage.lines.toFixed(1)}%`);

    // Test Counts
    console.log('\n📝 TEST COUNTS:');
    console.log(`  Unit Tests:        ${metrics.testCounts.unit}`);
    console.log(`  Integration Tests: ${metrics.testCounts.integration}`);
    console.log(`  E2E Tests:         ${metrics.testCounts.e2e}`);
    console.log(`  Total Tests:       ${metrics.testCounts.total}`);

    // Quality Checks
    console.log('\n✅ QUALITY CHECKS:');
    Object.entries(metrics.qualityChecks).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      const label = check
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());
      console.log(`  ${status} ${label}`);
    });

    // Recommendations
    if (metrics.recommendations.length > 0) {
      console.log('\n🎯 RECOMMENDATIONS:');
      metrics.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    } else {
      console.log(
        '\n🎉 EXCELLENT! No recommendations - your test suite is in great shape!'
      );
    }

    // Overall Assessment
    const overallScore = this.calculateOverallScore(metrics);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📈 OVERALL TEST QUALITY SCORE: ${overallScore}%`);

    if (overallScore >= 90) {
      console.log('🏆 EXCELLENT - Production ready test suite!');
    } else if (overallScore >= 80) {
      console.log('👍 GOOD - Minor improvements needed');
    } else if (overallScore >= 70) {
      console.log('⚠️  FAIR - Several improvements needed');
    } else {
      console.log('🔧 NEEDS WORK - Significant improvements required');
    }

    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(metrics: TestQualityMetrics): number {
    const coverageScore =
      (metrics.coverage.statements +
        metrics.coverage.branches +
        metrics.coverage.functions +
        metrics.coverage.lines) /
      4;

    const qualityScore =
      (Object.values(metrics.qualityChecks).filter(Boolean).length /
        Object.values(metrics.qualityChecks).length) *
      100;

    const testCountScore = Math.min((metrics.testCounts.total / 50) * 100, 100); // Max at 50 tests

    return Math.round(
      coverageScore * 0.5 + qualityScore * 0.3 + testCountScore * 0.2
    );
  }
}

// Export for use in scripts
export default TestQualityValidator;

// CLI usage
if (require.main === module) {
  const validator = new TestQualityValidator();
  validator.validateTestQuality().catch(console.error);
}
