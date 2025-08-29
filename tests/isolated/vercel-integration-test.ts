#!/usr/bin/env node

/**
 * Vercel Integration Test
 * 
 * This script tests integration with Vercel CLI and AI Gateway deployment.
 * It can help verify that the gateway is properly deployed and accessible.
 * 
 * Usage:
 *   npx tsx tests/isolated/vercel-integration-test.ts
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class VercelIntegrationTester {
  
  async checkVercelCLI(): Promise<boolean> {
    try {
      const version = execSync('vercel --version', { encoding: 'utf-8' }).trim();
      log(`✅ Vercel CLI found: ${version}`, 'green');
      return true;
    } catch (error) {
      log('❌ Vercel CLI not found. Install with: npm i -g vercel', 'red');
      return false;
    }
  }

  async checkVercelAuth(): Promise<boolean> {
    try {
      const whoami = execSync('vercel whoami', { encoding: 'utf-8' }).trim();
      log(`✅ Logged in as: ${whoami}`, 'green');
      return true;
    } catch (error) {
      log('❌ Not logged in to Vercel. Run: vercel login', 'red');
      return false;
    }
  }

  async checkProjectConfig(): Promise<boolean> {
    if (existsSync('vercel.json')) {
      log('✅ vercel.json found', 'green');
      return true;
    } else {
      log('⚠️  No vercel.json found. This is optional for Next.js projects.', 'yellow');
      return true;
    }
  }

  async checkEnvironmentVariables(): Promise<void> {
    log('\n🔍 Checking Environment Variables', 'bold');
    
    try {
      const envOutput = execSync('vercel env ls', { encoding: 'utf-8' });
      log('Environment variables:', 'blue');
      console.log(envOutput);
    } catch (error) {
      log('❌ Could not list environment variables. Make sure you have a Vercel project.', 'red');
      log('   Run: vercel link', 'yellow');
    }
  }

  async testGatewayDeployment(): Promise<void> {
    log('\n🚀 Testing Gateway Deployment', 'bold');
    
    // Check if we have a deployment URL
    const gatewayUrl = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1/ai';
    
    try {
      const response = await fetch(`${gatewayUrl}/health`);
      if (response.ok) {
        log(`✅ Gateway health check passed: ${gatewayUrl}`, 'green');
      } else {
        log(`⚠️  Gateway responded with status: ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`❌ Gateway health check failed: ${error.message}`, 'red');
      log('   This might be expected if using a custom gateway deployment.', 'yellow');
    }
  }

  async suggestDeploymentSteps(): void {
    log('\n📋 Deployment Steps for AI Gateway', 'bold');
    log('=' .repeat(50), 'cyan');
    
    log('1. Install Vercel CLI:', 'blue');
    log('   npm i -g vercel', 'cyan');
    
    log('\n2. Login to Vercel:', 'blue');
    log('   vercel login', 'cyan');
    
    log('\n3. Link your project:', 'blue');
    log('   vercel link', 'cyan');
    
    log('\n4. Set environment variables:', 'blue');
    log('   vercel env add OPENAI_API_KEY', 'cyan');
    log('   vercel env add AI_GATEWAY_API_KEY', 'cyan');
    
    log('\n5. Deploy:', 'blue');
    log('   vercel --prod', 'cyan');
    
    log('\n6. Test your deployment:', 'blue');
    log('   npm run test:gateway-live', 'cyan');
  }

  async runDiagnostics(): Promise<void> {
    log('🔧 Vercel Integration Diagnostics', 'bold');
    log('=' .repeat(50), 'cyan');
    
    const cliInstalled = await this.checkVercelCLI();
    if (!cliInstalled) {
      this.suggestDeploymentSteps();
      return;
    }
    
    const authenticated = await this.checkVercelAuth();
    if (!authenticated) {
      log('\n💡 Next steps:', 'yellow');
      log('   1. Run: vercel login', 'cyan');
      log('   2. Run this test again', 'cyan');
      return;
    }
    
    await this.checkProjectConfig();
    await this.checkEnvironmentVariables();
    await this.testGatewayDeployment();
    
    log('\n✅ Vercel integration check complete!', 'green');
    log('💡 To deploy your AI gateway:', 'blue');
    log('   vercel --prod', 'cyan');
  }
}

async function main() {
  const tester = new VercelIntegrationTester();
  await tester.runDiagnostics();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n💥 Error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { VercelIntegrationTester };
