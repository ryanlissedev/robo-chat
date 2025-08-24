# 👋 Junior Developer Onboarding Guide

## Welcome to RoboChat!

Welcome to the team! This guide will help you get up to speed with our codebase and development practices. Don't worry if everything seems overwhelming at first - we've all been there, and this guide is designed to help you learn step by step.

## Your First Day

### 1. Setup Your Development Environment

#### Install Required Tools
```bash
# Check if you have Node.js (we need v20+)
node --version

# If not installed, download from:
# https://nodejs.org/

# Check if you have Git
git --version

# If not installed:
# Mac: brew install git
# Windows: https://git-scm.com/download/win
# Linux: sudo apt-get install git
```

#### Get the Code
```bash
# Clone the repository
git clone https://github.com/[org]/robo-chat.git
cd robo-chat

# Install dependencies
npm install
```

#### Setup VS Code (Recommended)
Install these extensions for the best experience:
- **ESLint** - Catches code issues
- **Prettier** - Formats code automatically
- **TypeScript** - TypeScript support
- **Tailwind CSS IntelliSense** - CSS class suggestions
- **GitLens** - See who wrote what code
- **Error Lens** - See errors inline

### 2. Configure Your Environment

Create your local environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your keys:
```env
# Start with these minimum settings
NEXT_PUBLIC_SUPABASE_URL=ask-team-for-dev-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=ask-team-for-dev-key
OPENAI_API_KEY=your-openai-key-here
```

💡 **Tip**: Ask your team lead for the development Supabase credentials!

### 3. Run the Application

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

You should see the RoboChat login page! 🎉

## Understanding the Codebase

### Project Structure - What Goes Where

```
robo-chat/
├── app/                    # 🏠 Main application code
│   ├── api/               # 🔌 Backend API endpoints
│   ├── components/        # 🧩 React components (UI pieces)
│   ├── hooks/             # 🪝 Custom React hooks
│   └── types/             # 📝 TypeScript type definitions
├── lib/                    # 📚 Shared utilities and helpers
├── public/                 # 🌐 Static files (images, fonts)
├── tests/                  # 🧪 Test files
└── docs/                   # 📖 Documentation (you are here!)
```

### Key Concepts to Understand

#### 1. React Components
Components are reusable pieces of UI. Think of them like LEGO blocks!

```typescript
// Simple component example
function WelcomeMessage({ name }: { name: string }) {
  return <h1>Welcome, {name}!</h1>
}

// Using it
<WelcomeMessage name="Alice" />
```

#### 2. TypeScript
TypeScript adds types to JavaScript, helping catch errors early.

```typescript
// JavaScript (no types)
function add(a, b) {
  return a + b
}

// TypeScript (with types)
function add(a: number, b: number): number {
  return a + b
}

// TypeScript will warn if you try:
add("hello", "world") // ❌ Error: Expected number, got string
```

#### 3. Next.js App Router
Next.js handles routing based on folder structure:
- `app/page.tsx` → Homepage (`/`)
- `app/about/page.tsx` → About page (`/about`)
- `app/api/chat/route.ts` → API endpoint (`/api/chat`)

#### 4. Async/Await
We use async/await for handling promises (operations that take time):

```typescript
// Fetching data
async function getUser(id: string) {
  const response = await fetch(`/api/users/${id}`)
  const user = await response.json()
  return user
}
```

## Your First Tasks

### Task 1: Make a Small UI Change

Let's start with something simple - change the welcome message!

1. Open `app/components/chat/welcome.tsx`
2. Find the text "How can I help you today?"
3. Change it to "What would you like to explore today?"
4. Save the file
5. Check your browser - it should update automatically!

### Task 2: Add a New Component

Create your first component:

1. Create a new file: `app/components/ui/greeting-card.tsx`

```typescript
'use client'

interface GreetingCardProps {
  name: string
  role: string
}

export function GreetingCard({ name, role }: GreetingCardProps) {
  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h3 className="text-lg font-bold">Hello, {name}!</h3>
      <p className="text-gray-600">Your role: {role}</p>
    </div>
  )
}
```

2. Use it somewhere (like in `app/page.tsx`):

```typescript
import { GreetingCard } from '@/app/components/ui/greeting-card'

// In your component
<GreetingCard name="John" role="Developer" />
```

### Task 3: Understanding API Routes

Look at a simple API route:

```typescript
// app/api/hello/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: "Hello from API!" })
}

// Visit http://localhost:3000/api/hello to see the response
```

## Common Patterns You'll See

### 1. The useState Hook
Manages component state (data that can change):

```typescript
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}
```

### 2. The useEffect Hook
Runs code when component mounts or updates:

```typescript
import { useEffect, useState } from 'react'

function Timer() {
  const [seconds, setSeconds] = useState(0)
  
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    
    return () => clearInterval(timer) // Cleanup
  }, []) // Empty array = run once
  
  return <div>Time: {seconds}s</div>
}
```

### 3. Fetching Data
Common pattern for loading data:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data)
        setLoading(false)
      })
  }, [userId])
  
  if (loading) return <div>Loading...</div>
  if (!user) return <div>User not found</div>
  
  return <div>Welcome, {user.name}!</div>
}
```

## Debugging Tips

### 1. Console Logging
The simplest debugging tool:

```typescript
console.log('Variable value:', myVariable)
console.table(arrayOfObjects) // Nice table format
console.error('Something went wrong!', error)
```

### 2. React DevTools
Install the browser extension to inspect components:
- See component props
- View component state
- Track re-renders

### 3. Network Tab
In Chrome DevTools (F12):
- See API calls
- Check request/response data
- Monitor performance

### 4. Common Errors and Solutions

#### "Cannot read property of undefined"
```typescript
// Problem
user.name // Error if user is undefined

// Solution
user?.name // Safe navigation
```

#### "Too many re-renders"
```typescript
// Problem
useEffect(() => {
  setState(value) // Causes infinite loop
}) // Missing dependency array

// Solution
useEffect(() => {
  setState(value)
}, []) // Add dependency array
```

## Getting Help

### When You're Stuck

1. **Try for 15 minutes** - Give it an honest attempt
2. **Google the error** - Someone else has had this problem
3. **Check our docs** - We might have covered it
4. **Ask the team** - We're here to help!

### How to Ask Good Questions

✅ **Good Question:**
"I'm trying to add a new button to the chat component that clears the messages. I added the button in `chat.tsx` line 45, but when I click it, I get 'setState is not a function'. Here's my code: [code snippet]. What am I missing?"

❌ **Not So Good:**
"The button doesn't work. Help!"

### Useful Resources

#### Internal
- **Team Wiki**: [Internal URL]
- **Design System**: Check `app/components/ui/`
- **API Docs**: See `docs/API_REFERENCE.md`

#### External
- **React Docs**: https://react.dev
- **Next.js Tutorial**: https://nextjs.org/learn
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **MDN Web Docs**: https://developer.mozilla.org

## Your Learning Path

### Week 1: Basics
- [ ] Complete environment setup
- [ ] Make your first UI change
- [ ] Create a simple component
- [ ] Understand project structure
- [ ] Run and write a simple test

### Week 2: Core Features
- [ ] Understand the chat flow
- [ ] Work with API routes
- [ ] Handle user input
- [ ] Display dynamic data
- [ ] Fix your first bug

### Week 3: Advanced Topics
- [ ] Work with database queries
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Optimize performance
- [ ] Deploy to staging

### Month 1: Contributing
- [ ] Complete your first feature
- [ ] Review someone's code
- [ ] Write documentation
- [ ] Help onboard the next person
- [ ] Suggest an improvement

## Code Review Checklist

Before submitting your code:

### Functionality
- [ ] Does it work as expected?
- [ ] Have you tested edge cases?
- [ ] Does it handle errors?

### Code Quality
- [ ] Is it easy to understand?
- [ ] Are variable names clear?
- [ ] Is there any duplicate code?
- [ ] Are there comments for complex parts?

### Testing
- [ ] Did you write/update tests?
- [ ] Do all tests pass?
- [ ] Did you test manually?

### Style
- [ ] Did you run the formatter? (`npm run format`)
- [ ] Did you fix linting issues? (`npm run lint`)
- [ ] Does it follow our patterns?

## Important Reminders

### Do's ✅
- Ask questions - there are no stupid questions
- Take breaks - fresh eyes catch bugs
- Write tests - they save time later
- Document your code - future you will thank you
- Learn from code reviews - they're learning opportunities

### Don'ts ❌
- Don't commit secrets/passwords
- Don't copy-paste without understanding
- Don't ignore error messages
- Don't be afraid to refactor
- Don't work in isolation

## Glossary

**API**: Application Programming Interface - how different parts of the app talk to each other

**Component**: Reusable piece of UI code

**Props**: Properties passed to components (like function arguments)

**State**: Data that can change over time in a component

**Hook**: Special functions that let you use React features (start with 'use')

**TypeScript**: JavaScript with types for better error catching

**Next.js**: The React framework we use for building the app

**Supabase**: Our database and authentication service

**Tailwind**: CSS framework for styling

**ESLint**: Tool that checks code quality

**Prettier**: Tool that formats code consistently

**Git**: Version control system for tracking changes

**npm**: Node Package Manager - manages our dependencies

**Build**: Process of converting our code for production

**Deploy**: Publishing our app to the internet

**PR (Pull Request)**: Request to merge your code changes

**CI/CD**: Automated testing and deployment

## Your Mentor

You've been assigned a mentor: **[Mentor Name]**
- Slack: @mentor
- Email: mentor@company.com
- 1-on-1s: Every Tuesday at 2pm

Don't hesitate to reach out with any questions!

## Next Steps

1. ✅ Complete this onboarding guide
2. 📝 Set up your first 1-on-1 with your mentor
3. 🎯 Pick your first ticket from the "good first issue" list
4. 🚀 Make your first contribution!

## Welcome Aboard! 🎉

You've got this! Remember, everyone started as a junior developer. Be patient with yourself, ask questions, and enjoy the learning journey.

The team is excited to have you here and can't wait to see what you'll build!

---

**Need help?** Post in #dev-help on Slack or reach out to your mentor.