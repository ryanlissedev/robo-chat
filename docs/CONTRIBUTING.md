# 🤝 Contributing Guide

## Welcome Contributors!

We're excited you're interested in contributing to RoboChat! This guide will help you get started with contributing to our project. Whether you're fixing bugs, adding features, or improving documentation, your contributions are valuable.

## Code of Conduct

### Our Standards

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome diverse perspectives and experiences
- **Be Constructive**: Provide helpful feedback and accept criticism gracefully
- **Be Professional**: Focus on what's best for the community and project

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information
- Any conduct that could be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Development Environment**
   - Node.js v20.0.0+
   - Git
   - VS Code (recommended)
   - GitHub account

2. **Project Knowledge**
   - Read the [README](../README.md)
   - Review [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Understand our [DEVELOPMENT.md](./DEVELOPMENT.md)

### First-Time Setup

```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR_USERNAME/robo-chat.git
cd robo-chat

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/robo-chat.git

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Configure your environment variables

# Run tests to verify setup
pnpm test
```

## Contribution Workflow

### 1. Find an Issue

#### Good First Issues

Look for issues labeled:

- `good first issue` - Perfect for beginners
- `help wanted` - We need help with these
- `documentation` - Documentation improvements
- `bug` - Bug fixes needed

#### Creating Issues

If you find a bug or have a feature idea:

```markdown
## Bug Report Template

**Description**
Clear description of the bug

**Steps to Reproduce**

1. Go to...
2. Click on...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**

- OS: [e.g., macOS 14]
- Node: [e.g., 20.0.0]
- Browser: [e.g., Chrome 120]

**Screenshots**
If applicable
```

### 2. Create a Branch

```bash
# Update your fork
git checkout main
git pull upstream main
git push origin main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

#### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### 3. Make Changes

#### Code Style

Follow our TypeScript and React conventions:

```typescript
// ✅ Good: Clear interfaces
interface UserData {
  id: string
  email: string
  name?: string
}

// ✅ Good: Functional components
export function UserProfile({ user }: { user: UserData }) {
  return <div>{user.name || user.email}</div>
}

// ✅ Good: Custom hooks
function useUserData(userId: string) {
  const [data, setData] = useState<UserData | null>(null)
  // ... hook logic
  return data
}

// ❌ Bad: Using any
const data: any = fetchData()

// ❌ Bad: No types
function processUser(user) {
  return user.name
}
```

#### Commit Messages

Follow conventional commits:

```bash
# Format: <type>(<scope>): <subject>

# Examples:
git commit -m "feat(chat): add file upload support"
git commit -m "fix(auth): resolve session timeout issue"
git commit -m "docs(api): update endpoint documentation"
git commit -m "test(chat): add streaming response tests"
git commit -m "refactor(ui): simplify message component"
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Testing
- `chore`: Maintenance

### 4. Test Your Changes

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test -- chat

# Check types
pnpm run type-check

# Lint code
pnpm run lint

# Format code
pnpm run format

# Build project
pnpm run build
```

#### Writing Tests

Add tests for new features:

```typescript
// Example test for new feature
describe("NewFeature", () => {
  it("should work correctly", () => {
    const result = newFeature(input);
    expect(result).toBe(expected);
  });

  it("should handle edge cases", () => {
    const result = newFeature(edgeCase);
    expect(result).toBeDefined();
  });
});
```

### 5. Submit Pull Request

#### PR Checklist

Before submitting:

- [ ] Tests pass (`pnpm test`)
- [ ] Code is linted (`pnpm run lint`)
- [ ] Types are correct (`pnpm run type-check`)
- [ ] Documentation updated
- [ ] Commits are clean
- [ ] Branch is up-to-date

#### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings

## Screenshots

If applicable

## Related Issues

Fixes #123
```

### 6. Code Review Process

#### What to Expect

1. **Automated Checks**
   - CI/CD runs tests
   - Linting verification
   - Type checking
   - Build verification

2. **Human Review**
   - Code quality review
   - Architecture alignment
   - Performance considerations
   - Security review

3. **Feedback**
   - Constructive suggestions
   - Required changes
   - Optional improvements

#### Responding to Feedback

```bash
# Make requested changes
git add .
git commit -m "address review feedback"

# Update PR
git push origin your-branch
```

## Development Guidelines

### Component Development

#### Creating New Components

```typescript
// app/components/feature/new-component.tsx
'use client'

import { type FC } from 'react'
import { cn } from '@/lib/utils'

interface NewComponentProps {
  title: string
  className?: string
}

/**
 * NewComponent displays...
 * @param title - The title to display
 * @param className - Optional CSS classes
 */
export const NewComponent: FC<NewComponentProps> = ({
  title,
  className
}) => {
  return (
    <div className={cn('base-styles', className)}>
      <h2>{title}</h2>
    </div>
  )
}
```

#### Adding Hooks

```typescript
// app/hooks/use-feature.ts
import { useState, useEffect } from "react";

export function useFeature(param: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hook logic
  }, [param]);

  return { data, loading };
}
```

### API Development

#### Creating Endpoints

```typescript
// app/api/feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";

const schema = z.object({
  field: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate input
    const body = await request.json();
    const data = schema.parse(body);

    // Process request
    const result = await processFeature(data);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### Database Changes

#### Adding Migrations

```sql
-- migrations/add_feature_table.sql

-- Create new table
CREATE TABLE features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own features"
    ON features
    FOR ALL
    USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_features_user_id ON features(user_id);
```

## Documentation

### When to Update Docs

Update documentation when you:

- Add new features
- Change APIs
- Modify configuration
- Update dependencies
- Change workflows

### Documentation Standards

```markdown
# Feature Name

## Overview

Brief description of the feature

## Usage

How to use the feature with examples

## API Reference

Detailed API documentation

## Configuration

Configuration options

## Examples

Code examples

## Troubleshooting

Common issues and solutions
```

## Release Process

### Version Numbering

We follow Semantic Versioning:

- **MAJOR.MINOR.PATCH**
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### Release Checklist

1. **Pre-Release**
   - [ ] All tests passing
   - [ ] Documentation updated
   - [ ] CHANGELOG updated
   - [ ] Version bumped

2. **Release**
   - [ ] Create release branch
   - [ ] Tag release
   - [ ] Build artifacts
   - [ ] Deploy to staging

3. **Post-Release**
   - [ ] Verify deployment
   - [ ] Update release notes
   - [ ] Announce release

## Getting Help

### Resources

- **Documentation**: Check our docs first
- **Issues**: Search existing issues
- **Discussions**: Ask in GitHub Discussions
- **Discord**: Join our community

### Asking Questions

When asking for help:

1. Search existing issues/discussions
2. Provide context and examples
3. Include error messages
4. Specify your environment

## Recognition

### Contributors

We recognize contributors in:

- README.md contributors section
- Release notes
- Project website

### Types of Contributions

We value all contributions:

- 💻 Code contributions
- 📖 Documentation improvements
- 🐛 Bug reports
- 💡 Feature suggestions
- 🎨 Design improvements
- ✅ Testing
- 👀 Code reviews
- 💬 Community support

## Legal

### License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

### Copyright

You retain copyright of your contributions while granting the project a license to use them.

## Thank You!

Your contributions make RoboChat better for everyone. We appreciate your time and effort in improving our project!

---

**Questions?** Feel free to open an issue or reach out to the maintainers.
