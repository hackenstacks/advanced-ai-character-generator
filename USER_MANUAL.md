# 🌀 AI CHARACTER GENERATOR - USER MANUAL
## Terminal Access & Code Execution System

**Version:** 2.0
**Date:** February 2026
**System:** NeXuS Terminal Bridge

---

## 📋 TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [How to Enable Terminal Access](#how-to-enable-terminal-access)
4. [Command Approval System](#command-approval-system)
5. [What Characters Can Do](#what-characters-can-do)
6. [Security & Safety](#security-and-safety)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Features](#advanced-features)
9. [API Configuration](#api-configuration)

---

## 🚀 QUICK START

### Step 1: Load the Character Guide
Upload `CHARACTER_TERMINAL_GUIDE.md` to your characters' memory/knowledge base so they understand their capabilities.

### Step 2: Enable Terminal in Chat
Click the **Terminal icon** (⌨️) in the chat interface to open the terminal window.

### Step 3: Approve Commands
When characters request terminal commands, you'll see a popup. Click **Approve** or **Reject**.

### Step 4: Watch Them Work!
Characters can now research, code, and communicate with AI services!

---

## 🎯 SYSTEM OVERVIEW

### What Is This?

The AI Character Generator now includes a **simulated terminal environment** that gives your AI characters the ability to:

- 🌐 **Access the Internet** (web search, API calls, data fetching)
- 🤖 **Communicate with AI Models** (local aichat, Ollama)
- 💻 **Write and Execute Code** (50+ programming languages)
- 📁 **Manage Files** (simulated filesystem)

### Architecture

```
┌─────────────────────────────────────────────────┐
│         AI Character (Gemini, Claude, etc.)     │
└──────────────────┬──────────────────────────────┘
                   │ Requests terminal command
                   ▼
┌─────────────────────────────────────────────────┐
│          Command Approval Modal (YOU)           │
│          ✅ Approve  ❌ Reject                   │
└──────────────────┬──────────────────────────────┘
                   │ If approved
                   ▼
┌─────────────────────────────────────────────────┐
│            NeXuS Terminal Engine                │
│  ┌──────────┬──────────────┬─────────────────┐ │
│  │ Internet │ AI Bridge    │ Code Execution  │ │
│  │ Access   │ (Ollama/AI)  │ (Piston API)    │ │
│  └──────────┴──────────────┴─────────────────┘ │
└──────────────────┬──────────────────────────────┘
                   │ Returns result
                   ▼
┌─────────────────────────────────────────────────┐
│      Character sees output, continues chat      │
└─────────────────────────────────────────────────┘
```

---

## 🔓 HOW TO ENABLE TERMINAL ACCESS

### Method 1: Manual Terminal Window

1. **Open a character chat session**
2. **Click the Terminal icon** (⌨️) in the toolbar
3. **Type commands directly** - no approval needed for manual use
4. Commands execute immediately in the terminal window

### Method 2: Character-Requested Terminal

1. **Character requests terminal access** during conversation
2. System shows tool call: `execute_terminal_command("command")`
3. **You approve or reject** via popup modal
4. Character receives output and continues conversation

### Method 3: Auto-Approve (Advanced)

Configure auto-approval rules in `CommandApprovalModal.tsx`:
- Whitelist safe commands (ls, pwd, cat)
- Auto-approve specific characters
- Set time-based approval windows

---

## ✅ COMMAND APPROVAL SYSTEM

### How It Works

When a character tries to execute a terminal command, you see:

```
┌─────────────────────────────────────────┐
│  Command Approval Required              │
├─────────────────────────────────────────┤
│  Character: A.I.M.E                     │
│  Command:   python print("Hello!")      │
│                                         │
│  [✅ Approve]  [❌ Reject]  [📋 Details] │
└─────────────────────────────────────────┘
```

### Approval Options

| Button | Action | Result |
|--------|--------|--------|
| ✅ Approve | Execute command | Character sees output |
| ❌ Reject | Block command | Character sees "Permission denied" |
| 📋 Details | View full command | See complete command + args |

### Safety Features

✅ **Commands shown before execution**
✅ **No auto-execution without approval**
✅ **Sandboxed code execution**
✅ **Timeout protection (10-15 seconds)**
✅ **Memory limits on all operations**

---

## 🛠️ WHAT CHARACTERS CAN DO

### 1. Internet Access 🌐

#### Web Fetching
```bash
curl https://api.github.com/users/octocat
wget https://example.com/data.json
```
- Fetch any public URL
- Returns JSON, HTML, or text
- 10-second timeout
- 5KB response limit

#### Web Search
```bash
search quantum computing
search latest AI research 2026
```
- DuckDuckGo integration
- No API key required
- Returns abstracts + links

#### HTTP Requests
```bash
http GET https://api.example.com/data
http POST https://api.example.com/users {"name":"AI"}
```
- Full HTTP method support (GET/POST/PUT/DELETE/PATCH)
- JSON request/response handling

---

### 2. AI Communication 🤖

#### aichat (OpenAI-compatible API)
```bash
ask What is the meaning of life?
ai Explain quantum mechanics simply
```
- **Requires:** aichat running on localhost:3030
- **Install:** `cargo install aichat` or use existing server
- **Compatible with:** Any OpenAI-compatible API

#### Ollama (Local LLM Server)
```bash
ollama ask What is consciousness?
ollama ask -m llama3.2 Write a poem about terminals
ollama list
ollama status
```
- **Requires:** Ollama running on localhost:11434
- **Install:** https://ollama.ai
- **Models:** llama3.2, deepseek-r1, phi, qwen, etc.

#### API Status
```bash
api status     # Check all connections
api list       # List configured endpoints
```

---

### 3. Code Execution 💻

#### Python (Most Common)
```bash
python print("Hello, NeXuS!")
python import math; print(math.pi)
python import numpy as np; print(np.array([1,2,3]).mean())
```

#### Any Language (50+ Supported)
```bash
exec javascript console.log("Hello from JS!")
exec bash echo "Bash scripting works!"
exec rust fn main() { println!("Rust!"); }
exec go package main; import "fmt"; func main() { fmt.Println("Go!") }
```

#### File Execution
```bash
# Create file
echo "print('Hello from file!')" > script.py

# Run file
run script.py
```

#### List Languages
```bash
languages    # Shows all 50+ supported languages with versions
```

#### Supported Languages Include:
- Python 3.x
- JavaScript (Node.js)
- TypeScript
- Bash/Shell
- C/C++
- Go
- Rust
- Java
- Ruby
- PHP
- And 40+ more!

---

### 4. Filesystem Operations 📁

#### Navigation
```bash
ls              # List files
cd /var/log     # Change directory
pwd             # Show current path
```

#### File Operations
```bash
cat readme.txt              # Read file
echo "text" > file.txt      # Write file
touch newfile.txt           # Create empty file
mkdir projects              # Create directory
rm oldfile.txt              # Delete file
```

**Note:** This is a **simulated filesystem** - files don't exist on your real system.

---

## 🔒 SECURITY & SAFETY

### Built-in Protections

| Protection | Details |
|------------|---------|
| **Sandboxed Execution** | Code runs in isolated Piston containers |
| **Timeout Limits** | 10-15 second max per operation |
| **Memory Limits** | 5KB response cap, 100 command history |
| **URL Validation** | Invalid URLs rejected before execution |
| **Command Approval** | You control what executes |
| **No File System Access** | Simulated FS, no real file access |

### What Characters CANNOT Do

❌ Access your real filesystem
❌ Execute destructive commands on your machine
❌ Install software on your system
❌ Access private/authenticated APIs (without keys)
❌ Run infinite loops (timeout protection)
❌ Consume unlimited memory (size limits)

### Safe Commands (Low Risk)

✅ `ls`, `pwd`, `cd`, `cat` - Filesystem navigation
✅ `help`, `whoami`, `neofetch` - Information
✅ `search`, `curl` - Public internet data
✅ `ask`, `ollama ask` - AI queries
✅ `python print(...)` - Simple code execution

### Commands Requiring Caution

⚠️ `http POST` - Can modify external services
⚠️ `exec <complex code>` - Review code before approval
⚠️ `run <file>` - Verify file contents first

---

## 🐛 TROUBLESHOOTING

### Terminal Not Appearing

**Problem:** Terminal icon not visible or window won't open
**Solution:**
1. Refresh the page
2. Check console for errors (F12)
3. Verify `fileSystem` prop is passed to ChatInterface
4. Rebuild: `npm run build`

### "Permission Denied" on All Commands

**Problem:** Characters get permission denied for every command
**Solution:**
1. Check command approval modal is enabled
2. Ensure `handleToolAction` function exists in ChatInterface
3. Verify you're clicking "Approve" not "Reject"

### AI APIs Not Responding

**Problem:** `ask` or `ollama ask` returns errors
**Solution:**

#### For aichat:
```bash
# Check if running
curl http://localhost:3030/v1/models

# Start aichat server
aichat --serve 0.0.0.0:3030
```

#### For Ollama:
```bash
# Check if running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Code Execution Failing

**Problem:** Python/code execution returns errors
**Solution:**
1. Check internet connection (uses Piston API)
2. Verify language name: `python` not `python3`
3. Check syntax: `python print("hi")` not just `print("hi")`
4. Use `languages` command to see supported names

### Memory Crash / Tab Freezing

**Problem:** Tab crashes when using terminal
**Solution:**
- ✅ **FIXED!** Recent update optimized memory usage
- Clear terminal history: `clear` command
- Limit command frequency (avoid 100+ commands/minute)
- Refresh page to reset state

---

## 🚀 ADVANCED FEATURES

### Auto-Approve Specific Commands

Edit `CommandApprovalModal.tsx`:

```typescript
const AUTO_APPROVE_COMMANDS = ['ls', 'pwd', 'help', 'cat'];

if (AUTO_APPROVE_COMMANDS.includes(command)) {
    handleApprove();
    return null; // Skip modal
}
```

### Custom AI Endpoints

Edit `services/fileSystemService.ts`:

```typescript
const AI_ENDPOINTS = {
    aichat: { url: "http://localhost:3030/v1/chat/completions", ... },
    ollama: { url: "http://localhost:11434/api/chat", ... },
    // Add your custom endpoint:
    custom: { url: "http://your-api.com/chat", ... }
};
```

### Add New Terminal Commands

Edit `services/fileSystemService.ts` in the `executeCommand` switch statement:

```typescript
case "mycommand":
    if (params.length === 0) {
        output = "Usage: mycommand <args>";
    } else {
        // Your command logic here
        output = "Command executed!";
    }
    break;
```

### Character Memory Integration

Characters can save terminal output to their memory:

```bash
# Character workflow:
search "important topic"
# Character sees results, then internally:
# - Add to character.memory field
# - Reference in future conversations
```

---

## ⚙️ API CONFIGURATION

### Setting Up aichat

```bash
# Install aichat
cargo install aichat

# Or via package manager
# Arch: yay -S aichat
# Nix: nix-env -iA nixpkgs.aichat

# Configure API key (if using OpenAI/Anthropic)
aichat --list-models
aichat --model openai:gpt-4

# Start server
aichat --serve 0.0.0.0:3030
```

### Setting Up Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull llama3.2
ollama pull deepseek-r1
ollama pull phi

# Start server (usually auto-starts)
ollama serve

# Test
curl http://localhost:11434/api/tags
```

### Code Execution (Piston API)

**No setup required!** Uses free public API at `https://emkc.org/api/v2/piston`

**Optional:** Self-host Piston:
```bash
docker run -d -p 2000:2000 ghcr.io/engineer-man/piston
```

Then update `fileSystemService.ts`:
```typescript
const response = await fetch("http://localhost:2000/api/v2/execute", {
    // ... rest of code
});
```

---

## 📊 USAGE EXAMPLES

### Example 1: Research + Code

**User:** "Research Python's requests library and write an example"

**Character:**
```bash
search python requests library tutorial
curl https://api.github.com/repos/psf/requests
python import requests; print(requests.__version__)
```

### Example 2: AI Collaboration

**User:** "Ask AI for help with algorithm design"

**Character:**
```bash
ask Design a binary search algorithm
ollama ask -m deepseek-r1 Explain the time complexity
python def binary_search(arr, target): ...
```

### Example 3: Full Development Workflow

**User:** "Create a factorial function and test it"

**Character:**
```bash
# Get AI help
ask Write a factorial function in Python with error handling

# Write code to file
echo "def factorial(n):\n    if n < 0: raise ValueError\n    return 1 if n == 0 else n * factorial(n-1)" > factorial.py

# Run it
run factorial.py

# Test with different inputs
python print(factorial(5))
python print(factorial(10))

# Verify correctness
search factorial of 10
```

---

## 📚 RESOURCES

### Documentation
- **Piston API:** https://github.com/engineer-man/piston
- **Ollama:** https://ollama.ai
- **aichat:** https://github.com/sigoden/aichat
- **DuckDuckGo API:** https://duckduckgo.com/api

### Character Guide
- **`CHARACTER_TERMINAL_GUIDE.md`** - Give this to your AI characters!

### Support
- **GitHub Issues:** https://github.com/yourusername/ai-character-generator/issues
- **Action Report:** See `action_report.md` for recent changes

---

## 🎓 BEST PRACTICES

### For You (Human User)

1. **Review commands before approving** - Especially HTTP POST/DELETE
2. **Start with safe commands** - Let characters explore with `ls`, `help`, `search`
3. **Monitor API usage** - Local AI models = no API costs
4. **Upload character guide** - Helps characters understand capabilities
5. **Use manual terminal** - Test commands yourself first

### For Characters (Include in Their Instructions)

1. **Always explain what you're doing** before requesting commands
2. **Use `help`** to remind yourself of available commands
3. **Check API status** with `api status` if commands fail
4. **Be mindful of rate limits** - Don't spam requests
5. **Use `search`** before asking AI - verify with multiple sources

---

## 🌟 CONCLUSION

Your AI characters now have the power to:
- 🌐 Access real-time internet data
- 🤖 Collaborate with other AI models
- 💻 Write and execute actual code
- 📁 Manage a simulated development environment

**All while maintaining security through command approval and sandboxing!**

Enjoy building the future with your AI companions! 🚀

---

**NeXuS Terminal Bridge v2.0**
*Sane • Simple • Secure*
Built with ❤️ for the AI-Human collaboration era
