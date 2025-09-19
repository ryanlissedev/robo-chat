#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes bundle size and identifies optimization opportunities
 */

const fs = require('fs');
const path = require('path');

const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB
const VERY_LARGE_FILE_THRESHOLD = 500 * 1024; // 500KB

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function analyzeDirectory(dirPath, extensions = ['.js', '.ts', '.tsx', '.jsx']) {
  const results = [];

  function scanDir(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            const size = stat.size;
            const relativePath = path.relative(process.cwd(), fullPath);

            results.push({
              path: relativePath,
              size,
              sizeKB: Math.round(size / 1024),
              extension: ext
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan ${currentPath}:`, error.message);
    }
  }

  scanDir(dirPath);
  return results;
}

function generateReport() {
  console.log('🔍 Analyzing bundle size and file structure...\n');

  const projectRoot = process.cwd();
  const files = analyzeDirectory(projectRoot);

  // Sort by size (largest first)
  files.sort((a, b) => b.size - a.size);

  // Categorize files
  const largeFiles = files.filter(f => f.size >= LARGE_FILE_THRESHOLD);
  const veryLargeFiles = files.filter(f => f.size >= VERY_LARGE_FILE_THRESHOLD);

  // Calculate totals by directory
  const directoryTotals = {};
  files.forEach(file => {
    const dir = path.dirname(file.path);
    if (!directoryTotals[dir]) {
      directoryTotals[dir] = { size: 0, files: 0 };
    }
    directoryTotals[dir].size += file.size;
    directoryTotals[dir].files += 1;
  });

  // Sort directories by total size
  const sortedDirs = Object.entries(directoryTotals)
    .map(([dir, data]) => ({ dir, ...data, sizeKB: Math.round(data.size / 1024) }))
    .sort((a, b) => b.size - a.size);

  console.log('📊 BUNDLE SIZE ANALYSIS REPORT');
  console.log('=====================================\n');

  // Very large files (potential candidates for optimization)
  if (veryLargeFiles.length > 0) {
    console.log('🔴 VERY LARGE FILES (>500KB):');
    veryLargeFiles.slice(0, 10).forEach(file => {
      console.log(`  ${file.sizeKB}KB - ${file.path}`);
    });
    console.log('');
  }

  // Large files
  if (largeFiles.length > 0) {
    console.log('🟡 LARGE FILES (>100KB):');
    largeFiles.slice(0, 15).forEach(file => {
      console.log(`  ${file.sizeKB}KB - ${file.path}`);
    });
    console.log('');
  }

  // Directory analysis
  console.log('📁 LARGEST DIRECTORIES:');
  sortedDirs.slice(0, 10).forEach(({ dir, sizeKB, files }) => {
    console.log(`  ${sizeKB}KB (${files} files) - ${dir}`);
  });
  console.log('');

  // Extension analysis
  const extensionTotals = {};
  files.forEach(file => {
    const ext = file.extension;
    if (!extensionTotals[ext]) {
      extensionTotals[ext] = { size: 0, files: 0 };
    }
    extensionTotals[ext].size += file.size;
    extensionTotals[ext].files += 1;
  });

  console.log('📄 BY FILE TYPE:');
  Object.entries(extensionTotals)
    .map(([ext, data]) => ({ ext, ...data, sizeKB: Math.round(data.size / 1024) }))
    .sort((a, b) => b.size - a.size)
    .forEach(({ ext, sizeKB, files }) => {
      console.log(`  ${ext}: ${sizeKB}KB (${files} files)`);
    });
  console.log('');

  // Optimization recommendations
  console.log('💡 OPTIMIZATION RECOMMENDATIONS:');

  if (veryLargeFiles.length > 0) {
    console.log('  🎯 HIGH PRIORITY:');
    console.log('    - Consider code splitting for files >500KB');
    console.log('    - Review data files that can be loaded dynamically');
    console.log('    - Check for large JSON configurations');
  }

  if (largeFiles.length > 5) {
    console.log('  🔄 MEDIUM PRIORITY:');
    console.log('    - Implement lazy loading for large components');
    console.log('    - Review import statements for unnecessary dependencies');
    console.log('    - Consider tree shaking opportunities');
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeKB = Math.round(totalSize / 1024);
  const totalSizeMB = Math.round(totalSize / (1024 * 1024));

  console.log('\n📈 SUMMARY:');
  console.log(`  Total analyzed: ${files.length} files`);
  console.log(`  Total size: ${totalSizeMB}MB (${totalSizeKB}KB)`);
  console.log(`  Large files (>100KB): ${largeFiles.length}`);
  console.log(`  Very large files (>500KB): ${veryLargeFiles.length}`);

  // Generate package.json script suggestion
  console.log('\n🔧 NEXT STEPS:');
  console.log('  1. Run: npm run build');
  console.log('  2. Analyze built bundle: npx @next/bundle-analyzer');
  console.log('  3. Review large files identified above');
  console.log('  4. Implement lazy loading for largest components');

  return {
    totalFiles: files.length,
    totalSize,
    largeFiles: largeFiles.length,
    veryLargeFiles: veryLargeFiles.length,
    recommendations: {
      needsCodeSplitting: veryLargeFiles.length > 0,
      needsLazyLoading: largeFiles.length > 5,
      potentialSavings: veryLargeFiles.reduce((sum, f) => sum + f.size, 0)
    }
  };
}

if (require.main === module) {
  try {
    generateReport();
  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
    process.exit(1);
  }
}

module.exports = { generateReport, analyzeDirectory };