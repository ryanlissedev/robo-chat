#!/usr/bin/env node

/**
 * Script to help refactor model configuration references
 * This script will help identify and replace the remaining references
 */

const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'app/api/chat/route.ts');

function refactorModelConfigReferences() {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace remaining references
  const replacements = [
    // Replace standalone isGPT5Model references
    {
      from: /(?<!modelConfiguration\.)isGPT5Model(?!\w)/g,
      to: 'modelConfiguration.isGPT5Model',
    },
    // Replace standalone modelSupportsFileSearchTools references
    {
      from: /(?<!modelConfiguration\.)modelSupportsFileSearchTools(?!\w)/g,
      to: 'modelConfiguration.modelSupportsFileSearchTools',
    },
    // Replace standalone isReasoningCapable references
    {
      from: /(?<!modelConfiguration\.)isReasoningCapable(?!\w)/g,
      to: 'modelConfiguration.isReasoningCapable',
    },
    // Replace modelConfig references
    {
      from: /(?<!modelConfiguration\.)modelConfig(?!\w)/g,
      to: 'modelConfiguration.modelConfig',
    },
  ];

  let changesMade = 0;

  replacements.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      changesMade += matches.length;
    }
  });

  if (changesMade > 0) {
    fs.writeFileSync(filePath, content);
  } else {
  }
}

refactorModelConfigReferences();
