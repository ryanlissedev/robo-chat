#!/bin/bash

# Update imports from @/app/components to @/components/app
echo "Updating component imports..."

# Get list of files to update (excluding backups and node_modules)
files=$(grep -r "from ['\"]@/app/components" \
  --include="*.tsx" \
  --include="*.ts" \
  --include="*.jsx" \
  --include="*.js" \
  --exclude-dir=".conductor" \
  --exclude-dir="node_modules" \
  --exclude-dir=".next" \
  --exclude-dir="dist" \
  | cut -d: -f1 | sort -u)

# Update each file
for file in $files; do
  echo "Updating: $file"
  # Use sed to replace the import paths
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS version
    sed -i '' "s|from '@/app/components|from '@/components/app|g" "$file"
    sed -i '' 's|from "@/app/components|from "@/components/app|g' "$file"
  else
    # Linux version
    sed -i "s|from '@/app/components|from '@/components/app|g" "$file"
    sed -i 's|from "@/app/components|from "@/components/app|g' "$file"
  fi
done

echo "Import updates complete!"
echo "Updated files:"
echo "$files" | wc -l