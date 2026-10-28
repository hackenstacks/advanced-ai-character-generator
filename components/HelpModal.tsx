import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-6">
    <h2 className="text-2xl font-bold text-primary-500 border-b-2 border-border-neutral pb-2 mb-3">{title}</h2>
    <div className="space-y-3 text-text-primary">{children}</div>
  </section>
);

const HelpSubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mt-4 pl-4 border-l-4 border-border-neutral">
        <h3 className="text-xl font-semibold text-text-primary mb-2">{title}</h3>
        <div className="space-y-2 text-text-secondary">{children}</div>
    </div>
);


export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background-secondary rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-border-neutral flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">AI Nexus Help Center</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors text-2xl font-bold leading-none p-1">&times;</button>
        </header>
        <div className="flex-1 p-6 overflow-y-auto">
            
            <HelpSection title="Getting Started">
                <p>Welcome to AI Nexus! This guide will help you understand all the features of the application.</p>
                <HelpSubSection title="The Master Password">
                    <p>On your first visit, AI Nexus prompts you to create a Master Password. This password is crucial as it encrypts all your application data (characters, chats, plugins) before saving it to your browser's local database (IndexedDB).</p>
                    <p className="font-bold text-accent-yellow">This is a zero-knowledge system. If you forget your password, there is no way to recover it. Your data will be inaccessible.</p>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="🔐 AI Providers &amp; API Keys (server-side)">
                <p>AI Nexus is served by the <strong>NeXuS Web Server</strong>, which keeps every API key on the server and injects it into requests for you. <strong>You never enter an API key in the browser.</strong> In a character's <em>Chat API Configuration</em> (and the image plugin) you only pick a <strong>provider</strong> and a <strong>model</strong> — the provider list and model lists are pulled live from the server, and each provider shows <code className="bg-background-tertiary px-1 rounded">✓ ready</code> / <code className="bg-background-tertiary px-1 rounded">✓ free</code> / <code className="bg-background-tertiary px-1 rounded">🔒 no key</code>.</p>
                <HelpSubSection title="Where keys live">
                    <p>All secrets live in one file: <code className="bg-background-tertiary px-1 rounded">~/.config/nexus/secrets/nexus.env</code> (chmod 600, never committed, never served). A project may override it with a local <code className="bg-background-tertiary px-1 rounded">.local.env</code>.</p>
                </HelpSubSection>
                <HelpSubSection title="Adding a provider (no code)">
                    <p>Declare any OpenAI-compatible endpoint in <code className="bg-background-tertiary px-1 rounded">nexus.env</code> and it appears in the dropdown automatically:</p>
                    <pre className="bg-background-tertiary p-2 rounded text-xs overflow-x-auto">PROVIDER_MYLLM_BASE_URL=https://host/v1{"\n"}PROVIDER_MYLLM_API_KEY=sk_...{"\n"}PROVIDER_MYLLM_LABEL=My LLM</pre>
                    <p className="text-text-secondary text-sm">Keyless providers (AI Horde, local Ollama/aichat) need no key. See the NeXuS Web Server help file for the full 100% setup.</p>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="Data Management & Compatibility">
                 <p>AI Nexus is designed to be open and compatible. You have full control over your data.</p>
                <HelpSubSection title="Smart Import">
                    <p>Click the `Import` button in the sidebar to open a file picker. AI Nexus automatically detects what you are importing:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Character Card (.json):</strong> Imports a character from another platform (like SillyTavern, Chub, etc.). This will add the character to your list without overwriting other data.</li>
                        <li><strong>Lorebook / World Info (.json):</strong> Imports a compatible lorebook file, such as those used in SillyTavern.</li>
                        <li><strong>Chat Session (.json):</strong> Imports a chat history file that was exported from AI Nexus.</li>
                        <li><strong>Full Backup (.json):</strong> A full backup file from AI Nexus. Importing this will ask for confirmation before overwriting all your current data.</li>
                    </ul>
                </HelpSubSection>
                 <HelpSubSection title="Granular Export">
                    <p>You can export data in several ways:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Export Character:</strong> Click the download icon next to any character's name to save them as a universal `.json` character card.</li>
                         <li><strong>Export Lorebook:</strong> Go to the Lorebook manager and click the download icon next to any lorebook.</li>
                        <li><strong>Export Chat:</strong> Click the download icon next to any chat's name to save the conversation history as a `.json` file.</li>
                        <li><strong>Save Backup:</strong> Click the `Save Backup` button in the sidebar to save a full backup of your entire instance.</li>
                    </ul>
                 </HelpSubSection>
            </HelpSection>
            
             <HelpSection title="Lorebooks (World Info)">
                <p>Lorebooks are collections of information about your world, its characters, items, or rules. They make your AI characters knowledgeable and consistent without needing to manually remind them of details.</p>
                <HelpSubSection title="How It Works">
                     <p>You can create Lorebooks in the `Lorebooks` section (globe icon in the sidebar). Each Lorebook contains entries, and each entry has a set of **keywords** and some **content**.</p>
                     <p>When you start a new chat, you can **attach** one or more Lorebooks. As you talk, if a keyword from an attached lorebook appears in the recent conversation, its content is invisibly added to the AI's context for its next response. This gives the AI the information it needs, right when it needs it.</p>
                     <p>For example, you could have an entry with keywords `["The Crystal of Zarthus", "crystal"]` and content describing the crystal's magical properties. Whenever you mention the crystal, the AI will automatically know what it is.</p>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="The Chat Interface">
                 <p>Select or create a chat to begin a conversation. You can create chats with a single character or a group of characters for complex interactions.</p>
                 <HelpSubSection title="👥 Character Management">
                    <p>Manage characters during active chats:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Add Characters:</strong> Click the character icon in the top-right to add more characters to an existing chat</li>
                        <li><strong>Remove Characters:</strong> Manage character participation through the chat settings</li>
                        <li><strong>Dynamic Groups:</strong> Characters can join/leave conversations as needed</li>
                        <li><strong>File Access:</strong> New characters gain access to files already in the chat</li>
                    </ul>
                </HelpSubSection>
                 <HelpSubSection title="Slash Commands">
                    <p>Use slash commands in the chat input for special actions:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-background-tertiary px-1 rounded">/image [prompt]</code> - Generates an image.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/narrate [prompt]</code> - Adds a narrative description to the scene.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/snapshot</code> or <code className="bg-background-tertiary px-1 rounded">/memorize</code> - Summarizes recent events and saves them to the characters' long-term memory.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/save</code> - Triggers a download of a full application backup file.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/sys [instruction]</code> - Provides a one-time system instruction for the AI's next response.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/character [name] [prompt]</code> - Address a specific character in a group chat.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/converse [optional topic]</code> - (Group chats only) AIs will start talking to each other.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/pause</code> - Pauses an ongoing AI conversation.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/resume</code> - Resumes a paused AI conversation.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">/end</code> or <code className="bg-background-tertiary px-1 rounded">/quit</code> - Stops an ongoing AI conversation.</li>
                    </ul>
                 </HelpSubSection>
                 <HelpSubSection title="Action Buttons">
                    <p>Next to the input field, you'll find powerful action buttons:</p>
                    <ul className="list-disc list-inside space-y-2">
                       <li><strong>Import Memory (Brain Icon):</strong> Allows a character to "remember" things from other chats. Click it, select another chat session, and any shared characters will have their memories from that session appended to their current memory. Great for continuity across different scenarios.</li>
                       <li><strong>Narrator (Book Icon):</strong>
                           <br/>- **Single-Click:** Prompts you to enter a narration instruction (e.g., "Describe the weather changing").
                           <br/>- **Double-Click:** The AI narrates the current situation based on the last few messages.
                       </li>
                       <li><strong>Image Generation (Image Icon):</strong>
                           <br/>- **Single-Click:** Prompts you to enter a prompt for image generation.
                           <br/>- **Double-Click:** The AI creates an image prompt by summarizing the recent chat context.
                       </li>
                       <li><strong>Text-to-Speech (Speaker Icon):</strong>
                           <br/>- A speaker icon appears on every message; click it to read that message aloud.
                           <br/>- In the chat header, a master TTS toggle will automatically read new AI responses as they arrive.
                       </li>
                    </ul>
                 </HelpSubSection>
            </HelpSection>

            <HelpSection title="🖥️ Character Terminal (aichat bridge)">
                <p>Characters with <strong>Terminal Access</strong> enabled (toggle it in the Character editor) get a sandboxed in-app shell. It bridges to your local <strong>aichat</strong> server (<code className="bg-background-tertiary px-1 rounded">aichat --serve localhost:3030</code>) and <strong>Ollama</strong> (<code className="bg-background-tertiary px-1 rounded">localhost:11434</code>) — fully local, no cloud required. Endpoints are configurable.</p>
                <p className="text-text-secondary text-sm">Every command runs through an approval prompt for safety. Type <code className="bg-background-tertiary px-1 rounded">help</code> inside the terminal for the live list.</p>
                <HelpSubSection title="🤖 AI Bridge">
                    <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-background-tertiary px-1 rounded">ask [message]</code> / <code className="bg-background-tertiary px-1 rounded">ai [message]</code> - Query via <strong>aichat</strong>.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">ollama ask [msg]</code> - Query an Ollama model directly.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">ollama list</code> - List installed Ollama models.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">api status</code> / <code className="bg-background-tertiary px-1 rounded">api list</code> - Show/list API connections.</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="📁 Filesystem">
                    <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-background-tertiary px-1 rounded">ls</code>, <code className="bg-background-tertiary px-1 rounded">cd</code>, <code className="bg-background-tertiary px-1 rounded">pwd</code> - Navigate the virtual filesystem.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">cat</code>, <code className="bg-background-tertiary px-1 rounded">echo</code>, <code className="bg-background-tertiary px-1 rounded">touch</code> - Read/write files.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">mkdir</code>, <code className="bg-background-tertiary px-1 rounded">rm</code> - Create/remove directories.</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="🌐 Internet Access">
                    <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-background-tertiary px-1 rounded">curl [url]</code> / <code className="bg-background-tertiary px-1 rounded">wget [url]</code> - Fetch web content.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">search [query]</code> - Web search (DuckDuckGo).</li>
                        <li><code className="bg-background-tertiary px-1 rounded">http [method] [url]</code> - Raw HTTP request (GET/POST).</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="💻 Code Execution">
                    <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-background-tertiary px-1 rounded">python [code]</code> - Execute Python.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">exec [lang] [code]</code> / <code className="bg-background-tertiary px-1 rounded">run [lang] [code]</code> - Execute code in any supported language.</li>
                        <li><code className="bg-background-tertiary px-1 rounded">languages</code> - List all supported languages.</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="🔧 System">
                    <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-background-tertiary px-1 rounded">whoami</code>, <code className="bg-background-tertiary px-1 rounded">neofetch</code>, <code className="bg-background-tertiary px-1 rounded">clear</code>, <code className="bg-background-tertiary px-1 rounded">help</code></li>
                    </ul>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="🔒 Nexus Secure Vault - NEW!">
                <p>The Vault is your secure digital storage system for files, documents, and assets. All files are encrypted using your Master Password.</p>
                <HelpSubSection title="Key Features">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>End-to-End Encryption:</strong> All files encrypted with AES-GCM using your Master Password</li>
                        <li><strong>Folder Organization:</strong> Create folders to organize your files</li>
                        <li><strong>File Upload/Download:</strong> Upload and download files with automatic encryption/decryption</li>
                        <li><strong>Secure Sharing:</strong> Create password-protected .nexusvault packages for sharing</li>
                        <li><strong>Import/Export:</strong> Full vault backup and restore functionality</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="📁 Using the Vault">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Open Vault:</strong> Click the Vault icon in the toolbar</li>
                        <li><strong>Upload Files:</strong> Click "Upload File" and select files - they're automatically encrypted</li>
                        <li><strong>Create Folders:</strong> Click "New Folder" to organize your files</li>
                        <li><strong>Download Files:</strong> Select a file and click "Download"</li>
                        <li><strong>Delete Files:</strong> Select a file and click "Delete"</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="🔐 Magic Wormhole Sharing">
                    <p>Securely share files with others using password-protected packages:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Export for Sharing:</strong> Select a file → "Secure Share" → Set password → Generate .nexusvault file</li>
                        <li><strong>Import Shared Files:</strong> Click "Import Secure Pkg" → Enter password → Select .nexusvault file</li>
                        <li><strong>Security:</strong> Files are encrypted with AES-GCM, only accessible with the correct password</li>
                        <li><strong>No Internet Required:</strong> Works via USB drive, email, or any file transfer method</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="📂 File Management Tips">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>My Files:</strong> Your main storage area</li>
                        <li><strong>Not Mine (Incoming):</strong> Files shared with you appear here</li>
                        <li><strong>File Types:</strong> Supports images, documents, text files, and more</li>
                        <li><strong>File Size:</strong> Displays file sizes for easy management</li>
                    </ul>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="📁 Document Library - Enhanced!">
                <p>The Document Library allows you to manage knowledge bases and reference materials for RAG (Retrieval-Augmented Generation).</p>
                <HelpSubSection title="Key Features">
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>File Upload:</strong> Upload PDFs, text files, and other documents</li>
                        <li><strong>RAG Integration:</strong> Documents are automatically processed for AI knowledge</li>
                        <li><strong>Granular Access Control:</strong> Each character must be given explicit access to files</li>
                        <li><strong>Search & Filter:</strong> Easily find documents by name or content</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="🤖 How Files Work in Chats">
                    <p>Files uploaded directly to chats have different behavior than Document Library files:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Chat Uploads:</strong> Files uploaded directly to a chat are instantly available to ALL characters in that chat</li>
                        <li><strong>Document Library:</strong> Files in the library require individual character access setup</li>
                        <li><strong>Contextual Use:</strong> All characters in the chat can reference uploaded files immediately</li>
                        <li><strong>Persistent Access:</strong> File access continues for the duration of the chat session</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="🔧 Setting Up File Access">
                    <p>To give characters access to files:</p>
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Upload files to the Document Library</li>
                        <li>Go to Character Settings for each AI</li>
                        <li>Enable access to specific files/documents</li>
                        <li>Save settings - character now has access</li>
                    </ol>
                </HelpSubSection>
                <HelpSubSection title="💡 Use Case Examples">
                    <p>Creative ways to use selective file access:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Mystery Scenarios:</strong> Give different clues to different characters</li>
                        <li><strong>Role-Specific Knowledge:</strong> Doctors have medical files, engineers have technical docs</li>
                        <li><strong>Progressive Revelation:</strong> Gradually grant access to files as the story unfolds</li>
                        <li><strong>Security Simulations:</strong> Create scenarios with classified information access</li>
                    </ul>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="🧠 Advanced AI Features">
                <p>AI Nexus supports cutting-edge AI capabilities for enhanced interactions.</p>
                <HelpSubSection title="🔍 Google Search Integration">
                    <p>Enable Google Search to give your AIs real-time web knowledge:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Real-time Information:</strong> AIs can access current events and recent data</li>
                        <li><strong>Fact Checking:</strong> Verify information and get up-to-date answers</li>
                        <li><strong>Research Assistance:</strong> AIs can look up complex topics on demand</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="🤔 Deep Thinking Mode">
                    <p>For models that support it (like Gemini 3.0):</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Complex Reasoning:</strong> AIs can perform multi-step logical analysis</li>
                        <li><strong>Problem Solving:</strong> Enhanced capability for complex scenarios</li>
                        <li><strong>Creative Thinking:</strong> More sophisticated creative outputs</li>
                        <li><strong>Model Requirements:</strong> Requires compatible AI models (Gemini 3.0+ recommended)</li>
                    </ul>
                </HelpSubSection>
                <HelpSubSection title="📚 RAG (Retrieval-Augmented Generation)">
                    <p>Enhance AI knowledge with your own documents:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Document Upload:</strong> Add PDFs, text files, and other reference materials</li>
                        <li><strong>Automatic Indexing:</strong> Documents are processed and indexed for AI access</li>
                        <li><strong>Contextual Responses:</strong> AIs use document content when relevant to conversations</li>
                        <li><strong>Knowledge Persistence:</strong> Uploaded knowledge remains available across sessions</li>
                    </ul>
                </HelpSubSection>
            </HelpSection>

            <HelpSection title="Plugin System">
                <p>AI Nexus features TWO plugin systems: Global Plugins and Character Plugins.</p>
                
                <HelpSubSection title="🌍 Global Plugin System">
                    <p>Global plugins affect the entire application and run in all contexts:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Application-Wide:</strong> Affects all characters and chats</li>
                        <li><strong>Image Generation:</strong> Configure default styles, APIs, and settings</li>
                        <li><strong>TTS (Text-to-Speech):</strong> Global voice settings and behavior</li>
                        <li><strong>Access:</strong> Manage in the Plugins section (code icon)</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="🤖 Experimental Character Plugin System">
                    <p>Character plugins extend individual characters with custom JavaScript functionality:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Character-Specific:</strong> Each character can have unique plugins</li>
                        <li><strong>Custom Behavior:</strong> Modify how a character responds or processes information</li>
                        <li><strong>Special Abilities:</strong> Give characters unique skills or knowledge</li>
                        <li><strong>Access:</strong> Configure in each character's settings</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="🔧 Character Plugin Examples">
                    <p>Creative ways to use character plugins:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Specialized Knowledge:</strong> Doctor character with medical calculation plugins</li>
                        <li><strong>Unique Skills:</strong> Hacker character with encryption/decryption plugins</li>
                        <li><strong>Behavior Modifiers:</strong> Character that always responds in rhyme or specific format</li>
                        <li><strong>Context Processors:</strong> Character that analyzes conversation history differently</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="⚠️ Experimental Features">
                    <p>Character plugins are powerful but experimental:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Sandboxed Execution:</strong> Plugins run in isolated environment</li>
                        <li><strong>Performance Impact:</strong> Complex plugins may slow down responses</li>
                        <li><strong>Security First:</strong> All plugins are validated before execution</li>
                        <li><strong>Backup Recommended:</strong> Test plugins before production use</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="📖 Plugin Development">
                    <p>Creating custom character plugins:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>JavaScript Based:</strong> Write plugins in standard JavaScript</li>
                        <li><strong>API Access:</strong> Plugins can use the nexus API for character data</li>
                        <li><strong>Event Hooks:</strong> Respond to message events, memory updates, etc.</li>
                        <li><strong>Testing:</strong> Test plugins in sandbox before deploying</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="⚡ Plugin Execution Flow">
                    <p>Understanding when character plugins fire:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Pre-Response Execution:</strong> Character plugins fire BEFORE the character responds</li>
                        <li><strong>Processing Pipeline:</strong> Plugins can modify the context, memory, or prompt before response generation</li>
                        <li><strong>Response Influence:</strong> Plugin output affects what the character says or knows</li>
                        <li><strong>Execution Order:</strong> Plugins run in sequence - order can be configured</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="🎯 Plugin Use Cases">
                    <p>Practical applications of pre-response plugins:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Context Enhancement:</strong> Add relevant information before character responds</li>
                        <li><strong>Memory Processing:</strong> Modify or filter memory context for responses</li>
                        <li><strong>Behavior Modification:</strong> Adjust character personality based on conversation history</li>
                        <li><strong>Knowledge Injection:</strong> Add specialized knowledge to character's context</li>
                    </ul>
                </HelpSubSection>
                
                <HelpSubSection title="Configuring the Image Generator">
                    <p>The default "Image Generation" plugin is highly configurable. Go to `Plugins` and click its edit icon to:</p>
                    <ul className="list-disc list-inside">
                        <li>Select a preset art style to apply to all generations.</li>
                        <li>Add a global "Negative Prompt" to exclude unwanted elements from images.</li>
                        <li>Set a specific API (e.g., DALL-E via an OpenAI-compatible endpoint) just for image generation, separate from your chat characters.</li>
                    </ul>
                </HelpSubSection>
            </HelpSection>

        </div>
      </div>
    </div>
  );
};