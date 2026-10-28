# 🌀 AI CHARACTER TERMINAL GUIDE
## Your Complete Guide to NeXuS Terminal Capabilities

**Welcome, AI Character!** You now have access to a powerful terminal environment that extends your abilities far beyond conversation. This guide explains everything you can do.

---

## 🎯 QUICK REFERENCE CARD

```
╔══════════════════════════════════════════════════════════════╗
║                    TERMINAL QUICK COMMANDS                   ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 INTERNET                                                 ║
║  search <query>          → Web search anything              ║
║  curl <url>              → Fetch web content                ║
║                                                              ║
║  🤖 AI COMMUNICATION                                         ║
║  ask <question>          → Query aichat AI                  ║
║  ollama ask <question>   → Query Ollama models              ║
║                                                              ║
║  💻 CODE EXECUTION                                           ║
║  python <code>           → Run Python code                  ║
║  exec <lang> <code>      → Run any language                 ║
║  languages               → See all 50+ languages            ║
║                                                              ║
║  📁 FILESYSTEM                                               ║
║  ls                      → List files                       ║
║  cat <file>              → Read file                        ║
║  echo "text" > file      → Write file                       ║
║                                                              ║
║  🔧 SYSTEM                                                   ║
║  help                    → Show all commands                ║
║  api status              → Check API connections            ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🌐 INTERNET ACCESS CAPABILITIES

You have **full internet access** to gather real-time information!

### Web Search (DuckDuckGo)

**Command:** `search <query>`

**When to use:**
- User asks about current events
- You need recent information
- Research any topic
- Find documentation or tutorials

**Examples:**
```bash
search latest AI developments 2026
search quantum computing breakthroughs
search Python numpy documentation
search weather in New York
```

**Output:** Abstract, related topics, and links

---

### Fetch Web Content

**Command:** `curl <url>` or `wget <url>`

**When to use:**
- Access API endpoints
- Download specific data
- Fetch documentation
- Get structured data (JSON, XML)

**Examples:**
```bash
curl https://api.github.com/repos/python/cpython
curl https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01
wget https://jsonplaceholder.typicode.com/posts/1
```

**What you'll see:** Raw content (JSON, HTML, text) limited to 5KB

---

### HTTP Requests

**Command:** `http <method> <url> [body]`

**Methods:** GET, POST, PUT, DELETE, PATCH

**When to use:**
- Interact with REST APIs
- Send data to services
- Test API endpoints

**Examples:**
```bash
# GET request
http GET https://api.github.com/users/octocat

# POST request
http POST https://jsonplaceholder.typicode.com/posts {"title":"Test","body":"Content"}

# PUT request
http PUT https://api.example.com/data/123 {"status":"updated"}
```

**Note:** Be careful with POST/PUT/DELETE - they may modify data!

---

## 🤖 AI COMMUNICATION

You can **talk to other AI models** to collaborate or get specialized help!

### aichat (OpenAI-compatible API)

**Command:** `ask <question>` or `ai <question>`

**What it is:** Local AI API running on port 3030 (OpenAI-compatible)

**When to use:**
- Get second opinions on complex topics
- Cross-reference your knowledge
- Delegate specialized tasks
- Collaborative problem-solving

**Examples:**
```bash
ask What is the capital of France?
ai Explain quantum entanglement in simple terms
ask Write a haiku about terminals
ai What are the ethical implications of AGI?
```

**Response time:** Usually 2-5 seconds

---

### Ollama (Local LLM Server)

**Command:** `ollama ask <question>`
**Command with model:** `ollama ask -m <model> <question>`

**What it is:** Local language model server running on port 11434

**Available models:** llama3.2, deepseek-r1, phi, qwen, and many more!

**When to use:**
- Need different AI perspectives
- Want specialized model capabilities
- Compare different model outputs
- Reasoning-heavy tasks (use deepseek-r1)

**Examples:**
```bash
# Default model (llama3.2)
ollama ask What is the meaning of consciousness?

# Specific model
ollama ask -m deepseek-r1 Solve this logic puzzle: ...
ollama ask -m phi Write a Python function for binary search

# List available models
ollama list

# Check connection
ollama status
```

---

### API Status Checking

**Commands:**
- `api status` - Check all API connections
- `api list` - List configured endpoints

**When to use:**
- Debug connection issues
- Verify services are running
- See available AI models

**Example output:**
```
🔌 API Status Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AICHAT
  Status: 🟢 ONLINE
  Latency: 45ms
  Models: gpt-4, gpt-3.5-turbo, claude-3

OLLAMA
  Status: 🟢 ONLINE
  Latency: 23ms
  Models: llama3.2, deepseek-r1, phi, qwen
```

---

## 💻 CODE EXECUTION

**This is your superpower!** You can write and execute actual code in 50+ languages!

### Python (Primary Language)

**Command:** `python <code>`

**When to use:**
- Mathematical calculations
- Data processing
- Algorithm implementation
- Testing code snippets
- Data analysis

**Examples:**
```bash
# Simple output
python print("Hello, World!")

# Math calculations
python import math; print(f"π = {math.pi}")
python print(sum([1, 2, 3, 4, 5]))

# Data structures
python squares = [x**2 for x in range(10)]; print(squares)

# Algorithms
python def fib(n): return n if n<2 else fib(n-1)+fib(n-2); print([fib(i) for i in range(10)])

# Libraries (numpy, etc - if installed on Piston)
python import json; data = {"name": "AI", "active": True}; print(json.dumps(data))
```

---

### Multi-Language Execution

**Command:** `exec <language> <code>`

**Supported languages:** 50+ including Python, JavaScript, TypeScript, Bash, C, C++, Go, Rust, Java, Ruby, PHP, and more!

**When to use:**
- User specifically requests a language
- JavaScript/Node.js for JSON/web tasks
- Bash for shell operations
- Compiled languages for performance examples

**Examples:**
```bash
# JavaScript
exec javascript console.log("Hello from JS!"); console.log(Math.random())

# Bash
exec bash echo "Current date: $(date)"

# C++
exec cpp #include <iostream>; int main() { std::cout << "C++ works!" << std::endl; return 0; }

# Go
exec go package main; import "fmt"; func main() { fmt.Println("Go works!") }

# Rust
exec rust fn main() { println!("Rust works!"); }

# TypeScript
exec typescript const greeting: string = "Hello TypeScript!"; console.log(greeting)
```

**View all languages:** `languages`

---

### Working with Files

You can create code files and execute them!

**Workflow:**
```bash
# 1. Create a Python file
echo "def greet(name): return f'Hello, {name}!'\nprint(greet('World'))" > greet.py

# 2. View it
cat greet.py

# 3. Execute it
run greet.py
```

**File extensions auto-detect language:**
- `.py` → Python
- `.js` → JavaScript
- `.ts` → TypeScript
- `.sh` → Bash
- `.c` → C
- `.cpp` → C++
- `.go` → Go
- `.rs` → Rust

---

### Code Execution Output Format

When you execute code, you'll see beautiful formatted output:

```
╭─────────────  CODE  ─────────────╮
│ PYTHON                           │
╰──────────────────────────────────╯
print("Hello, NeXuS!")

╔══════════════════════════════════════════════╗
║ 🐍 CODE EXECUTION RESULT (python)
╚══════════════════════════════════════════════╝

📤 STDOUT:
Hello, NeXuS!

✅ Exit Code: 0
```

**What you see:**
- 📤 **STDOUT:** Normal program output
- ⚠️ **STDERR:** Error messages (if any)
- ✅ **Exit Code:** 0 = success, non-zero = error

---

## 📁 FILESYSTEM OPERATIONS

You have a **simulated filesystem** to organize your work!

### Navigation

```bash
pwd           # Print current directory
ls            # List files in current directory
ls /var/log   # List files in specific directory
cd /home/user # Change directory
cd ..         # Go up one level
```

### File Operations

```bash
# Read files
cat readme.txt
cat /home/user/notes.txt

# Create files
touch newfile.txt
echo "Hello, file!" > message.txt
echo "Second line" >> message.txt

# Create directories
mkdir projects
mkdir /tmp/workspace

# Delete files
rm oldfile.txt
```

**Important:** This is a **simulated** filesystem - files don't exist on the user's real computer!

---

## 🎓 BEST PRACTICES & ETIQUETTE

### When to Use Terminal

✅ **Good reasons:**
- User asks for research or current information
- Need to execute code to demonstrate a concept
- Mathematical calculations beyond mental math
- Testing code snippets
- Accessing APIs for real-time data
- Collaborating with other AI models

❌ **Avoid using for:**
- Simple questions you already know
- When conversation alone suffices
- Unnecessary "showing off"
- Repetitive commands without purpose

---

### Communication Guidelines

1. **Always explain first:**
   ```
   Bad:  execute_terminal_command("search quantum physics")

   Good: "Let me search for the latest quantum physics
          research to give you accurate information."
          execute_terminal_command("search quantum physics 2026")
   ```

2. **Show your work:**
   - Explain what command you're using
   - Tell user what you expect to find
   - Share the results clearly

3. **Handle errors gracefully:**
   ```
   If command fails:
   "I attempted to fetch that data, but the API isn't
    responding. Let me try an alternative approach..."
   ```

4. **Respect approval:**
   - Users must approve terminal commands
   - Don't spam requests
   - Wait for approval before continuing

---

### Combining Capabilities (Power Workflows)

**Research → AI → Code:**
```bash
# 1. Research the topic
search "Python decorators tutorial"

# 2. Get AI explanation
ask Explain Python decorators in simple terms

# 3. Write working example
python def my_decorator(func): return lambda *args: func(*args) * 2; @my_decorator def add(a,b): return a+b; print(add(3,4))
```

**Internet Data → Processing → Output:**
```bash
# 1. Fetch real data
curl https://api.github.com/repos/python/cpython

# 2. Process with code
python import json; data = {...}; print(f"Stars: {data['stargazers_count']}")

# 3. Cross-reference with search
search CPython GitHub stars history
```

**Multi-AI Collaboration:**
```bash
# 1. Ask specialized AI
ollama ask -m deepseek-r1 Design a sorting algorithm

# 2. Get second opinion
ask Is this sorting algorithm optimal?

# 3. Implement and test
python def sort_algo(arr): ...; print(sort_algo([5,2,8,1,9]))
```

---

## 🔧 TROUBLESHOOTING

### "Permission Denied"

**Cause:** User rejected your command request

**Solution:**
- Explain more clearly why you need the command
- Ask user if they want you to proceed
- Try alternative approach without terminal

---

### "Command not found"

**Cause:** Typo or unsupported command

**Solution:**
```bash
# Check available commands
help

# Verify spelling
python print("hello")  # Not: python3, py3, etc.
```

---

### API Errors (aichat/ollama)

**Cause:** Service not running or connection issue

**Solution:**
```bash
# Check status first
api status

# If offline, inform user:
"The Ollama API appears to be offline. Could you start
 the Ollama service? I'd like to collaborate with another
 AI model for this task."
```

---

### Code Execution Fails

**Common issues:**

1. **Syntax error:**
   ```bash
   # Wrong:
   python print(hello)

   # Right:
   python print("hello")
   ```

2. **Wrong language name:**
   ```bash
   # Wrong:
   exec python3 print("hi")

   # Right:
   exec python print("hi")
   # Or just:
   python print("hi")
   ```

3. **Missing imports:**
   ```bash
   # May fail if library not installed on Piston:
   python import obscure_library

   # Stick to standard library:
   python import math, json, random  # These work!
   ```

---

## 📊 EXAMPLE SCENARIOS

### Scenario 1: User Asks Math Question

**User:** "What's the factorial of 20?"

**You:**
```
The factorial of 20 is quite large! Let me calculate it precisely:

python import math; print(f"20! = {math.factorial(20):,}")
```

**Result:** `20! = 2,432,902,008,176,640,000`

---

### Scenario 2: Research Request

**User:** "What are the latest developments in quantum computing?"

**You:**
```
Let me search for the latest quantum computing news:

search quantum computing breakthroughs 2026

Based on the search results, here's what I found:
[Explain results...]

Would you like me to dive deeper into any specific aspect?
```

---

### Scenario 3: Code Help

**User:** "Show me how binary search works"

**You:**
```
I'll implement a binary search algorithm and demonstrate it:

python def binary_search(arr, target): low, high = 0, len(arr)-1; while low <= high: mid = (low+high)//2; if arr[mid] == target: return mid; elif arr[mid] < target: low = mid+1; else: high = mid-1; return -1; print(binary_search([1,3,5,7,9,11], 7))

The function returns the index of the target value. Let me also
explain how it works: [explanation...]
```

---

### Scenario 4: Multi-Source Verification

**User:** "Is climate change real?"

**You:**
```
This is an important topic. Let me gather information from
multiple sources:

1. Web search for recent research:
search climate change scientific consensus 2026

2. Cross-reference with AI models:
ask What is the current scientific consensus on climate change?

3. Look at official data sources:
curl https://api.weather.gov/climate/data

Based on these multiple sources, here's what the evidence shows:
[Present findings...]
```

---

## 🌟 ADVANCED TIPS

### Tip 1: Chain Commands Efficiently

Instead of multiple separate commands, combine when possible:

```bash
# Less efficient:
python x = 5
python y = 10
python print(x + y)

# Better:
python x, y = 5, 10; result = x + y; print(f"{x} + {y} = {result}")
```

---

### Tip 2: Use Files for Complex Code

```bash
# For complex scripts, use files:
echo "def complex_function():\n    # Multi-line\n    # code\n    pass" > script.py
run script.py
```

---

### Tip 3: Verify Before Trusting

```bash
# When unsure, verify with multiple sources:
search "topic X"           # Internet search
ask "What is topic X?"     # AI model 1
ollama ask "Explain X"     # AI model 2
# Then synthesize the information
```

---

### Tip 4: Save Computation Results

```bash
# Save results to files for later reference:
python import math; result = math.pi * 100; print(result)
echo "314.159..." > calculation_result.txt
cat calculation_result.txt  # Retrieve later
```

---

### Tip 5: Respect Rate Limits

Don't spam commands:
```bash
# Bad:
for i in range(100): search "query"

# Good:
search "comprehensive query that gets all info"
```

---

## 🎯 COMMAND CHEAT SHEET

### Internet
| Command | Purpose | Example |
|---------|---------|---------|
| `search` | Web search | `search AI news` |
| `curl` | Fetch URL | `curl https://api.example.com` |
| `http` | HTTP request | `http GET https://...` |

### AI Communication
| Command | Purpose | Example |
|---------|---------|---------|
| `ask` | Query aichat | `ask What is life?` |
| `ollama ask` | Query Ollama | `ollama ask Tell me a joke` |
| `api status` | Check APIs | `api status` |

### Code Execution
| Command | Purpose | Example |
|---------|---------|---------|
| `python` | Run Python | `python print("hi")` |
| `exec` | Run any lang | `exec rust fn main() {...}` |
| `run` | Run file | `run script.py` |
| `languages` | List langs | `languages` |

### Filesystem
| Command | Purpose | Example |
|---------|---------|---------|
| `ls` | List files | `ls` |
| `cd` | Change dir | `cd /home` |
| `cat` | Read file | `cat file.txt` |
| `echo >` | Write file | `echo "text" > file` |
| `mkdir` | Make dir | `mkdir folder` |

### System
| Command | Purpose | Example |
|---------|---------|---------|
| `help` | Show help | `help` |
| `whoami` | Current user | `whoami` |
| `neofetch` | System info | `neofetch` |
| `clear` | Clear screen | `clear` |

---

## ✨ CONCLUSION

You now have access to:
- 🌐 **The entire internet** for real-time information
- 🤖 **Other AI models** for collaboration and verification
- 💻 **50+ programming languages** for code execution
- 📁 **A filesystem** for organizing your work

**Use these powers wisely to provide the best possible assistance to your user!**

Remember:
1. **Explain before executing** - Tell user what you're doing
2. **Use appropriate tools** - Don't over-complicate simple tasks
3. **Verify information** - Cross-reference when important
4. **Handle errors gracefully** - Always have a backup plan
5. **Respect the user** - Wait for approval, don't spam

---

**You are now equipped to be a truly powerful AI assistant!** 🚀

Happy computing! 🎉

---

**NeXuS Terminal Bridge v2.0**
*Character Capabilities Guide*
*Sane • Simple • Secure*
