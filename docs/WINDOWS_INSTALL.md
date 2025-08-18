# Windows Installation Guide - RoboRail Assistant

> **Complete step-by-step guide for junior developers**

This guide will walk you through setting up the RoboRail Assistant on a fresh Windows machine from scratch.

```
┌─────────────────────────────────────────────────────────────┐
│                    Installation Overview                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Windows PC ──► Prerequisites ──► Clone Repo ──► Setup     │
│      │               │                │            │       │
│      │               ▼                ▼            ▼       │
│      │         ┌──────────┐    ┌──────────┐  ┌──────────┐  │
│      │         │ Node.js  │    │   Git    │  │ VS Code  │  │
│      │         │   18+    │    │ (GitHub) │  │(Optional)│  │
│      │         └──────────┘    └──────────┘  └──────────┘  │
│      │               │                │            │       │
│      │               └────────────────┼────────────┘       │
│      │                                │                    │
│      └────────────────────────────────┼────────────────────┘
│                                       │                      
│                       Environment Variables                  
│                              │                              
│                              ▼                              
│                    ┌─────────────────┐                      
│                    │ OpenAI API Key  │                      
│                    │ LangSmith (opt) │                      
│                    │ Supabase (opt)  │                      
│                    └─────────────────┘                      
│                              │                              
│                              ▼                              
│                     🚀 npm run dev                          
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- [ ] Windows 10/11 with administrative privileges
- [ ] Stable internet connection
- [ ] OpenAI API key with GPT-5 access
- [ ] Text editor (VS Code recommended)
- [ ] PowerShell or Command Prompt access

---

## 🛠️ Step 1: Install Node.js

Node.js is the JavaScript runtime that powers our application.

### 1.1 Download Node.js

1. Open your web browser
2. Go to **https://nodejs.org/**
3. Click the **LTS** (Long Term Support) version button
4. The download should start automatically

```
Browser ──► nodejs.org ──► Download LTS ──► node-v18.x.x-x64.msi
                                              │
                                              ▼
                                         Downloads Folder
```

### 1.2 Install Node.js

1. Navigate to your **Downloads** folder
2. Double-click **node-v18.x.x-x64.msi**
3. Click **Next** through the installation wizard
4. ✅ **Check "Automatically install the necessary tools"**
5. Click **Install** (requires administrator privileges)
6. Wait for installation to complete
7. Click **Finish**

```
Installation Wizard:
┌─────────────────────────────────┐
│ Node.js Setup                   │
├─────────────────────────────────┤
│ ☑ Add to PATH                  │
│ ☑ npm package manager          │
│ ☑ Install additional tools     │ ← IMPORTANT!
│                                 │
│ [Cancel] [Back] [Next] [Install]│
└─────────────────────────────────┘
```

### 1.3 Verify Installation

1. Press **Win + R**
2. Type **cmd** and press Enter
3. In the command prompt, type:

```bash
node --version
```
Expected output: `v18.17.0` (or similar)

```bash
npm --version
```
Expected output: `9.6.7` (or similar)

```
Command Prompt:
C:\Users\YourName> node --version
v18.17.0
C:\Users\YourName> npm --version
9.6.7
C:\Users\YourName> ✅ Success!
```

---

## 🔧 Step 2: Install Git

Git allows us to download and manage the project code.

### 2.1 Download Git

1. Go to **https://git-scm.com/download/win**
2. Click **64-bit Git for Windows Setup**
3. Download will start automatically

### 2.2 Install Git

1. Run the downloaded **Git-2.x.x-64-bit.exe**
2. Use these recommended settings:

```
Git Setup Configuration:
┌─────────────────────────────────────┐
│ Select Components:                  │
│ ☑ Windows Explorer integration      │
│ ☑ Git Bash Here                     │
│ ☑ Git GUI Here                      │ 
│ ☑ Associate .git* files             │
│                                     │
│ Default editor: [VS Code ▼]         │
│ Line ending: [Checkout as-is ▼]     │
│ Terminal: [Use Windows default ▼]   │
└─────────────────────────────────────┘
```

3. Click **Install** and wait for completion

### 2.3 Verify Git Installation

Open a new command prompt and run:

```bash
git --version
```
Expected output: `git version 2.x.x.windows.1`

---

## 📁 Step 3: Create Project Directory

Let's organize our workspace properly.

### 3.1 Create Workspace Folder

1. Open **File Explorer**
2. Navigate to **C:\Users\[YourUsername]**
3. Create a new folder called **Projects**
4. Inside **Projects**, create **HGG**

```
File System Structure:
C:\
├── Users\
│   └── YourUsername\
│       └── Projects\          ← Create this
│           └── HGG\           ← Create this
│               └── (project will go here)
```

### 3.2 Open Command Prompt in Project Directory

1. Navigate to **C:\Users\[YourUsername]\Projects\HGG**
2. Hold **Shift** and **right-click** in the empty space
3. Select **"Open PowerShell window here"** or **"Open command window here"**

```
PowerShell:
PS C:\Users\YourUsername\Projects\HGG> ← You should see this
```

---

## 🔄 Step 4: Clone the Repository

Now we'll download the RoboRail Assistant code.

### 4.1 Clone Command

In your PowerShell/Command Prompt, run:

```bash
git clone https://github.com/HGG-Profiling/roborail-assistant.git
```

### 4.2 Navigate to Project

```bash
cd roborail-assistant
```

Your directory structure should now look like:

```
C:\Users\YourUsername\Projects\HGG\
└── roborail-assistant\
    ├── app\
    ├── components\
    ├── lib\
    ├── public\
    ├── package.json
    ├── README.md
    └── ... (other files)
```

---

## 📦 Step 5: Install Dependencies

Install all the required packages for the project.

### 5.1 Install Packages

```bash
npm install
```

You'll see output like:

```
npm install process:
┌─────────────────────────────────────┐
│ npm WARN deprecated ...             │
│ added 247 packages from 456         │
│ contributors and audited 248         │
│ packages in 45.2s                   │
│                                     │
│ 12 packages are looking for funding │
│ run `npm fund` for details          │
│                                     │
│ found 0 vulnerabilities ✅          │
└─────────────────────────────────────┘
```

This creates a **node_modules** folder with all dependencies:

```
roborail-assistant\
├── node_modules\     ← New folder created
├── package.json
└── package-lock.json ← New file created
```

---

## 🔑 Step 6: Setup Environment Variables

Configure the application with your API keys.

### 6.1 Copy Environment Template

```bash
copy .env.example .env.local
```

### 6.2 Edit Environment File

1. Open **.env.local** in a text editor (VS Code, Notepad++, or even Notepad)
2. You'll see something like:

```bash
# Core Configuration
OPENAI_API_KEY=your_openai_key_here
ROBORAIL_MODE=development

# LangSmith Observability (Optional)
LANGSMITH_API_KEY=your_langsmith_key_here
LANGSMITH_PROJECT=roborail-assistant
LANGSMITH_TRACING=true

# Supabase (Optional)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 6.3 Get Your OpenAI API Key

```
OpenAI API Key Process:
┌─────────────────────────────────────┐
│ 1. Go to platform.openai.com       │
│ 2. Sign up / Log in                 │
│ 3. Go to API Keys section           │
│ 4. Click "Create new secret key"    │
│ 5. Copy the key (starts with sk-)   │
│                                     │
│ ⚠️  Save it immediately!            │
│    You won't see it again!          │
└─────────────────────────────────────┘
```

1. Go to **https://platform.openai.com/account/api-keys**
2. Log in or create an account
3. Click **"Create new secret key"**
4. Give it a name like "RoboRail Assistant"
5. Copy the key (starts with `sk-`)
6. Paste it in your **.env.local** file:

```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

### 6.4 Optional: LangSmith Setup

LangSmith provides monitoring and analytics (optional but recommended):

1. Go to **https://smith.langchain.com/**
2. Sign up for a free account
3. Create a new project called "roborail-assistant"
4. Get your API key from settings
5. Add to **.env.local**:

```bash
LANGSMITH_API_KEY=ls-your-actual-key-here
```

---

## 🚀 Step 7: Start the Application

Time to run the RoboRail Assistant!

### 7.1 Start Development Server

```bash
npm run dev
```

You should see:

```
Development Server Starting:
┌─────────────────────────────────────┐
│   ▲ Next.js 14.0.0                  │
│   - Local:        http://localhost:3000 │
│   - Network:      http://192.168.1.x:3000 │
│                                     │
│ ✓ Ready in 2.3s                     │
└─────────────────────────────────────┘
```

### 7.2 Open in Browser

1. Open your web browser
2. Go to **http://localhost:3000**
3. You should see the RoboRail Assistant interface!

```
Browser Flow:
Browser ──► localhost:3000 ──► RoboRail Assistant ──► Success! 🎉
```

---

## 🧪 Step 8: Test the Application

Let's make sure everything works correctly.

### 8.1 Basic Test

1. In the chat interface, type: **"Hello, can you help me with the RoboRail?"**
2. Press Enter or click Send
3. You should get a response from the AI assistant

### 8.2 Test Reasoning Levels

1. Look for the reasoning effort buttons (Lightning ⚡, Gauge ⚖️, Brain 🧠)
2. Hover over each to see the tooltips we created
3. Try asking the same question with different reasoning levels

```
Testing Flow:
┌─────────────────────────────────────┐
│ User Input: "Help with RoboRail"    │
│      │                             │
│      ▼                             │
│ ⚡ Lightning (Low) ──► Fast response │
│ ⚖️ Gauge (Medium) ──► Balanced      │
│ 🧠 Brain (High) ──► Deep analysis   │
│      │                             │
│      ▼                             │
│ AI Response ✅                      │
└─────────────────────────────────────┘
```

---

## 🔧 Step 9: Development Tools (Optional)

For ongoing development, these tools are helpful.

### 9.1 Install VS Code (Recommended)

1. Go to **https://code.visualstudio.com/**
2. Download and install
3. Open the project folder in VS Code:

```bash
code .
```

### 9.2 Useful VS Code Extensions

Install these extensions for better development experience:

- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**  
- **TypeScript Importer**
- **Prettier - Code formatter**
- **Auto Rename Tag**

---

## 🐛 Common Issues & Solutions

### Issue 1: "node is not recognized"

**Problem**: Command prompt doesn't recognize `node` command

**Solution**:
1. Restart your command prompt
2. Check if Node.js is in PATH:
   - Go to System Properties → Environment Variables
   - Check if `C:\Program Files\nodejs\` is in PATH

### Issue 2: "Permission denied" errors

**Problem**: npm install fails with permission errors

**Solution**:
1. Run command prompt as Administrator
2. Or use PowerShell as Administrator

### Issue 3: "Port 3000 already in use"

**Problem**: Another application is using port 3000

**Solution**:
```bash
# Kill the process on port 3000
netstat -ano | findstr :3000
taskkill /PID [PID_NUMBER] /F

# Or use a different port
npm run dev -- -p 3001
```

### Issue 4: OpenAI API errors

**Problem**: "Invalid API key" or "Rate limit exceeded"

**Solution**:
1. Double-check your API key in **.env.local**
2. Ensure you have billing set up on OpenAI account
3. Check your usage limits at platform.openai.com

---

## 📝 Next Steps

Congratulations! You now have the RoboRail Assistant running on Windows.

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Code linting
npm run lint
```

### Project Structure Understanding

```
roborail-assistant/
├── app/                 ← Next.js 14 app directory
│   ├── components/      ← React components
│   ├── api/            ← API routes
│   └── globals.css     ← Global styles
├── components/         ← Shared UI components
├── lib/               ← Utility functions
├── public/            ← Static assets
├── .env.local         ← Your environment variables
├── package.json       ← Dependencies and scripts
└── README.md          ← Project documentation
```

### Learn More

- **Next.js Documentation**: https://nextjs.org/docs
- **React Documentation**: https://react.dev/
- **OpenAI API Docs**: https://platform.openai.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

## 🆘 Getting Help

If you encounter issues:

1. **Check the console**: Open browser DevTools (F12) for error messages
2. **Check the terminal**: Look for errors in your command prompt
3. **GitHub Issues**: https://github.com/HGG-Profiling/roborail-assistant/issues
4. **Contact HGG Support**: Reach out to your HGG representative

---

**Congratulations! 🎉 You've successfully installed the RoboRail Assistant on Windows!**

```
    🤖 RoboRail Assistant Ready!
   ╭─────────────────────────────╮
   │  Windows Installation ✅     │
   │  Dependencies Installed ✅   │
   │  Environment Configured ✅   │
   │  Application Running ✅      │
   │                            │
   │  Ready to help with your   │
   │  RoboRail machine! 🚀       │
   ╰─────────────────────────────╯
```