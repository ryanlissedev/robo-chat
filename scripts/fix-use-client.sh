#!/bin/bash

# Find all .tsx files with the problematic pattern and fix them
find . -name "*.tsx" -type f | while read -r file; do
  # Check if file has the problematic pattern
  if grep -q "^import.*\n'use client';" "$file" 2>/dev/null; then
    echo "Fixing: $file"
    # Use a temporary file for the replacement
    perl -i -pe "s/^import React from 'react';\n'use client';/'use client';\n\nimport React from 'react';/g" "$file"
    perl -i -pe "s/^import ([^;]+);\n'use client';/'use client';\n\nimport \1;/g" "$file"
  fi
done

echo "Done fixing 'use client' directives"