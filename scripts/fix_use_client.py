#!/usr/bin/env python3
import os
import re
from pathlib import Path

def fix_use_client_in_file(filepath):
    """Fix 'use client' directive placement in a single file."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Check if file contains 'use client'
    if "'use client'" not in content:
        return False

    lines = content.split('\n')

    # Check if 'use client' is already at the top
    if lines and lines[0].strip() == "'use client';":
        return False

    # Find and remove 'use client' lines
    use_client_found = False
    new_lines = []
    for line in lines:
        if "'use client'" in line and not use_client_found:
            use_client_found = True
            continue  # Skip this line, we'll add it at the top
        new_lines.append(line)

    if not use_client_found:
        return False

    # Add 'use client' at the very top
    final_content = "'use client';\n\n" + '\n'.join(new_lines)

    # Remove any duplicate empty lines at the beginning
    final_content = re.sub(r"^'use client';\n\n+", "'use client';\n\n", final_content)

    # Write back to file
    with open(filepath, 'w') as f:
        f.write(final_content)

    print(f"Fixed: {filepath}")
    return True

def main():
    root_dir = Path('/Users/neo/Developer/experiments/HGG/robo-chat')
    fixed_count = 0

    # Find all .tsx and .ts files
    for ext in ['*.tsx', '*.ts']:
        for filepath in root_dir.rglob(ext):
            if 'node_modules' in str(filepath) or '.next' in str(filepath):
                continue

            if fix_use_client_in_file(filepath):
                fixed_count += 1

    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()