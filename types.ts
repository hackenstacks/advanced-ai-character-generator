
import React from 'react';

// Type declarations for JSON imports to prevent TypeScript from parsing large files
declare module '*.json' {
  const value: any;
  export default value;
}

export interface CryptoKeys {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
}

export interface Message {
  role: 'user' | 'model' | 'narrator' | 'tool';
  content: string;
  timestamp: string;
  characterId?: string; // Identifies which character sent a 'model' message
  attachment?: {
    type: 'image' | 'audio' | 'video';
    status: 'loading' | 'done' | 'error';
    url?: string; // Base64 data URL
    mimeType?: string;
    name?: string;
    prompt?: string;
  };
  // New security fields
  signature?: string; // Signed by user or character's private key
  publicKeyJwk?: JsonWebKey; // Public key of the signer for verification
  
  // Function Calling / Terminal Fields
  toolCallId?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any; // The output of the tool execution
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // For human-in-the-loop
}

export interface UISettings {
  backgroundImage?: string; // Now stores an image ID like 'nexus-image://uuid'
  bannerImage?: string; // Now stores an image ID
  avatarSize?: 'small' | 'medium' | 'large';
}

export interface ChatSession {
  id: string;
  characterIds: string[];
  name: string;
  messages: Message[];
  isArchived?: boolean;
  uiSettings?: UISettings;
  lorebookIds?: string[]; // New: Link to active lorebooks
}

export interface ApiConfig {
  service: 'default' | 'gemini' | 'openai' | 'pollinations' | 'kobold' | 'groq' | 'mistral' | 'openrouter' | 'aichat' | 'ollama' | 'custom';
  apiKey?: string;
  apiEndpoint?: string; // Base URL for OpenAI-compatible
  model?: string;
  rateLimit?: number; // Delay in milliseconds between requests
}

export interface EmbeddingConfig {
  service: 'gemini' | 'openai' | 'huggingface';
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
}

export interface RagSource {
    id: string;
    fileName: string;
    fileType: string;
    createdAt: string;
    data?: string; // Base64 data for images
    // content is stored in vector chunks for text, but we keep metadata here
}

export interface Character {
  id:string;
  name: string;
  description: string;
  personality: string; // Will be used as Role Instruction
  avatarUrl: string; // Now stores an image ID like 'nexus-image://uuid'
  tags: string[];
  createdAt: string;
  apiConfig?: ApiConfig;
  // New fields for more detailed characters
  physicalAppearance?: string;
  personalityTraits?: string; // Comma-separated
  lore?: string[];
  memory?: string;
  
  // Advanced Features
  voiceId?: string; // For GenAI Text-to-Speech (Puck, Kore, etc.)
  searchEnabled?: boolean; // Deep Search — web/local search grounding (provider-agnostic)
  thinkingEnabled?: boolean; // Deep Thinking Mode — extended reasoning
  terminalEnabled?: boolean; // Terminal / Filesystem Access
  transwayEnabled?: boolean; // TransWay Protocol — double-axis MCP: reach out to aichat/Claude/other characters + be reachable
  transwayConfig?: TransWayConfig; // TWP settings (which peers, search backends, auth)
  avatarSize?: number; // Display size of avatar in px (64–512), default 128
  moodAvatarEnabled?: boolean; // Character can swap its own avatar to match mood/tone, pulling from its vault dir
  avatarGallery?: string[]; // Available avatars in this character's vault dir (~/NeXuS/vault/characters/<slug>/avatars/)
  longTermMemoryEnabled?: boolean; // Persist important memories across sessions (encrypted, in vault)
  memoryConfig?: MemoryConfig; // Long-term memory strategy + tuning
  
  voiceURI?: string; // Deprecated: Old Browser TTS
  firstMessage?: string; // New: For character card compatibility
  backstory?: string; // Historical context / origin story (ported from AI Nexus 002 editor)
  characterType?: 'character' | 'narrator'; // New: Distinguish between persona and scenario bots

  // Memory Management — dedicated model for summarization/memory ops (ported from AI Nexus 002)
  summaryApiConfig?: ApiConfig;
  // New RAG fields
  ragEnabled?: boolean;
  embeddingConfig?: EmbeddingConfig;
  knowledgeSourceIds?: string[]; // Link to global knowledge base
  // Deprecated but kept for migration
  ragSources?: RagSource[]; 
  // New per-character plugin fields
  pluginEnabled?: boolean;
  pluginCode?: string;
  // New security fields
  keys?: CryptoKeys; // Character's own signing key pair
  signature?: string; // Signed by the USER's master private key
  userPublicKeyJwk?: JsonWebKey; // User's public key that signed this character
  isArchived?: boolean;
}

// Long-term memory config — tiered, matches the NeXuS character dir standard.
// Persisted encrypted (AES-256-GCM, one password) under $VAULT/characters/<slug>/memory/.
export interface MemoryConfig {
  strategy?: 'window' | 'summary' | 'rag' | 'importance' | 'hierarchical';
  windowSize?: number;          // working-memory turns kept in context (default 12)
  summarizeEvery?: number;      // roll old turns into a summary every N turns (default 20)
  importanceThreshold?: number; // 0–1; only memories scoring above this graduate to long-term
  recencyHalfLifeHours?: number;// recency decay half-life for importance scoring (default 72)
  maxRecall?: number;           // top-k memories retrieved per turn (default 5)
  // External knowledge/lore paths — mounted read-only, indexed into recall.
  lorePaths?: string[];         // dirs/files of lore (e.g. $NEXUS_HOME/lore, a wiki export)
  knowledgePaths?: string[];    // dirs/files of reference knowledge (docs, datasets)
}

// TransWay Protocol — double-axis MCP config.
// Axis OUT: this character can reach aichat / Claude / other characters + search the web before answering.
// Axis IN:  external agents (granted a cert/key) can summon this character.
export interface TransWayConfig {
  // OUTBOUND — who/what this character may consult before responding
  peers?: string[];              // character names this one may call (e.g. ["AIME", "aichat"])
  searchBackends?: ('web' | 'local' | 'both')[]; // deep-search backends (Brave/SearXNG=web, Hister=local)
  consultBeforeAnswer?: boolean; // auto-consult peers + search prior to generating a reply
  // INBOUND — allow external agents (Claude Code, etc.) to summon this character
  reachable?: boolean;           // expose this character over the TWP MCP endpoint
  // AUTH — NeXuS principle: cert OR api key, user grants/revokes
  authMode?: 'cert' | 'apikey';  // default 'apikey'
  mcpEndpoint?: string;          // TWP server, default http://127.0.0.1:9000/twp
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  code: string;
  enabled: boolean;
  settings?: {
    [key:string]: any;
  };
}

export interface LorebookEntry {
    id: string;
    keys: string[];
    content: string;
}

export interface Lorebook {
    id: string;
    name: string;
    description: string;
    entries: LorebookEntry[];
}

// File System Types
export interface FileSystemNode {
    name: string;
    type: 'file' | 'dir';
    content?: string; // For files
    children?: { [name: string]: FileSystemNode }; // For dirs
    parentId?: string | null;
}

export interface FileSystemState {
    root: FileSystemNode;
    currentPath: string;
    commandHistory: string[];
}

export interface AppData {
  characters: Character[];
  chatSessions: ChatSession[];
  plugins?: Plugin[];
  lorebooks?: Lorebook[]; 
  knowledgeBase?: RagSource[]; // New: Centralized document library
  // New security field
  userKeys?: CryptoKeys;
  // New: Persistent File System
  fileSystem?: FileSystemState;
}

// Types for the secure plugin API bridge
export type GeminiApiRequest = 
  | { type: 'generateContent'; prompt: string }
  | { type: 'generateImage'; prompt: string, settings?: { [key: string]: any } };

export interface PluginApiRequest {
  ticket: number;
  apiRequest: GeminiApiRequest;
}

export interface PluginApiResponse {
  ticket: number;
  result?: any;
  error?: string;
}

// RAG Types
export interface VectorChunk {
    id: string; // chunk-[uuid]
    characterId?: string; // Deprecated: chunks are now source-centric
    sourceId: string;
    content: string;
    embedding: number[];
}

// Type for the new confirmation modal
export interface ConfirmationRequest {
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface VaultItem {
  id: string;
  parentId: string;
  name: string;
  type: 'file' | 'folder';
  createdAt: string;
  // File-specific fields
  mimeType?: string;
  content?: string;
  size?: number;
}
