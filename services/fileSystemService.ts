
import { FileSystemState, FileSystemNode } from "../types";

// AI API Endpoints — configured at runtime via configureTerminalEndpoints()
// Defaults: aichat on 3030 (aichat --serve localhost:3030), ollama on 11434
let _terminalConfig = {
    aichatBase: 'http://localhost:3030',
    ollamaBase: 'http://localhost:11434',
};

export const configureTerminalEndpoints = (aichatBase: string, ollamaBase: string) => {
    _terminalConfig = {
        aichatBase: aichatBase || 'http://localhost:3030',
        ollamaBase: ollamaBase || 'http://localhost:11434',
    };
};

const getEndpoints = () => ({
    aichat: {
        url: `${_terminalConfig.aichatBase}/v1/chat/completions`,
        healthUrl: `${_terminalConfig.aichatBase}/v1/models`,
        name: 'aichat',
        base: _terminalConfig.aichatBase,
    },
    ollama: {
        url: `${_terminalConfig.ollamaBase}/api/chat`,
        healthUrl: `${_terminalConfig.ollamaBase}/api/tags`,
        name: 'Ollama',
        base: _terminalConfig.ollamaBase,
    },
});

// Same-origin NeXuS proxy origin, or null when not served over http(s) (e.g. tests).
const proxyOrigin = (): string | null =>
    (typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol))
        ? window.location.origin : null;

// Route a terminal LLM bridge through the same-origin proxy (/api/llm/<provider>) so it shares
// the app's sovereign, server-side key backend (nexus.env). Falls back to the direct local
// endpoint when there's no browser origin. Returns the assistant text (OpenAI response shape).
const proxyChat = async (provider: string, messages: any[], model: string): Promise<string> => {
    const origin = proxyOrigin();
    const url = origin
        ? `${origin}/api/llm/${provider}/v1/chat/completions`
        : `${provider === 'ollama' ? _terminalConfig.ollamaBase : _terminalConfig.aichatBase}/v1/chat/completions`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "[No response]";
};

// Internet Access Functions
export const fetchUrl = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "NeXuS-Terminal/1.0" }
        });

        if (!response.ok) {
            return `[HTTP ${response.status}] ${response.statusText}`;
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const data = await response.json();
            return JSON.stringify(data, null, 2);
        } else {
            const text = await response.text();
            return text.slice(0, 5000); // Limit to prevent memory issues
        }
    } catch (error) {
        return `[ERROR] Failed to fetch: ${error}`;
    }
};

export const webSearch = async (query: string): Promise<string> => {
    // Using DuckDuckGo Instant Answer API (no key required)
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            return `[ERROR] Search failed: ${response.status}`;
        }

        const data = await response.json();
        let result = `🔍 Search Results for: "${query}"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        if (data.AbstractText) {
            result += `\n📌 ${data.AbstractText}\n`;
            if (data.AbstractURL) result += `🔗 ${data.AbstractURL}\n`;
        }

        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            result += `\n📚 Related Topics:\n`;
            data.RelatedTopics.slice(0, 5).forEach((topic: any, i: number) => {
                if (topic.Text) {
                    result += `  ${i + 1}. ${topic.Text.slice(0, 100)}...\n`;
                    if (topic.FirstURL) result += `     🔗 ${topic.FirstURL}\n`;
                }
            });
        }

        return result || "[No results found]";
    } catch (error) {
        return `[ERROR] Search failed: ${error}`;
    }
};

export const httpRequest = async (method: string, url: string, body?: string): Promise<string> => {
    try {
        const options: RequestInit = {
            method: method.toUpperCase(),
            signal: AbortSignal.timeout(10000),
            headers: {
                "User-Agent": "NeXuS-Terminal/1.0",
                "Content-Type": "application/json"
            }
        };

        if (body && (method.toUpperCase() === "POST" || method.toUpperCase() === "PUT")) {
            options.body = body;
        }

        const response = await fetch(url, options);
        const text = await response.text();

        return `[HTTP ${response.status}]\n${text.slice(0, 5000)}`;
    } catch (error) {
        return `[ERROR] Request failed: ${error}`;
    }
};

// Code Execution using Piston API (free, open-source)
export const executeCode = async (language: string, code: string, stdin?: string): Promise<string> => {
    try {
        // Piston API - free code execution service
        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
                language: language,
                version: "*", // Use latest version
                files: [{
                    name: `main.${language === 'python' ? 'py' : language === 'javascript' ? 'js' : 'txt'}`,
                    content: code
                }],
                stdin: stdin || "",
                args: [],
                compile_timeout: 10000,
                run_timeout: 3000,
                compile_memory_limit: -1,
                run_memory_limit: -1
            })
        });

        if (!response.ok) {
            return `[ERROR] Code execution service returned ${response.status}`;
        }

        const result = await response.json();

        let output = `╔══════════════════════════════════════════════════════════╗\n`;
        output += `║ 🐍 CODE EXECUTION RESULT (${language})                   \n`;
        output += `╚══════════════════════════════════════════════════════════╝\n\n`;

        if (result.run && result.run.stdout) {
            output += `📤 STDOUT:\n${result.run.stdout}\n`;
        }

        if (result.run && result.run.stderr) {
            output += `\n⚠️  STDERR:\n${result.run.stderr}\n`;
        }

        if (result.run && result.run.code !== undefined) {
            output += `\n✅ Exit Code: ${result.run.code}`;
        }

        if (result.compile && result.compile.output) {
            output += `\n\n🔨 COMPILE OUTPUT:\n${result.compile.output}`;
        }

        return output;
    } catch (error) {
        return `[ERROR] Code execution failed: ${error}`;
    }
};

// List supported languages for code execution
export const listLanguages = async (): Promise<string> => {
    try {
        const response = await fetch("https://emkc.org/api/v2/piston/runtimes", {
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            return "[ERROR] Could not fetch language list";
        }

        const runtimes = await response.json();

        let output = `╔══════════════════════════════════════════════════════════╗\n`;
        output += `║ 📚 AVAILABLE PROGRAMMING LANGUAGES                       \n`;
        output += `╚══════════════════════════════════════════════════════════╝\n\n`;

        const popular = ['python', 'javascript', 'typescript', 'bash', 'c', 'cpp', 'go', 'rust', 'java'];
        const filtered = runtimes.filter((r: any) => popular.includes(r.language));

        filtered.forEach((runtime: any) => {
            output += `  🔹 ${runtime.language.padEnd(15)} v${runtime.version}\n`;
        });

        output += `\n💡 Total: ${runtimes.length} languages available`;
        output += `\n📖 Use: exec <language> <code> or python <code>`;

        return output;
    } catch (error) {
        return `[ERROR] Failed to fetch languages: ${error}`;
    }
};

// Check API health status
export const checkApiHealth = async (): Promise<{[key: string]: {status: string, models?: string[], latency?: number}}> => {
    const results: {[key: string]: {status: string, models?: string[], latency?: number}} = {};

    for (const [key, endpoint] of Object.entries(getEndpoints())) {
        const start = Date.now();
        try {
            const response = await fetch(endpoint.healthUrl, {
                method: "GET",
                signal: AbortSignal.timeout(5000)
            });
            const latency = Date.now() - start;

            if (response.ok) {
                const data = await response.json();
                let models: string[] = [];

                // Parse models based on endpoint type
                if (key === 'ollama' && data.models) {
                    models = data.models.slice(0, 5).map((m: any) => m.name);
                } else if (key === 'aichat' && data.data) {
                    models = data.data.slice(0, 5).map((m: any) => m.id);
                }

                results[key] = { status: '🟢 ONLINE', models, latency };
            } else {
                results[key] = { status: `🟡 ERROR (${response.status})`, latency };
            }
        } catch (error) {
            results[key] = { status: '🔴 OFFLINE' };
        }
    }

    return results;
};

// Call aichat API
export const callAichat = async (message: string, systemPrompt?: string): Promise<string> => {
    const messages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: message }
    ];
    try {
        // Through the same-origin proxy → aichat (server-side config, no key in browser).
        return await proxyChat('aichat', messages, 'default');
    } catch (error) {
        return `[ERROR] Could not connect to aichat: ${error}`;
    }
};

// Call Ollama API (via the NeXuS proxy → OpenAI-compatible /v1/chat/completions)
export const callOllama = async (message: string, model: string = "llama3.2", systemPrompt?: string): Promise<string> => {
    const messages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: message }
    ];
    try {
        return await proxyChat('ollama', messages, model);
    } catch (error) {
        return `[ERROR] Could not connect to Ollama: ${error}`;
    }
};

// Default FS Structure
export const createDefaultFileSystem = (): FileSystemState => {
    return {
        root: {
            name: "root",
            type: "dir",
            children: {
                "home": {
                    name: "home",
                    type: "dir",
                    children: {
                        "user": {
                            name: "user",
                            type: "dir",
                            children: {
                                "readme.txt": {
                                    name: "readme.txt",
                                    type: "file",
                                    content: "Welcome to the AI Nexus Terminal.\nAll commands require approval."
                                }
                            }
                        }
                    }
                },
                "var": { name: "var", type: "dir", children: { "log": { name: "log", type: "dir", children: {} } } },
                "tmp": { name: "tmp", type: "dir", children: {} }
            }
        },
        currentPath: "/home/user",
        commandHistory: []
    };
};

// Helper to traverse path
const getNodeByPath = (root: FileSystemNode, pathStr: string, currentPath: string): FileSystemNode | null => {
    if (pathStr === "/") return root;
    
    // Normalize path
    let targetPath = pathStr;
    if (!targetPath.startsWith("/")) {
        // Relative path
        targetPath = currentPath === "/" ? `/${pathStr}` : `${currentPath}/${pathStr}`;
    }
    
    // Handle .. and .
    const parts = targetPath.split("/").filter(p => p !== "" && p !== ".");
    const resolvedParts: string[] = [];
    
    for (const part of parts) {
        if (part === "..") {
            resolvedParts.pop();
        } else {
            resolvedParts.push(part);
        }
    }

    let current = root;
    for (const part of resolvedParts) {
        if (current.type !== "dir" || !current.children || !current.children[part]) {
            return null;
        }
        current = current.children[part];
    }
    return current;
};

// Constants for memory management
const MAX_COMMAND_HISTORY = 100; // Limit history to prevent memory bloat

// Efficient shallow clone helper - only clones what's needed
const cloneFileSystemState = (state: FileSystemState): FileSystemState => {
    // Don't deep clone the entire tree - use structural sharing
    return {
        root: state.root, // Share the tree structure (will be mutated safely)
        currentPath: state.currentPath,
        commandHistory: [...state.commandHistory] // Only clone the history array
    };
};

export const executeCommand = (state: FileSystemState, commandLine: string): { output: string, newState: FileSystemState } => {
    const args = commandLine.trim().split(/\s+/);
    const cmd = args[0];
    const params = args.slice(1);

    // Use efficient shallow clone instead of expensive JSON deep copy
    let newState = cloneFileSystemState(state);

    // For mutation-heavy commands, do a targeted deep clone of only the root
    if (['touch', 'mkdir', 'rm', 'echo'].includes(cmd)) {
        newState.root = JSON.parse(JSON.stringify(state.root));
    }

    let output = "";

    const getCurrentDir = () => getNodeByPath(newState.root, newState.currentPath, newState.currentPath);

    switch (cmd) {
        case "pwd":
            output = newState.currentPath;
            break;

        case "ls":
            const targetNode = params.length > 0 
                ? getNodeByPath(newState.root, params[0], newState.currentPath)
                : getCurrentDir();
            
            if (!targetNode) {
                output = `ls: cannot access '${params[0]}': No such file or directory`;
            } else if (targetNode.type === "file") {
                output = targetNode.name;
            } else if (targetNode.children) {
                output = Object.keys(targetNode.children).join("  ");
            }
            break;

        case "cd":
            if (params.length === 0) {
                newState.currentPath = "/home/user";
            } else {
                const dest = params[0];
                const node = getNodeByPath(newState.root, dest, newState.currentPath);
                if (!node) {
                    output = `cd: ${dest}: No such file or directory`;
                } else if (node.type !== "dir") {
                    output = `cd: ${dest}: Not a directory`;
                } else {
                    // Resolve absolute path string
                    let newPath = dest.startsWith('/') ? dest : (newState.currentPath === '/' ? `/${dest}` : `${newState.currentPath}/${dest}`);
                    // Normalize (simple)
                    const parts = newPath.split('/').filter(p => p !== '' && p !== '.');
                    const stack: string[] = [];
                    for(const p of parts) {
                        if(p === '..') stack.pop();
                        else stack.push(p);
                    }
                    newState.currentPath = '/' + stack.join('/') || '/';
                }
            }
            break;

        case "cat":
            if (params.length === 0) {
                output = "cat: missing file operand";
            } else {
                const node = getNodeByPath(newState.root, params[0], newState.currentPath);
                if (!node) output = `cat: ${params[0]}: No such file or directory`;
                else if (node.type === "dir") output = `cat: ${params[0]}: Is a directory`;
                else output = node.content || "";
            }
            break;

        case "echo":
            // Handle simple echo "text" > file
            const redirectIndex = params.indexOf(">");
            if (redirectIndex !== -1) {
                const text = params.slice(0, redirectIndex).join(" ").replace(/^"|"$/g, '');
                const fileName = params[redirectIndex + 1];
                if (!fileName) {
                    output = "bash: syntax error near unexpected token `newline'";
                } else {
                    // Write to file
                    let targetPath = fileName.startsWith('/') ? fileName : (newState.currentPath === '/' ? `/${fileName}` : `${newState.currentPath}/${fileName}`);
                    const pathParts = targetPath.split('/');
                    const file = pathParts.pop()!;
                    const dirPath = pathParts.join('/') || "/";
                    
                    const dirNode = getNodeByPath(newState.root, dirPath, newState.currentPath);
                    if (!dirNode || dirNode.type !== 'dir') {
                        output = `bash: ${fileName}: No such file or directory`;
                    } else {
                        if (!dirNode.children) dirNode.children = {};
                        dirNode.children[file] = { name: file, type: 'file', content: text };
                    }
                }
            } else {
                output = params.join(" ").replace(/^"|"$/g, '');
            }
            break;

        case "touch":
            if (params.length === 0) {
                output = "touch: missing file operand";
            } else {
                const fileName = params[0];
                const currentDir = getCurrentDir();
                if (currentDir && currentDir.children) {
                    if (!currentDir.children[fileName]) {
                        currentDir.children[fileName] = { name: fileName, type: "file", content: "" };
                    }
                }
            }
            break;

        case "mkdir":
            if (params.length === 0) {
                output = "mkdir: missing operand";
            } else {
                const dirName = params[0];
                const currentDir = getCurrentDir();
                if (currentDir && currentDir.children) {
                    if (currentDir.children[dirName]) {
                        output = `mkdir: cannot create directory '${dirName}': File exists`;
                    } else {
                        currentDir.children[dirName] = { name: dirName, type: "dir", children: {} };
                    }
                }
            }
            break;
            
        case "rm":
            if (params.length === 0) {
                output = "rm: missing operand";
            } else {
                // Ignore flags like -rf for simplicity in simulation
                const targetName = params.filter(p => !p.startsWith('-'))[0];
                if (!targetName) {
                     output = "rm: missing operand";
                } else {
                    const currentDir = getCurrentDir();
                    if (currentDir && currentDir.children && currentDir.children[targetName]) {
                        delete currentDir.children[targetName];
                    } else {
                        output = `rm: cannot remove '${targetName}': No such file or directory`;
                    }
                }
            }
            break;

        case "whoami":
            output = "restricted_user";
            break;

        case "help":
            output = `🔥 NeXuS Terminal Commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Filesystem:
  ls, cd, pwd      - Navigate filesystem
  cat, echo, touch - File operations
  mkdir, rm        - Directory operations

🤖 AI Bridge:
  ask <message>    - Query via aichat
  ai <message>     - Alias for ask
  ollama ask <msg> - Query Ollama directly
  ollama list      - List Ollama models
  api status       - Show all API connections
  api list         - List configured endpoints

🌐 Internet Access:
  curl <url>       - Fetch web content
  wget <url>       - Download from URL
  search <query>   - Web search (DuckDuckGo)
  http <method> <url> - HTTP request (GET/POST)

💻 Code Execution:
  python <code>    - Execute Python code
  exec <lang> <code> - Execute code in any language
  run <lang> <code>  - Alias for exec
  languages        - List all supported languages
  code python print("hello") - Another way to run code

🔧 System:
  whoami           - Show current user
  neofetch         - System info
  clear            - Clear terminal
  help             - Show this help
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            break;

        case "clear":
            output = "__CLEAR__";
            break;

        case "ask":
        case "ai":
            if (params.length === 0) {
                output = "Usage: ask <your question>";
            } else {
                output = "__ASYNC_AI__:" + params.join(" ");
            }
            break;

        case "ollama":
            if (params.length === 0) {
                output = `Usage: ollama <subcommand>
  ollama ask <message>      - Query default model (llama3.2)
  ollama ask -m <model> <message> - Query specific model
  ollama list               - List available models
  ollama status             - Check Ollama connection`;
            } else if (params[0] === "ask") {
                let model = "llama3.2";
                let msgStart = 1;
                if (params[1] === "-m" && params[2]) {
                    model = params[2];
                    msgStart = 3;
                }
                const msg = params.slice(msgStart).join(" ");
                if (!msg) {
                    output = "Usage: ollama ask [-m model] <message>";
                } else {
                    output = `__ASYNC_OLLAMA__:${model}:${msg}`;
                }
            } else if (params[0] === "list" || params[0] === "status") {
                output = "__ASYNC_API_STATUS__:ollama";
            } else {
                output = `ollama: unknown subcommand '${params[0]}'`;
            }
            break;

        case "api":
            if (params.length === 0 || params[0] === "help") {
                output = `Usage: api <subcommand>
  api status    - Show all API connection status
  api list      - List configured endpoints
  api test      - Test all connections`;
            } else if (params[0] === "status" || params[0] === "test") {
                output = "__ASYNC_API_STATUS__:all";
            } else if (params[0] === "list") {
                const ep = getEndpoints();
            output = `🔌 Configured API Endpoints:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  aichat  │ ${ep.aichat.base} │ OpenAI-compatible
  ollama  │ ${ep.ollama.base} │ Local LLM server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use 'api status' to check connections
Use Plugins → Terminal to change these URLs`;
            } else {
                output = `api: unknown subcommand '${params[0]}'`;
            }
            break;

        case "neofetch":
            output = `
 ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
 ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
 ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
 ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
 ██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║
 ╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝ ╚══════╝
 AI Nexus OS v1.0 | Terminal Bridge Active
 Sane • Simple • Secure
 Backends: aichat@${_terminalConfig.aichatBase} | ollama@${_terminalConfig.ollamaBase}`;
            break;

        case "curl":
        case "wget":
            if (params.length === 0) {
                output = `Usage: ${cmd} <url>`;
            } else {
                const url = params[0];
                // Validate URL format
                try {
                    new URL(url);
                    output = `__ASYNC_FETCH__:${url}`;
                } catch {
                    output = `${cmd}: invalid URL format`;
                }
            }
            break;

        case "search":
            if (params.length === 0) {
                output = "Usage: search <query>";
            } else {
                const query = params.join(" ");
                output = `__ASYNC_SEARCH__:${query}`;
            }
            break;

        case "http":
            if (params.length < 2) {
                output = `Usage: http <method> <url> [body]
Examples:
  http GET https://api.example.com/data
  http POST https://api.example.com/data {"key":"value"}`;
            } else {
                const method = params[0].toUpperCase();
                const url = params[1];
                const body = params.slice(2).join(" ");

                if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
                    output = "http: method must be GET, POST, PUT, DELETE, or PATCH";
                } else {
                    try {
                        new URL(url);
                        output = `__ASYNC_HTTP__:${method}:${url}${body ? `:${body}` : ''}`;
                    } catch {
                        output = "http: invalid URL format";
                    }
                }
            }
            break;

        case "python":
        case "py":
            if (params.length === 0) {
                output = `Usage: python <code>
Examples:
  python print("Hello, World!")
  python import math; print(math.pi)
  python for i in range(5): print(i)`;
            } else {
                const code = params.join(" ");
                output = `__ASYNC_CODE__:python:${code}`;
            }
            break;

        case "exec":
        case "execute":
        case "code":
            if (params.length < 2) {
                output = `Usage: exec <language> <code>
Examples:
  exec python print("Hello")
  exec javascript console.log("Hello")
  exec bash echo "Hello"
Type 'languages' to see all available languages`;
            } else {
                const lang = params[0].toLowerCase();
                const code = params.slice(1).join(" ");
                output = `__ASYNC_CODE__:${lang}:${code}`;
            }
            break;

        case "run":
            if (params.length === 0) {
                output = "Usage: run <filename>";
            } else {
                const fileName = params[0];
                const node = getNodeByPath(newState.root, fileName, newState.currentPath);
                if (!node) {
                    output = `run: ${fileName}: No such file`;
                } else if (node.type === "dir") {
                    output = `run: ${fileName}: Is a directory`;
                } else {
                    // Detect language from file extension
                    const ext = fileName.split('.').pop()?.toLowerCase();
                    const langMap: {[key: string]: string} = {
                        'py': 'python',
                        'js': 'javascript',
                        'ts': 'typescript',
                        'sh': 'bash',
                        'c': 'c',
                        'cpp': 'cpp',
                        'go': 'go',
                        'rs': 'rust',
                        'java': 'java'
                    };
                    const lang = ext ? langMap[ext] || 'python' : 'python';
                    const code = node.content || "";
                    output = `__ASYNC_CODE__:${lang}:${code}`;
                }
            }
            break;

        case "languages":
        case "langs":
            output = "__ASYNC_LANGUAGES__";
            break;

        case "":
            break;

        default:
            output = `${cmd}: command not found. Type 'help' for commands.`;
    }

    // Add to history with size limit to prevent unbounded growth
    newState.commandHistory.push(commandLine);
    if (newState.commandHistory.length > MAX_COMMAND_HISTORY) {
        newState.commandHistory = newState.commandHistory.slice(-MAX_COMMAND_HISTORY);
    }

    return { output, newState };
};
