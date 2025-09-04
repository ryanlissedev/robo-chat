#!/usr/bin/env tsx

/**
 * Production Readiness Validation Script
 * Comprehensive validation suite for production deployment
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { TestQualityValidator } from '../validation/test-quality-validator';

const execAsync = promisify(exec);

interface ProductionReadinessReport {
  testQuality: any;
  securityChecks: SecurityChecks;
  performanceChecks: PerformanceChecks;
  buildValidation: BuildValidation;
  deploymentChecks: DeploymentChecks;
  overallReadiness: number;
  criticalIssues: string[];
  recommendations: string[];
}

interface SecurityChecks {
  noHardcodedSecrets: boolean;
  noConsoleLogsInProduction: boolean;
  noDebugCode: boolean;
  sanitizationPresent: boolean;
  authenticationImplemented: boolean;
}

interface PerformanceChecks {
  bundleSizeOptimal: boolean;
  imagesOptimized: boolean;
  cacheImplemented: boolean;
  loadTimeAcceptable: boolean;
  memoryUsageOptimal: boolean;
}

interface BuildValidation {
  buildSucceeds: boolean;
  noTypeErrors: boolean;
  noLintErrors: boolean;
  testsPass: boolean;
  coverageThresholdMet: boolean;
}

interface DeploymentChecks {
  environmentVariablesDocumented: boolean;
  healthCheckEndpoint: boolean;
  errorHandlingPresent: boolean;
  loggingImplemented: boolean;
  gracefulShutdown: boolean;
}

class ProductionReadinessValidator {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async validateProductionReadiness(): Promise<ProductionReadinessReport> {
    console.log('🚀 Starting Production Readiness Validation...\n');

    const testValidator = new TestQualityValidator(this.projectRoot);

    const [
      testQuality,
      securityChecks,
      performanceChecks,
      buildValidation,
      deploymentChecks,
    ] = await Promise.all([
      testValidator.validateTestQuality(),
      this.performSecurityChecks(),
      this.performPerformanceChecks(),
      this.validateBuild(),
      this.performDeploymentChecks(),
    ]);

    const criticalIssues = this.identifyCriticalIssues({
      testQuality,
      securityChecks,
      performanceChecks,
      buildValidation,
      deploymentChecks,
    } as any);

    const recommendations = this.generateRecommendations({
      testQuality,
      securityChecks,
      performanceChecks,
      buildValidation,
      deploymentChecks,
    } as any);

    const overallReadiness = this.calculateOverallReadiness({
      testQuality,
      securityChecks,
      performanceChecks,
      buildValidation,
      deploymentChecks,
    } as any);

    const report: ProductionReadinessReport = {
      testQuality,
      securityChecks,
      performanceChecks,
      buildValidation,
      deploymentChecks,
      overallReadiness,
      criticalIssues,
      recommendations,
    };

    this.generateReport(report);
    return report;
  }

  private async performSecurityChecks(): Promise<SecurityChecks> {
    console.log('🔒 Performing security checks...');

    const sourceFiles = this.findSourceFiles();

    return {
      noHardcodedSecrets: this.checkForHardcodedSecrets(sourceFiles),
      noConsoleLogsInProduction:
        this.checkForConsoleLogsInProduction(sourceFiles),
      noDebugCode: this.checkForDebugCode(sourceFiles),
      sanitizationPresent: this.checkForSanitization(sourceFiles),
      authenticationImplemented: this.checkForAuthentication(sourceFiles),
    };
  }

  private async performPerformanceChecks(): Promise<PerformanceChecks> {
    console.log('⚡ Performing performance checks...');

    return {
      bundleSizeOptimal: await this.checkBundleSize(),
      imagesOptimized: this.checkImageOptimization(),
      cacheImplemented: this.checkCacheImplementation(),
      loadTimeAcceptable: await this.checkLoadTime(),
      memoryUsageOptimal: await this.checkMemoryUsage(),
    };
  }

  private async validateBuild(): Promise<BuildValidation> {
    console.log('🔨 Validating build process...');

    const results = await Promise.allSettled([
      this.runBuild(),
      this.runTypeCheck(),
      this.runLinter(),
      this.runTests(),
      this.checkCoverageThreshold(),
    ]);

    return {
      buildSucceeds: results[0].status === 'fulfilled',
      noTypeErrors: results[1].status === 'fulfilled',
      noLintErrors: results[2].status === 'fulfilled',
      testsPass: results[3].status === 'fulfilled',
      coverageThresholdMet: results[4].status === 'fulfilled',
    };
  }

  private async performDeploymentChecks(): Promise<DeploymentChecks> {
    console.log('🚢 Performing deployment checks...');

    return {
      environmentVariablesDocumented: this.checkEnvironmentDocumentation(),
      healthCheckEndpoint: this.checkHealthEndpoint(),
      errorHandlingPresent: this.checkErrorHandling(),
      loggingImplemented: this.checkLogging(),
      gracefulShutdown: this.checkGracefulShutdown(),
    };
  }

  private findSourceFiles(): string[] {
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    const sourceDirs = ['app', 'components', 'lib', 'pages', 'src'];
    const files: string[] = [];

    for (const dir of sourceDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        files.push(...this.findFilesRecursive(fullPath, sourceExtensions));
      }
    }

    return files;
  }

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

  // Security check implementations
  private checkForHardcodedSecrets(files: string[]): boolean {
    const secretPatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /sk_[a-zA-Z0-9]{48}/,
      /pk_[a-zA-Z0-9]{24}/,
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of secretPatterns) {
          if (pattern.test(content) && !content.includes('process.env')) {
            return false; // Found hardcoded secret
          }
        }
      } catch (_error) {}
    }

    return true;
  }

  private checkForConsoleLogsInProduction(files: string[]): boolean {
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        // Skip test files
        if (
          file.includes('.test.') ||
          file.includes('.spec.') ||
          file.includes('/tests/')
        ) {
          continue;
        }
        if (
          content.includes('console.log') ||
          content.includes('console.warn') ||
          content.includes('console.error')
        ) {
          return false;
        }
      } catch (_error) {}
    }

    return true;
  }

  private checkForDebugCode(files: string[]): boolean {
    const debugPatterns = [/debugger;?/, /TODO:|FIXME:/, /\bdebug\s*=\s*true/i];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of debugPatterns) {
          if (pattern.test(content)) {
            return false;
          }
        }
      } catch (_error) {}
    }

    return true;
  }

  private checkForSanitization(files: string[]): boolean {
    const sanitizationKeywords = [
      'sanitize',
      'escape',
      'validate',
      'DOMPurify',
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (sanitizationKeywords.some((keyword) => content.includes(keyword))) {
          return true;
        }
      } catch (_error) {}
    }

    return false;
  }

  private checkForAuthentication(files: string[]): boolean {
    const authKeywords = ['auth', 'login', 'authenticate', 'jwt', 'session'];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (
          authKeywords.some((keyword) =>
            content.toLowerCase().includes(keyword)
          )
        ) {
          return true;
        }
      } catch (_error) {}
    }

    return false;
  }

  // Performance check implementations
  private async checkBundleSize(): Promise<boolean> {
    try {
      await execAsync('npm run build', { cwd: this.projectRoot });

      const buildDir = path.join(this.projectRoot, '.next', 'static', 'chunks');
      if (fs.existsSync(buildDir)) {
        const files = fs.readdirSync(buildDir);
        const jsFiles = files.filter((f) => f.endsWith('.js'));

        for (const file of jsFiles) {
          const filePath = path.join(buildDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size > 1024 * 1024) {
            // 1MB threshold
            return false;
          }
        }
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  private checkImageOptimization(): boolean {
    const publicDir = path.join(this.projectRoot, 'public');
    if (!fs.existsSync(publicDir)) {
      return true; // No images to check
    }

    const imageFiles = this.findFilesRecursive(publicDir, [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
    ]);

    for (const file of imageFiles) {
      const stats = fs.statSync(file);
      if (stats.size > 500 * 1024) {
        // 500KB threshold
        return false;
      }
    }

    return true;
  }

  private checkCacheImplementation(): boolean {
    const files = this.findSourceFiles();
    const cacheKeywords = ['cache', 'redis', 'memory', 'swr', 'react-query'];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (
          cacheKeywords.some((keyword) =>
            content.toLowerCase().includes(keyword)
          )
        ) {
          return true;
        }
      } catch (_error) {}
    }

    return false;
  }

  private async checkLoadTime(): Promise<boolean> {
    // This would typically involve running Lighthouse or similar tools
    // For now, we'll check for performance optimizations in the code
    const files = this.findSourceFiles();
    const perfKeywords = [
      'lazy',
      'dynamic',
      'Suspense',
      'memo',
      'useMemo',
      'useCallback',
    ];

    let foundOptimizations = 0;
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (perfKeywords.some((keyword) => content.includes(keyword))) {
          foundOptimizations++;
        }
      } catch (_error) {}
    }

    return foundOptimizations >= 3; // At least 3 files with performance optimizations
  }

  private async checkMemoryUsage(): Promise<boolean> {
    // Check for potential memory leaks in the code
    const files = this.findSourceFiles();
    const memoryLeakPatterns = [
      /setInterval.*(?!clearInterval)/,
      /setTimeout.*(?!clearTimeout)/,
      /addEventListener.*(?!removeEventListener)/,
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of memoryLeakPatterns) {
          if (pattern.test(content)) {
            return false; // Potential memory leak found
          }
        }
      } catch (_error) {}
    }

    return true;
  }

  // Build validation implementations
  private async runBuild(): Promise<void> {
    await execAsync('npm run build', { cwd: this.projectRoot });
  }

  private async runTypeCheck(): Promise<void> {
    await execAsync('npm run typecheck', { cwd: this.projectRoot });
  }

  private async runLinter(): Promise<void> {
    await execAsync('npm run lint', { cwd: this.projectRoot });
  }

  private async runTests(): Promise<void> {
    await execAsync('npm run test:run', { cwd: this.projectRoot });
  }

  private async checkCoverageThreshold(): Promise<void> {
    await execAsync('npm run test:coverage', { cwd: this.projectRoot });
  }

  // Deployment check implementations
  private checkEnvironmentDocumentation(): boolean {
    const envFiles = ['.env.example', '.env.template', 'README.md', 'SETUP.md'];
    return envFiles.some((file) =>
      fs.existsSync(path.join(this.projectRoot, file))
    );
  }

  private checkHealthEndpoint(): boolean {
    const healthFiles = this.findSourceFiles().filter(
      (f) => f.includes('health') || f.includes('ping') || f.includes('status')
    );
    return healthFiles.length > 0;
  }

  private checkErrorHandling(): boolean {
    const files = this.findSourceFiles();
    let errorHandlingCount = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('try') && content.includes('catch')) {
          errorHandlingCount++;
        }
      } catch (_error) {}
    }

    return errorHandlingCount >= files.length * 0.3; // At least 30% of files have error handling
  }

  private checkLogging(): boolean {
    const files = this.findSourceFiles();
    const loggingKeywords = [
      'winston',
      'pino',
      'bunyan',
      'console.info',
      'logger',
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (loggingKeywords.some((keyword) => content.includes(keyword))) {
          return true;
        }
      } catch (_error) {}
    }

    return false;
  }

  private checkGracefulShutdown(): boolean {
    const files = this.findSourceFiles();
    const shutdownKeywords = [
      'SIGTERM',
      'SIGINT',
      'graceful',
      'shutdown',
      'close',
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (shutdownKeywords.some((keyword) => content.includes(keyword))) {
          return true;
        }
      } catch (_error) {}
    }

    return false;
  }

  private identifyCriticalIssues(report: any): string[] {
    const issues: string[] = [];

    // Test quality critical issues
    if (report.testQuality.coverage.statements < 80) {
      issues.push('🚨 CRITICAL: Test coverage below 80%');
    }

    // Security critical issues
    if (!report.securityChecks.noHardcodedSecrets) {
      issues.push('🚨 CRITICAL: Hardcoded secrets detected');
    }
    if (!report.securityChecks.authenticationImplemented) {
      issues.push('🚨 CRITICAL: No authentication system found');
    }

    // Build critical issues
    if (!report.buildValidation.buildSucceeds) {
      issues.push('🚨 CRITICAL: Build process fails');
    }
    if (!report.buildValidation.testsPass) {
      issues.push('🚨 CRITICAL: Tests are failing');
    }

    // Performance critical issues
    if (!report.performanceChecks.bundleSizeOptimal) {
      issues.push('🚨 CRITICAL: Bundle size too large (>1MB)');
    }

    return issues;
  }

  private generateRecommendations(report: any): string[] {
    const recommendations: string[] = [];

    // Add test quality recommendations
    recommendations.push(...report.testQuality.recommendations);

    // Security recommendations
    if (!report.securityChecks.sanitizationPresent) {
      recommendations.push(
        '🔒 Implement input sanitization for all user inputs'
      );
    }
    if (!report.securityChecks.noConsoleLogsInProduction) {
      recommendations.push(
        '🔒 Remove console.log statements from production code'
      );
    }

    // Performance recommendations
    if (!report.performanceChecks.cacheImplemented) {
      recommendations.push(
        '⚡ Implement caching strategy (Redis, in-memory, or client-side)'
      );
    }
    if (!report.performanceChecks.imagesOptimized) {
      recommendations.push(
        '⚡ Optimize image sizes (use WebP, compress large images)'
      );
    }

    // Deployment recommendations
    if (!report.deploymentChecks.healthCheckEndpoint) {
      recommendations.push('🚢 Add health check endpoint for monitoring');
    }
    if (!report.deploymentChecks.loggingImplemented) {
      recommendations.push(
        '🚢 Implement structured logging for production monitoring'
      );
    }

    return recommendations;
  }

  private calculateOverallReadiness(report: any): number {
    const weights = {
      testQuality: 0.3,
      security: 0.25,
      performance: 0.2,
      build: 0.15,
      deployment: 0.1,
    };

    // Calculate scores for each category
    const testScore = Math.min(
      (report.testQuality.coverage.statements +
        report.testQuality.coverage.branches +
        report.testQuality.coverage.functions) /
        3,
      100
    );

    const securityScore =
      (Object.values(report.securityChecks).filter(Boolean).length /
        Object.values(report.securityChecks).length) *
      100;

    const performanceScore =
      (Object.values(report.performanceChecks).filter(Boolean).length /
        Object.values(report.performanceChecks).length) *
      100;

    const buildScore =
      (Object.values(report.buildValidation).filter(Boolean).length /
        Object.values(report.buildValidation).length) *
      100;

    const deploymentScore =
      (Object.values(report.deploymentChecks).filter(Boolean).length /
        Object.values(report.deploymentChecks).length) *
      100;

    const overallScore =
      testScore * weights.testQuality +
      securityScore * weights.security +
      performanceScore * weights.performance +
      buildScore * weights.build +
      deploymentScore * weights.deployment;

    return Math.round(overallScore);
  }

  private generateReport(report: ProductionReadinessReport): void {
    console.log(`\n${'='.repeat(100)}`);
    console.log('🚀 PRODUCTION READINESS VALIDATION REPORT');
    console.log('='.repeat(100));

    // Overall readiness score
    console.log(
      `\n📈 OVERALL PRODUCTION READINESS: ${report.overallReadiness}%`
    );

    if (report.overallReadiness >= 95) {
      console.log('🏆 EXCELLENT - Ready for production deployment!');
    } else if (report.overallReadiness >= 85) {
      console.log('👍 GOOD - Minor improvements recommended before deployment');
    } else if (report.overallReadiness >= 75) {
      console.log('⚠️  FAIR - Several improvements needed before production');
    } else {
      console.log(
        '🔧 NEEDS WORK - Significant improvements required for production'
      );
    }

    // Critical issues
    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES (MUST FIX BEFORE DEPLOYMENT):');
      report.criticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    // Security summary
    console.log('\n🔒 SECURITY CHECKS:');
    Object.entries(report.securityChecks).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      const label = check
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());
      console.log(`  ${status} ${label}`);
    });

    // Performance summary
    console.log('\n⚡ PERFORMANCE CHECKS:');
    Object.entries(report.performanceChecks).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      const label = check
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());
      console.log(`  ${status} ${label}`);
    });

    // Build validation summary
    console.log('\n🔨 BUILD VALIDATION:');
    Object.entries(report.buildValidation).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      const label = check
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());
      console.log(`  ${status} ${label}`);
    });

    // Deployment checks summary
    console.log('\n🚢 DEPLOYMENT CHECKS:');
    Object.entries(report.deploymentChecks).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      const label = check
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());
      console.log(`  ${status} ${label}`);
    });

    // All recommendations
    if (report.recommendations.length > 0) {
      console.log('\n🎯 ALL RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log(`\n${'='.repeat(100)}`);

    if (report.criticalIssues.length === 0 && report.overallReadiness >= 85) {
      console.log(
        '🎉 CONGRATULATIONS! Your application is ready for production deployment!'
      );
    } else {
      console.log(
        '🔧 Please address the issues above before deploying to production.'
      );
    }

    console.log(`${'='.repeat(100)}\n`);

    // Save report to file
    const reportPath = path.join(
      this.projectRoot,
      'production-readiness-report.json'
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: ${reportPath}`);
  }
}

// CLI usage
if (require.main === module) {
  const validator = new ProductionReadinessValidator();
  validator
    .validateProductionReadiness()
    .then((report) => {
      process.exit(
        report.criticalIssues.length === 0 && report.overallReadiness >= 85
          ? 0
          : 1
      );
    })
    .catch((error) => {
      console.error('❌ Production readiness validation failed:', error);
      process.exit(1);
    });
}

export { ProductionReadinessValidator };
