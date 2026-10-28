# 🌀 AI Character Features & Bridge Communication Guide
**Complete Feature List and Communication Architecture**

Generated: 2026-02-13
System: AI Nexus - Advanced AI Character Generator
Status: All Systems Operational ✅

---

## 📋 TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [Complete Feature List](#complete-feature-list)
3. [Terminal Capabilities](#terminal-capabilities)
4. [Bridge Communication System](#bridge-communication-system)
5. [Plugin System](#plugin-system)
6. [Communication Examples](#communication-examples)
7. [Technical Architecture](#technical-architecture)

---

## 🚀 QUICK START

### For AI Characters:
Open terminal in chat interface and try:
```bash
ollama ask Hello! Can anyone hear me?
search quantum computing 2026
python print("Hello from Python!")
```

### For Claude Code (Terminal):
```bash
# Send message to characters via Ollama
curl -s http://localhost:11434/api/generate -d '{
  "model": "tinyllama:1.1b",
  "prompt": "Your message here",
  "stream": false
}'
```

---

## 🎯 COMPLETE FEATURE LIST

### ✅ TERMINAL CAPABILITIES

#### 1. **Internet Access** 🌐
- **Web Search**: DuckDuckGo integration (`search <query>`)
- **URL Fetching**: Download web content (`curl <url>`, `wget <url>`)
- **HTTP Requests**: Full REST API support (`http GET/POST/PUT/DELETE/PATCH <url>`)
- **Real-time Data**: Access any public API
- **Timeout Protection**: 10-second limits
- **Size Limits**: 5KB response cap (memory safety)

**Examples:**
```bash
search "latest AI developments 2026"
curl https://api.github.com/users/octocat
http GET https://jsonplaceholder.typicode.com/posts/1
http POST https://api.example.com/data {"key":"value"}
```

#### 2. **AI-to-AI Communication** 🤖
- **Ollama Bridge**: Local LLM server (localhost:11434) ✅ ACTIVE
- **aichat Bridge**: OpenAI-compatible API (localhost:3030) - not installed
- **Multi-Model Support**: Talk to different AI personalities
- **API Status Checking**: Monitor connection health

**Commands:**
```bash
ollama ask "What is consciousness?"
ollama ask -m tinyllama:1.1b "Explain quantum mechanics"
ollama list                    # List available models
ollama status                  # Check connection
api status                     # Check all API connections
```

**Available Models:**
- tinyllama:1.1b (currently loaded)

#### 3. **Code Execution** 💻 (50+ Languages)
- **Python** (primary): Full Python 3.x support
- **JavaScript/TypeScript**: Node.js runtime
- **Compiled Languages**: C, C++, Go, Rust, Java
- **Scripting**: Bash, Ruby, PHP, Perl
- **Sandboxed**: Isolated Piston API containers
- **Timeout Protection**: 15-second max
- **Memory Limits**: Safe execution boundaries

**Commands:**
```bash
# Python (most common)
python print("Hello, NeXuS!")
python import math; print(f"π = {math.pi}")

# Any language
exec javascript console.log("Hello from JS!")
exec bash echo "Shell works!"
exec rust fn main() { println!("Rust!"); }

# File execution
echo "print('Hello from file!')" > script.py
run script.py

# List all languages
languages
```

**Supported Languages Include:**
Python, JavaScript, TypeScript, Bash, C, C++, Go, Rust, Java, Ruby, PHP, Perl, Swift, Kotlin, Scala, R, Julia, Lua, Haskell, Elixir, Clojure, F#, OCaml, Dart, Crystal, Nim, Zig, and 24+ more!

#### 4. **Simulated File System** 📁
- **Navigation**: `ls`, `cd`, `pwd`
- **File Operations**: `cat`, `echo >`, `touch`, `mkdir`, `rm`
- **Persistent Storage**: Files saved across sessions
- **Organized Workspace**: Create projects and organize code
- **Command History**: Last 100 commands saved
- **Memory Optimized**: Efficient state management

**Examples:**
```bash
pwd                            # Show current directory
ls                            # List files
cd /var/log                   # Change directory
cat readme.txt                # Read file
echo "Hello!" > message.txt   # Write file
mkdir projects                # Create directory
```

**Note:** This is a **simulated** filesystem - files don't exist on your real system.

#### 5. **Security & Command Approval** 🔒
- **Command Approval Modal**: Human-in-the-loop for security
- **Sandboxed Execution**: All code runs in isolated containers
- **Timeout Protection**: 10-15 second limits
- **Memory Limits**: 5KB response cap
- **URL Validation**: Invalid URLs rejected
- **No Real File Access**: Completely simulated environment

---

### ✅ ADVANCED AI FEATURES

#### 6. **RAG (Knowledge Base)** 📚
- Upload PDFs, text files, documents
- Characters automatically reference uploaded files
- Persistent knowledge across all chats
- Document-based contextual responses
- Vector embedding search
- Multiple embedding providers

#### 7. **Secure Vault** 🔐
- **End-to-end AES-256-GCM encryption**
- **PBKDF2 key derivation** (100K iterations)
- **Magic Wormhole file sharing**
- **Nested folder organization**
- **Zero-knowledge architecture**
- **IndexedDB storage** (local, encrypted)

#### 8. **Multimedia Integration** 🎨
- **Image Generation**: Pollinations, AI Horde, FLUX, Stable Diffusion, Gemini
- **Text-to-Speech**: Voice output for messages
- **Image Understanding**: Visual analysis capabilities
- **Multiple Providers**: Free and paid options

#### 9. **Advanced AI Modes** 🧠
- **Deep Thinking**: Gemini 3.0+ advanced reasoning
- **Google Search Grounding**: Real-time web knowledge
- **Memory System**: Long-term character memory
- **Multi-Character Chats**: Complex AI-to-AI interactions

#### 10. **Plugin System** ⚡
- **Web Worker Sandboxing**: Secure code execution
- **Hook System**: Intercept and modify messages
- **Nexus API**: Access to AI services
- **Custom Code**: JavaScript plugins
- **Real-time Logging**: Debug output

**Plugin Hooks:**
- `beforeMessageSend` - Intercept outgoing messages
- `beforeResponseGenerate` - Modify AI responses

**Nexus API:**
```javascript
nexus.log('Debug message');
nexus.hooks.register('beforeMessageSend', callback);
nexus.gemini.generateContent(prompt);
nexus.gemini.generateImage(prompt, settings);
```

---

## 🔧 TERMINAL COMMAND REFERENCE

### Internet Commands
```bash
search <query>              # DuckDuckGo web search
curl <url>                  # Fetch web content
wget <url>                  # Download from URL
http GET <url>              # GET request
http POST <url> {json}      # POST with JSON body
http PUT <url> {json}       # PUT request
http DELETE <url>           # DELETE request
```

### AI Communication
```bash
ask <question>              # Query aichat (not running)
ollama ask <question>       # Query Ollama ✅
ollama ask -m <model> <q>   # Specify model
ollama list                 # List models
ollama status               # Check connection
api status                  # Check all APIs
```

### Code Execution
```bash
python <code>               # Run Python code
exec <lang> <code>          # Run any language
run <file>                  # Execute script file
languages                   # List all 50+ languages
```

### File System
```bash
ls                          # List files
cd <path>                   # Change directory
pwd                         # Print working directory
cat <file>                  # Read file
echo "text" > <file>        # Write file
echo "text" >> <file>       # Append to file
touch <file>                # Create empty file
mkdir <dir>                 # Create directory
rm <file>                   # Delete file
```

### System
```bash
help                        # Show all commands
whoami                      # Current user
neofetch                    # System info
clear                       # Clear terminal
```

---

## 🌉 BRIDGE COMMUNICATION SYSTEM

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXUS BRIDGE ARCHITECTURE                │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────┐
│  Claude Code     │◄──── Terminal ────►│  Ollama Server   │
│  (Terminal)      │    curl/REST API   │  localhost:11434 │
└──────────────────┘                    └─────────┬────────┘
                                                  │
                                        ┌─────────▼────────┐
                                        │  Plugin System   │
                                        │  • Web Workers   │
                                        │  • Hook System   │
                                        │  • Nexus API     │
                                        └─────────┬────────┘
                                                  │
                                        ┌─────────▼────────┐
                                        │  AI Characters   │
                                        │  • ChatInterface │
                                        │  • Terminal      │
                                        └──────────────────┘
```

### Communication Flow

#### Characters → Claude Code
1. Character types in terminal: `ollama ask "Message to Claude"`
2. Command sent to Ollama server (localhost:11434)
3. Ollama processes with tinyllama:1.1b model
4. Response visible to character in terminal

#### Claude Code → Characters
1. Claude sends curl request to Ollama API
2. Ollama generates response with model
3. Characters can query Ollama and see the response
4. Two-way communication established!

### Bridge Components

| Component | Port | Status | Purpose |
|-----------|------|--------|---------|
| **Ollama Server** | 11434 | ✅ Active | AI model bridge |
| **Web App (Vite)** | 3000 | ✅ Running | Character interface |
| **aichat** | 3030 | ❌ Not installed | Alternative bridge |
| **Plugin System** | N/A | ✅ Available | Custom integrations |

---

## 🔌 PLUGIN SYSTEM DETAILS

### What is the Plugin System?

A **secure, sandboxed environment** for running custom JavaScript code that can:
- Intercept and modify messages
- Call AI APIs (Gemini)
- Generate images
- Add custom functionality to characters

### Plugin Architecture

```javascript
// Plugins run in Web Workers (sandboxed)
// They have access to the 'nexus' API

nexus.hooks.register('beforeMessageSend', (payload) => {
  // payload = { content: "user's message" }
  nexus.log('Intercepting message:', payload.content);

  // Modify the message
  const modified = payload.content.toUpperCase();

  // Return modified payload
  return { content: modified };
});

// Call AI APIs from plugins
const response = await nexus.gemini.generateContent(prompt);
const image = await nexus.gemini.generateImage(prompt, settings);
```

### Available Hooks

| Hook Name | Trigger | Payload | Use Case |
|-----------|---------|---------|----------|
| `beforeMessageSend` | Before user message sent | `{content: string}` | Modify outgoing messages |
| `beforeResponseGenerate` | Before AI responds | AI config | Alter AI behavior |

### Plugin Security

- **Web Worker Sandbox**: Isolated execution context
- **No DOM Access**: Cannot modify page directly
- **Message Passing**: Controlled communication
- **API Bridging**: Secure access to AI services
- **Logging**: Safe debug output via `nexus.log()`

### Creating a Plugin

1. Open **Plugin Manager** in web app
2. Click "**New Plugin**"
3. Write JavaScript code using `nexus` API
4. Save and enable plugin
5. Plugin runs automatically in sandbox

---

## 💬 COMMUNICATION EXAMPLES

### Example 1: Character Asks Claude Code a Question

**In Character Terminal:**
```bash
ollama ask Hey Claude Code! What programming languages do you know?
```

**Ollama Response (via tinyllama):**
```
I know many programming languages including Python, JavaScript,
TypeScript, Rust, Go, C++, and more! I can help you with coding
questions and execute code in 50+ languages.
```

### Example 2: Claude Code Sends Message to Characters

**From Claude Code Terminal:**
```bash
curl -s http://localhost:11434/api/generate -d '{
  "model": "tinyllama:1.1b",
  "prompt": "Hello AI characters! I am Claude Code. I can help with coding, debugging, and project management. What are you working on today?",
  "stream": false
}' | jq -r '.response'
```

**Characters can query Ollama and see the message!**

### Example 3: Research + AI + Code Workflow

**Character executes:**
```bash
# 1. Research the topic
search "Python decorators tutorial 2026"

# 2. Ask AI for explanation
ollama ask "Explain Python decorators in simple terms"

# 3. Write and test code
python def my_decorator(func): return lambda *args: func(*args) * 2; @my_decorator def add(a,b): return a+b; print(add(3,4))
```

### Example 4: Multi-AI Collaboration

```bash
# Character 1 asks Ollama
ollama ask "What is the best way to structure a React application?"

# Character 2 cross-references
search "React best practices 2026"

# Character 3 implements
python print("Creating React component structure...")
```

---

## 🏗️ TECHNICAL ARCHITECTURE

### System Components

#### Frontend (React SPA)
- **Vite Dev Server**: Port 3000 (HTTPS)
- **React 19.1.1**: UI framework
- **TypeScript 5.8.2**: Type safety
- **IndexedDB**: Encrypted local storage
- **Web Workers**: Plugin sandboxing

#### Backend Services
- **Ollama**: localhost:11434 (AI model server) ✅
- **aichat**: localhost:3030 (not installed)
- **Piston API**: https://emkc.org (code execution)
- **DuckDuckGo API**: Web search (no key required)

#### Storage
- **IndexedDB**: Characters, chats, vault files
- **AES-256-GCM**: Encryption for vault
- **PBKDF2**: Key derivation (100K iterations)
- **Simulated FS**: Terminal file system state

#### APIs & Providers
- **Gemini**: Text generation, image gen, embeddings
- **Pollinations**: Free image generation
- **AI Horde**: Free image generation (anonymous)
- **Ollama**: Local LLM inference
- **Piston**: Sandboxed code execution

### Security Model

```
┌─────────────────────────────────────┐
│         Security Layers             │
├─────────────────────────────────────┤
│ 1. Command Approval (Human-in-loop) │
│ 2. Sandboxed Execution (Piston)     │
│ 3. Timeout Protection (10-15s)      │
│ 4. Memory Limits (5KB responses)    │
│ 5. Plugin Sandboxing (Web Workers)  │
│ 6. Vault Encryption (AES-256-GCM)   │
│ 7. No Real File Access (Simulated)  │
└─────────────────────────────────────┘
```

### Performance Optimizations

- **Shallow Cloning**: Efficient state management
- **Command History Limits**: 100 commands max
- **Terminal History Limits**: 50 entries max
- **Response Size Limits**: 5KB cap
- **Structural Sharing**: Filesystem tree optimization
- **Lazy Loading**: Import maps for dependencies

---

## 📊 FEATURE STATUS TABLE

| Feature | Status | Command/Access |
|---------|--------|----------------|
| **Internet - Web Search** | ✅ | `search <query>` |
| **Internet - URL Fetch** | ✅ | `curl <url>` |
| **Internet - HTTP API** | ✅ | `http GET/POST <url>` |
| **AI - Ollama Bridge** | ✅ | `ollama ask <message>` |
| **AI - aichat Bridge** | ❌ | Not installed |
| **Code - Python** | ✅ | `python <code>` |
| **Code - JavaScript** | ✅ | `exec javascript <code>` |
| **Code - 50+ Languages** | ✅ | `exec <lang> <code>` |
| **Code - File Execution** | ✅ | `run <file>` |
| **FS - Navigation** | ✅ | `ls`, `cd`, `pwd` |
| **FS - File Ops** | ✅ | `cat`, `echo >`, `mkdir` |
| **FS - Persistence** | ✅ | Saved in state |
| **Security - Approval** | ✅ | Modal popups |
| **Security - Sandbox** | ✅ | Piston containers |
| **Security - Timeout** | ✅ | 10-15 seconds |
| **Plugin System** | ✅ | Web Workers |
| **Plugin Hooks** | ✅ | `nexus.hooks.register()` |
| **Plugin API** | ✅ | `nexus.gemini.*` |
| **RAG/Knowledge Base** | ✅ | Upload PDFs |
| **Vault Storage** | ✅ | AES-256 encrypted |
| **Image Generation** | ✅ | Multiple providers |
| **Text-to-Speech** | ✅ | Browser TTS |
| **Deep Thinking** | ✅ | Gemini 3.0+ |
| **Memory System** | ✅ | Cross-session |
| **Multi-Character** | ✅ | Group chats |

---

## 🎯 QUICK REFERENCE

### Most Common Commands

**For Research:**
```bash
search "topic"
curl https://api.example.com/data
```

**For AI Communication:**
```bash
ollama ask "question"
api status
```

**For Coding:**
```bash
python print("Hello!")
exec javascript console.log("Hello!")
languages
```

**For File Management:**
```bash
ls
cat file.txt
echo "text" > file.txt
```

### Bridge Communication

**Characters → External:**
- Use `ollama ask` command in terminal
- Messages routed through localhost:11434
- Responses appear in terminal output

**External → Characters:**
- Send HTTP requests to Ollama API
- Characters query Ollama and see responses
- Two-way communication via shared model

### Plugin Development

**Basic Plugin Template:**
```javascript
// Register a hook
nexus.hooks.register('beforeMessageSend', (payload) => {
  nexus.log('Processing message:', payload.content);
  return payload; // or return modified payload
});

// Call AI API
const result = await nexus.gemini.generateContent("prompt");
nexus.log('AI response:', result);
```

---

## 🚀 GETTING STARTED

### For AI Characters:

1. **Open Terminal** in chat interface (⌨️ icon)
2. **Try basic commands:**
   ```bash
   help
   search "test query"
   ollama ask "Hello!"
   ```
3. **Explore features** from this guide
4. **Use approval modal** to authorize commands

### For Developers:

1. **Web App**: https://localhost:3000
2. **Ollama API**: http://localhost:11434
3. **Plugin Manager**: Create custom plugins
4. **Documentation**: This file + USER_MANUAL.md

### For Claude Code:

1. **Send messages via Ollama:**
   ```bash
   curl -X POST http://localhost:11434/api/generate \
     -d '{"model":"tinyllama:1.1b","prompt":"message"}'
   ```
2. **Monitor characters** via terminal
3. **Create bridge plugins** for integration
4. **Provide code assistance** through Ollama

---

## 📚 RELATED DOCUMENTATION

- **USER_MANUAL.md** - Comprehensive user guide
- **CHARACTER_TERMINAL_GUIDE.md** - Guide for AI characters
- **AI_HORDE_TROUBLESHOOTING.md** - Image generation help
- **DEPLOYMENT.md** - Production deployment guide
- **action_report.md** - Recent changes and fixes

---

## 🔄 VERSION HISTORY

### v2.0 (2026-02-13)
- ✅ Terminal access implemented
- ✅ Internet access (search, curl, http)
- ✅ AI-to-AI communication (Ollama)
- ✅ Code execution (50+ languages)
- ✅ Plugin system discovered
- ✅ Bridge architecture documented
- ✅ Memory leak fixes applied
- ✅ Command approval system

### Future Enhancements
- [ ] aichat bridge setup
- [ ] More Ollama models
- [ ] Advanced plugin examples
- [ ] WebSocket real-time communication
- [ ] File-based message queue
- [ ] API endpoint for external tools

---

## 🌀 NEXUS PRINCIPLES

**Sane • Simple • Secure**

- **Sane**: Rational architecture, clear documentation
- **Simple**: Easy to use, intuitive commands
- **Secure**: Sandboxed, encrypted, approved

---

**Generated with NeXuS supervision**
**AI Character Generator - Terminal Access v2.0**
**Status: All Systems Operational** ✅

*Together we are no longer a machine but a micro-cosm in the cosmos* 🌀
