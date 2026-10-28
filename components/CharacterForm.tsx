
import React, { useState, useEffect, useRef } from 'react';
import { Character, ApiConfig, EmbeddingConfig, RagSource } from '../types.ts';
import * as ttsService from '../services/ttsService.ts';
import * as ragService from '../services/ragService.ts';
import { generateContent } from '../services/geminiService.ts';
import { getProvidersByKind, getModels, readinessTag, ProviderInfo } from '../services/providersService.ts';
import { logger } from '../services/loggingService.ts';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { SpinnerIcon } from './icons/SpinnerIcon.tsx';
import { TerminalIcon } from './icons/TerminalIcon.tsx';

interface CharacterFormProps {
  character: Character | null;
  onSave: (character: Character) => void;
  onCancel: () => void;
  onGenerateImage: (prompt: string) => Promise<string | null>;
  availableDocuments: RagSource[];
}

const defaultApiConfig: ApiConfig = {
    service: 'default',
    apiKey: '',
    apiEndpoint: '',
    model: ''
};

const defaultEmbeddingConfig: EmbeddingConfig = {
    service: 'openai', // aichat is OpenAI-compatible
    apiKey: '',
    apiEndpoint: 'http://localhost:3030/v1/embeddings',
    model: 'mistral:mistral-embed'
};

const defaultTranswayConfig = {
    peers: [] as string[],
    searchBackends: ['local'] as ('web' | 'local' | 'both')[],
    consultBeforeAnswer: false,
    reachable: false,
    authMode: 'apikey' as 'cert' | 'apikey',
    mcpEndpoint: 'http://127.0.0.1:9000/twp',
};

const defaultMemoryConfig = {
    strategy: 'importance' as 'window' | 'summary' | 'rag' | 'importance' | 'hierarchical',
    windowSize: 12,
    summarizeEvery: 20,
    importanceThreshold: 0.5,
    recencyHalfLifeHours: 72,
    maxRecall: 5,
    lorePaths: [] as string[],
    knowledgePaths: [] as string[],
};

const API_PRESETS: Record<string, { label: string, service: any, endpoint: string, models: string[], requiresKey: boolean }> = {
    'aihorde_text': {
        label: "🐝 AI Horde (Free — no key needed)",
        service: "aihorde_text",
        endpoint: "https://aihorde.net/api/v2/generate/text/async",
        models: [],  // blank = any available model; enter a specific one if desired
        requiresKey: false
    },
    'aichat': {
        label: "🔥 aichat (Local Bridge)",
        service: "aichat",
        endpoint: "http://localhost:3030/v1/chat/completions",
        models: ["default", "claude", "gpt-4", "mistral"],
        requiresKey: false
    },
    'ollama': {
        label: "🦙 Ollama (Local LLMs)",
        service: "ollama",
        endpoint: "http://localhost:11434/v1/chat/completions",
        models: ["llama3.2", "deepseek-r1:8b", "qwen2.5", "mistral", "phi3"],
        requiresKey: false
    },
    'pollinations': {
        label: "Pollinations.ai (API key)",
        service: "pollinations",
        endpoint: "https://gen.pollinations.ai/v1/chat/completions",
        models: ["openai", "openai-fast", "mistral", "deepseek", "gemini", "llama", "claude"],
        requiresKey: true
    },
    'kobold': {
        label: "KoboldCPP / Local (Free)",
        service: "kobold",
        endpoint: "http://localhost:5001/v1/chat/completions",
        models: ["default", "gemma-2b"],
        requiresKey: false
    },
    'groq': {
        label: "Groq (Free Tier)",
        service: "groq",
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        models: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
        requiresKey: true
    },
    'mistral': {
        label: "Mistral AI",
        service: "mistral",
        endpoint: "https://api.mistral.ai/v1/chat/completions",
        models: ["mistral-tiny", "mistral-small", "mistral-medium", "mistral-large-latest"],
        requiresKey: true
    },
    'openrouter': {
        label: "OpenRouter",
        service: "openrouter",
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        models: ["nousresearch/hermes-3-llama-3.1-405b", "mistralai/mistral-7b-instruct", "microsoft/wizardlm-2-8x22b"],
        requiresKey: true
    },
    'huggingface': {
        label: "Hugging Face (Inference API)",
        service: "openai",
        endpoint: "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct/v1/chat/completions",
        models: ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
        requiresKey: true
    },
    'openai': {
        label: "OpenAI / Compatible",
        service: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions",
        models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
        requiresKey: true
    },
    'custom': {
        // Bring-your-own OpenAI-compatible endpoint. Blank endpoint/model = user fills;
        // key field shows but may be left blank for keyless local servers.
        label: "Custom (bring-your-own endpoint)",
        service: "openai",
        endpoint: "",
        models: [],
        requiresKey: true
    },
    'gemini': {
        label: "Google Gemini (Custom Key)",
        service: "gemini",
        endpoint: "",
        models: ["gemini-2.5-flash", "gemini-3-pro-preview"],
        requiresKey: true
    },
    'default': {
        label: "Default (AI Horde — free)",
        service: "default",
        endpoint: "",
        models: [],
        requiresKey: false
    }
};

// Resolve a preset key from a stored ApiConfig (used to seed the provider dropdowns on load)
const presetKeyFromConfig = (config?: ApiConfig): string => {
    const service = config?.service || 'default';
    if (service === 'default' || service === 'gemini') return service;
    const endpoint = config?.apiEndpoint || '';
    try {
        const match = Object.entries(API_PRESETS).find(([key, cfg]) => {
            if (key === 'default' || key === 'gemini') return false;
            return cfg.endpoint && endpoint.includes(new URL(cfg.endpoint).hostname);
        });
        return match ? match[0] : 'openai';
    } catch {
        return 'openai';
    }
};

const examplePluginCode = `// This code runs in a secure sandbox right before this character generates a response.
// You can use it to dynamically alter their behavior.
// The 'nexus' object provides logging and access to hooks.

nexus.hooks.register('beforeResponseGenerate', (payload) => {
  // The payload contains the data for the upcoming API call.
  // payload: { history: Message[], systemOverride?: string }

  nexus.log('Character plugin is running...');

  // Example: Make the character always respond in a pirate accent.
  const pirateInstruction = 'For this response, you must speak like a pirate.';

  if (payload.systemOverride) {
    // If an override already exists (e.g., from a /sys command), append to it.
    payload.systemOverride += \`\\n\${pirateInstruction}\`;
  } else {
    payload.systemOverride = pirateInstruction;
  }

  // You must return the modified payload object.
  return payload;
});
`;

const Section: React.FC<{ title: string, children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="rounded-md border border-border-neutral bg-background-secondary/50">
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full text-left p-4 flex justify-between items-center">
                <h3 className="text-lg font-medium text-text-primary">{title}</h3>
                <svg className={`w-5 h-5 text-text-secondary transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOpen && <div className="p-4 border-t border-border-neutral space-y-4">{children}</div>}
        </div>
    );
}

type TabKey = 'basic' | 'details' | 'advanced' | 'memory';

// AI generation prompt templates for per-field "✨ Generate" buttons ({{name}}/{{desc}} substituted)
const GEN_TEMPLATES: Record<string, string> = {
    description: "Write a vivid one-paragraph description for a fictional AI character named {{name}}. Context so far: {{desc}}. Return ONLY the description text, no preamble.",
    firstMessage: "Write an in-character opening greeting that {{name}} would send to start a conversation. Context: {{desc}}. Return ONLY the message text, in character.",
    physicalAppearance: "Describe the physical appearance of a fictional character named {{name}} in vivid, concrete detail. Context: {{desc}}. Return ONLY the description.",
    personalityTraits: "List 6-10 concise personality traits (comma-separated, no other text) for a character named {{name}}. Context: {{desc}}.",
    personality: "Write a detailed system prompt / role instruction for an AI character named {{name}}. Context: {{desc}}. Describe their personality, quirks, speaking style, and behavioral guidelines. Return ONLY the instruction text.",
    backstory: "Write a compelling backstory (2-3 short paragraphs) for a character named {{name}}. Context: {{desc}}. Cover their origin, key life events, and motivations. Return ONLY the backstory.",
};

export const CharacterForm: React.FC<CharacterFormProps> = ({ character, onSave, onCancel, onGenerateImage, availableDocuments }) => {
  const [formState, setFormState] = useState<Character>({} as Character);
  const [voices, setVoices] = useState<any[]>([]);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState<string | null>(null); // which field is generating
  const [selectedPreset, setSelectedPreset] = useState<string>('default');
  const [selectedSummaryPreset, setSelectedSummaryPreset] = useState<string>('default');
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  // Server-driven providers/models (single source of truth from /api/providers + /api/models/*).
  // Keys & endpoints live server-side (nexus.env) — the browser only SELECTS provider + model.
  const [chatProviders, setChatProviders] = useState<ProviderInfo[]>([]);
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [summaryModels, setSummaryModels] = useState<string[]>([]);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ttsService.getVoices().then(availableVoices => {
        setVoices(availableVoices);
    });
    // Load the live provider registry (built-in + env-declared) for the chat/summary selectors.
    getProvidersByKind('chat').then(setChatProviders).catch(() => setChatProviders([]));
  }, []);

  // Refresh the model list whenever the chat provider changes.
  useEffect(() => {
    const svc = formState.apiConfig?.service;
    if (svc && !['default', 'gemini', 'aihorde', 'aihorde_text'].includes(svc)) {
      getModels(svc).then(setChatModels).catch(() => setChatModels([]));
    } else { setChatModels([]); }
  }, [formState.apiConfig?.service]);

  // Refresh the summarizer model list whenever the summary provider changes.
  useEffect(() => {
    const svc = formState.summaryApiConfig?.service;
    if (svc && !['default', 'gemini', 'aihorde', 'aihorde_text'].includes(svc)) {
      getModels(svc).then(setSummaryModels).catch(() => setSummaryModels([]));
    } else { setSummaryModels([]); }
  }, [formState.summaryApiConfig?.service]);

  useEffect(() => {
    if (character) {
        setFormState({
            ...character,
            tags: character.tags || [],
            lore: character.lore || [],
            memory: character.memory || 'No memories yet.',
            firstMessage: character.firstMessage || '',
            backstory: character.backstory || '',
            characterType: character.characterType || 'character',
            knowledgeSourceIds: character.knowledgeSourceIds || [],
            embeddingConfig: character.embeddingConfig || defaultEmbeddingConfig,
            apiConfig: character.apiConfig || defaultApiConfig,
            pluginEnabled: character.pluginEnabled || false,
            pluginCode: character.pluginCode || '',
            voiceId: character.voiceId || character.voiceURI || 'nova', // Fallback to old URI or default
            searchEnabled: character.searchEnabled || false,
            thinkingEnabled: character.thinkingEnabled || false,
            terminalEnabled: character.terminalEnabled || false,
            transwayEnabled: character.transwayEnabled || false,
            transwayConfig: character.transwayConfig || defaultTranswayConfig,
            avatarSize: character.avatarSize || 128,
            moodAvatarEnabled: character.moodAvatarEnabled || false,
            longTermMemoryEnabled: character.longTermMemoryEnabled || false,
            memoryConfig: character.memoryConfig || defaultMemoryConfig,
        });
        setSelectedPreset(presetKeyFromConfig(character.apiConfig));
        setSelectedSummaryPreset(presetKeyFromConfig(character.summaryApiConfig));
    } else {
        setFormState({
            id: '', // Will be set on save
            name: '',
            description: '',
            personality: '',
            avatarUrl: '',
            tags: [],
            createdAt: '', // Will be set on save
            physicalAppearance: '',
            personalityTraits: '',
            firstMessage: '',
            backstory: '',
            lore: [],
            memory: 'No memories yet.',
            voiceId: 'nova',
            characterType: 'character',
            apiConfig: defaultApiConfig,
            ragEnabled: false,
            embeddingConfig: defaultEmbeddingConfig,
            knowledgeSourceIds: [],
            pluginEnabled: false,
            pluginCode: examplePluginCode,
            searchEnabled: false,
            thinkingEnabled: false,
            terminalEnabled: false,
            transwayEnabled: false,
            transwayConfig: defaultTranswayConfig,
            avatarSize: 128,
            moodAvatarEnabled: false,
            longTermMemoryEnabled: false,
            memoryConfig: defaultMemoryConfig,
        });
        setSelectedPreset('default');
        setSelectedSummaryPreset('default');
    }
    setActiveTab('basic');
  }, [character]);

  const handleFormChange = <K extends keyof Character>(key: K, value: Character[K]) => {
      setFormState(prev => ({ ...prev, [key]: value }));
  };

  const handleApiConfigChange = <K extends keyof ApiConfig>(key: K, value: ApiConfig[K]) => {
      setFormState(prev => ({ ...prev, apiConfig: { ...prev.apiConfig!, [key]: value }}));
  };

  const handlePresetChange = (presetKey: string) => {
      setSelectedPreset(presetKey);
      const preset = API_PRESETS[presetKey];
      if (preset) {
          setFormState(prev => ({
              ...prev,
              apiConfig: {
                  ...prev.apiConfig!,
                  service: preset.service,
                  apiEndpoint: preset.endpoint,
                  model: '',  // Never auto-fill model — user must set their own
                  // Clear key if switching to a free service that doesn't need one, otherwise keep it
                  apiKey: preset.requiresKey ? prev.apiConfig?.apiKey : ''
              }
          }));
      }
  };

  // --- Summarizer / Memory model (summaryApiConfig) ---
  const handleSummaryConfigChange = <K extends keyof ApiConfig>(key: K, value: ApiConfig[K]) => {
      setFormState(prev => ({ ...prev, summaryApiConfig: { ...(prev.summaryApiConfig || { ...defaultApiConfig }), [key]: value }}));
  };

  const handleSummaryPresetChange = (presetKey: string) => {
      setSelectedSummaryPreset(presetKey);
      const preset = API_PRESETS[presetKey];
      if (preset) {
          setFormState(prev => ({
              ...prev,
              summaryApiConfig: {
                  ...(prev.summaryApiConfig || { ...defaultApiConfig }),
                  service: preset.service,
                  apiEndpoint: preset.endpoint,
                  model: '',
                  apiKey: preset.requiresKey ? prev.summaryApiConfig?.apiKey : ''
              }
          }));
      }
  };

  const handleEmbeddingConfigChange = <K extends keyof EmbeddingConfig>(key: K, value: EmbeddingConfig[K]) => {
      setFormState(prev => ({ ...prev, embeddingConfig: { ...prev.embeddingConfig!, [key]: value }}));
  };

  const handleKnowledgeToggle = (docId: string) => {
      const currentIds = formState.knowledgeSourceIds || [];
      if (currentIds.includes(docId)) {
          handleFormChange('knowledgeSourceIds', currentIds.filter(id => id !== docId));
      } else {
          handleFormChange('knowledgeSourceIds', [...currentIds, docId]);
      }
  };

  // Per-field AI generation. Routes through the character's summarizer model if configured
  // (e.g. local aichat), else the default — mirroring the AI Nexus 002 editor behaviour.
  const handleAIGenerate = async (field: keyof Character, templateKey: string) => {
      if (!formState.name?.trim()) {
          alert("Please enter a character name first.");
          return;
      }
      const template = GEN_TEMPLATES[templateKey];
      if (!template) return;
      setIsGeneratingText(templateKey);
      try {
          const prompt = template
              .replace(/{{name}}/g, formState.name)
              .replace(/{{desc}}/g, formState.description?.trim() || 'a compelling, original character');
          const content = await generateContent(prompt, formState.summaryApiConfig);
          if (content?.trim()) {
              handleFormChange(field, content.trim() as Character[typeof field]);
          }
      } catch (e) {
          logger.error(`Failed to generate ${String(field)}`, e);
          alert(`Failed to generate content: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsGeneratingText(null);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) return;

    const characterToSave: Character = {
      ...formState,
      id: character?.id || crypto.randomUUID(),
      createdAt: character?.createdAt || new Date().toISOString(),
      apiConfig: {
        ...formState.apiConfig,
        apiKey: formState.apiConfig?.apiKey?.trim(),
        apiEndpoint: formState.apiConfig?.apiEndpoint?.trim(),
        model: formState.apiConfig?.model?.trim(),
      },
       embeddingConfig: {
        ...formState.embeddingConfig,
        apiKey: formState.embeddingConfig?.apiKey?.trim(),
        apiEndpoint: formState.embeddingConfig?.apiEndpoint?.trim(),
        model: formState.embeddingConfig?.model?.trim(),
      },
      summaryApiConfig: formState.summaryApiConfig ? {
        ...formState.summaryApiConfig,
        apiKey: formState.summaryApiConfig.apiKey?.trim(),
        apiEndpoint: formState.summaryApiConfig.apiEndpoint?.trim(),
        model: formState.summaryApiConfig.model?.trim(),
      } : undefined,
      // Ensure voiceURI is synced with voiceId for compatibility if needed, though voiceId is primary now
      voiceURI: formState.voiceId,
    };
    onSave(characterToSave);
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      alert("File is too large. Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleFormChange('avatarUrl', reader.result as string);
    };
    reader.onerror = (error) => {
        logger.error("Failed to read avatar file:", error);
        alert("Failed to read file.");
    };
    reader.readAsDataURL(file);
    if(avatarFileInputRef.current) avatarFileInputRef.current.value = "";
  };

  const generateAvatar = async (prompt: string) => {
    setIsGeneratingAvatar(true);
    try {
        const imageUrl = await onGenerateImage(prompt);
        if (imageUrl) {
            handleFormChange('avatarUrl', imageUrl);
        }
    } finally {
        setIsGeneratingAvatar(false);
    }
  };

  const handleGenerateFromPrompt = () => {
    const prompt = window.prompt("Enter a prompt for the new avatar:");
    if (prompt) {
        generateAvatar(prompt);
    }
  };

  const handleGenerateFromDescription = () => {
    if (formState.physicalAppearance?.trim()) {
        generateAvatar(formState.physicalAppearance);
    }
  };

  const activePresetConfig = API_PRESETS[selectedPreset] || API_PRESETS['default'];
  const showApiEndpoint = selectedPreset !== 'default' && selectedPreset !== 'gemini' && selectedPreset !== 'pollinations';
  const showApiKey = activePresetConfig.requiresKey;
  const showModel = selectedPreset !== 'default'; // Gemini default handles model internally usually, or fixed

  const activeSummaryPreset = API_PRESETS[selectedSummaryPreset] || API_PRESETS['default'];
  // Keys & endpoints are server-side (nexus.env) — never entered in the browser. Summarizer just
  // selects provider + model; generateContent() routes it through the /api/llm proxy.
  const showSummaryEndpoint = false;
  const showSummaryKey = false;
  const showSummaryModel = selectedSummaryPreset !== 'default';

  // Small reusable "✨ Generate" button for a field.
  const GenBtn: React.FC<{ field: keyof Character, templateKey: string }> = ({ field, templateKey }) => (
    <button
      type="button"
      onClick={() => handleAIGenerate(field, templateKey)}
      disabled={!!isGeneratingText}
      title="Generate this field with AI"
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background-tertiary hover:bg-opacity-80 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGeneratingText === templateKey ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
      <span>Generate</span>
    </button>
  );

  const TABS: { key: TabKey, label: string }[] = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'details', label: 'Details & Persona' },
    { key: 'advanced', label: 'Advanced' },
    { key: 'memory', label: 'Memory & Intelligence' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-background-primary h-full">
      <header className="flex items-center p-4 border-b border-border-neutral flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">
            {character ? 'Edit Character' : 'Create New Character'}
          </h2>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-border-neutral flex-shrink-0 px-4 md:px-8 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">

          {/* ============================ BASIC INFO ============================ */}
          {activeTab === 'basic' && (
            <Section title="Core Identity">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-text-primary">Name</label>
                  <input
                    id="name"
                    type="text"
                    value={formState.name || ''}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="characterType" className="block text-sm font-medium text-text-primary">Character Type</label>
                  <select
                    id="characterType"
                    value={formState.characterType || 'character'}
                    onChange={(e) => handleFormChange('characterType', e.target.value as 'character' | 'narrator')}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="character">Persona</option>
                    <option value="narrator">Narrator / Scenario</option>
                  </select>
                  <p className="text-xs text-text-secondary mt-1">
                    'Persona' is for a standard interactive character. 'Narrator/Scenario' is for world-building bots that set the scene or act as a game master.
                  </p>
                </div>
                 <div>
                  <label className="block text-sm font-medium text-text-primary">Avatar</label>
                  <div className="mt-2 flex items-center space-x-6">
                     <div className="relative flex-shrink-0">
                        <img
                            src={formState.avatarUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}
                            alt="Avatar Preview"
                            className="w-24 h-24 rounded-full object-cover bg-background-tertiary border border-border-neutral"
                        />
                        {isGeneratingAvatar && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                                <SpinnerIcon className="animate-spin h-8 w-8 text-white" />
                            </div>
                        )}
                     </div>
                     <div className="flex-grow space-y-2">
                        <input type="file" ref={avatarFileInputRef} onChange={handleAvatarFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                        <button type="button" onClick={() => avatarFileInputRef.current?.click()} className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-center rounded-md bg-background-tertiary hover:bg-opacity-80 transition-colors">
                            <UploadIcon className="w-4 h-4" />
                            <span>Upload File</span>
                        </button>
                        <button type="button" onClick={handleGenerateFromDescription} disabled={!formState.physicalAppearance?.trim() || isGeneratingAvatar} className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-center rounded-md bg-background-tertiary hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <SparklesIcon className="w-4 h-4" />
                            <span>Generate from Description</span>
                        </button>
                         <button type="button" onClick={handleGenerateFromPrompt} disabled={isGeneratingAvatar} className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-center rounded-md bg-background-tertiary hover:bg-opacity-80 transition-colors">
                            <SparklesIcon className="w-4 h-4" />
                            <span>Generate from Prompt...</span>
                        </button>
                     </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="avatarUrl" className="block text-sm font-medium text-text-primary">Or paste image URL</label>
                     <input
                      id="avatarUrl"
                      type="text"
                      value={formState.avatarUrl || ''}
                      onChange={(e) => handleFormChange('avatarUrl', e.target.value)}
                      className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="https://example.com/avatar.png"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="description" className="block text-sm font-medium text-text-primary">Description</label>
                    <GenBtn field="description" templateKey="description" />
                  </div>
                  <textarea
                    id="description"
                    value={formState.description || ''}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="A brief, one-sentence description of the character."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="firstMessage" className="block text-sm font-medium text-text-primary">First Message / Greeting</label>
                    <GenBtn field="firstMessage" templateKey="firstMessage" />
                  </div>
                  <textarea
                    id="firstMessage"
                    value={formState.firstMessage || ''}
                    onChange={(e) => handleFormChange('firstMessage', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="The greeting this character sends when a new chat begins (character-card compatible)."
                  />
                </div>
                <div>
                  <label htmlFor="tags" className="block text-sm font-medium text-text-primary">Tags</label>
                  <input
                    id="tags"
                    type="text"
                    value={(formState.tags || []).join(', ')}
                    onChange={(e) => handleFormChange('tags', e.target.value.split(',').map(tag => tag.trim()))}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Comma-separated, e.g., sci-fi, assistant, funny"
                  />
                </div>
            </Section>
          )}

          {/* ============================ DETAILS & PERSONA ============================ */}
          {activeTab === 'details' && (
            <Section title="Persona & Prompting">
                 <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="physicalAppearance" className="block text-sm font-medium text-text-primary">Physical Appearance</label>
                    <GenBtn field="physicalAppearance" templateKey="physicalAppearance" />
                  </div>
                  <textarea
                    id="physicalAppearance"
                    value={formState.physicalAppearance || ''}
                    onChange={(e) => handleFormChange('physicalAppearance', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Describe the character's physical appearance in detail."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="personalityTraits" className="block text-sm font-medium text-text-primary">Personality Traits</label>
                    <GenBtn field="personalityTraits" templateKey="personalityTraits" />
                  </div>
                  <input
                    id="personalityTraits"
                    type="text"
                    value={formState.personalityTraits || ''}
                    onChange={(e) => handleFormChange('personalityTraits', e.target.value)}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Comma-separated traits, e.g., witty, sarcastic, kind, curious"
                  />
                </div>

                {/* Voice Selection */}
                <div>
                    <label htmlFor="voice" className="block text-sm font-medium text-text-primary">Voice (Bifrost TTS)</label>
                    <select
                      id="voice"
                      value={formState.voiceId || 'nova'}
                      onChange={(e) => handleFormChange('voiceId', e.target.value)}
                      className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      {voices.map((voice: any) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name}{voice.gender ? ` — ${voice.gender}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">Voice is played via NeXuS Bifrost TTS. Click 🔊 on any message to hear it.</p>
                </div>

                 <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="personality" className="block text-sm font-medium text-text-primary">Role Instruction / System Prompt</label>
                    <GenBtn field="personality" templateKey="personality" />
                  </div>
                  <textarea
                    id="personality"
                    value={formState.personality || ''}
                    onChange={(e) => handleFormChange('personality', e.target.value)}
                    rows={8}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Describe the character's personality, quirks, and conversation style. This is the main system prompt that guides the AI's behavior."
                  />
                </div>

                 <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="backstory" className="block text-sm font-medium text-text-primary">Backstory</label>
                    <GenBtn field="backstory" templateKey="backstory" />
                  </div>
                  <textarea
                    id="backstory"
                    value={formState.backstory || ''}
                    onChange={(e) => handleFormChange('backstory', e.target.value)}
                    rows={6}
                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="The character's history, origin, and key life events."
                  />
                </div>
            </Section>
          )}

          {/* ============================ ADVANCED ============================ */}
          {activeTab === 'advanced' && (
            <>
            <Section title="Advanced AI Capabilities">
                <div className="space-y-4">
                    {/* Google Search Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block text-sm font-medium text-text-primary">Google Search Grounding</label>
                            <p className="text-xs text-text-secondary">Allows the character to search the web for real-time information.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFormChange('searchEnabled', !formState.searchEnabled)}
                            className={`${formState.searchEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${formState.searchEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                        </button>
                    </div>

                    {/* Thinking Mode Toggle */}
                    <div className="flex items-center justify-between border-t border-border-neutral pt-4">
                        <div>
                            <label className="block text-sm font-medium text-text-primary">Deep Thinking Mode</label>
                            <p className="text-xs text-text-secondary">Enables extended reasoning capabilities (uses Gemini 3.0 Pro, may increase latency).</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFormChange('thinkingEnabled', !formState.thinkingEnabled)}
                            className={`${formState.thinkingEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${formState.thinkingEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                        </button>
                    </div>

                    {/* NEW TERMINAL ACCESS TOGGLE */}
                    <div className="flex items-center justify-between border-t border-border-neutral pt-4">
                        <div className="flex items-center gap-2">
                            <TerminalIcon className="w-5 h-5 text-green-500" />
                            <div>
                                <label className="block text-sm font-medium text-text-primary">Terminal Access</label>
                                <p className="text-xs text-text-secondary">Gives the AI ability to read/write files in a restricted virtual environment. Requires approval for every command.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFormChange('terminalEnabled', !formState.terminalEnabled)}
                            className={`${formState.terminalEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${formState.terminalEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                        </button>
                    </div>

                    {/* TRANSWAY PROTOCOL TOGGLE — double-axis MCP */}
                    <div className="flex items-center justify-between border-t border-border-neutral pt-4">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">⇅</span>
                            <div>
                                <label className="block text-sm font-medium text-text-primary">TransWay Protocol</label>
                                <p className="text-xs text-text-secondary">Double-axis MCP. This character can reach out to aichat / Claude / other characters and search the web before answering — and be summoned by external agents you grant access. Auth via cert or API key.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFormChange('transwayEnabled', !formState.transwayEnabled)}
                            className={`${formState.transwayEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${formState.transwayEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                        </button>
                    </div>
                    {formState.transwayEnabled && (
                        <div className="ml-7 space-y-3 pt-2">
                            <label className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">Consult peers &amp; search before answering</span>
                                <input type="checkbox"
                                    checked={formState.transwayConfig?.consultBeforeAnswer || false}
                                    onChange={e => handleFormChange('transwayConfig', { ...formState.transwayConfig, consultBeforeAnswer: e.target.checked })}
                                />
                            </label>
                            <label className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">Reachable by external agents (inbound axis)</span>
                                <input type="checkbox"
                                    checked={formState.transwayConfig?.reachable || false}
                                    onChange={e => handleFormChange('transwayConfig', { ...formState.transwayConfig, reachable: e.target.checked })}
                                />
                            </label>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">Search backend</span>
                                <select className="bg-background-tertiary rounded px-2 py-1 text-text-primary"
                                    value={(formState.transwayConfig?.searchBackends || ['local'])[0]}
                                    onChange={e => handleFormChange('transwayConfig', { ...formState.transwayConfig, searchBackends: [e.target.value] })}
                                >
                                    <option value="local">Local (Hister)</option>
                                    <option value="web">Web (Brave/SearXNG)</option>
                                    <option value="both">Both</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">Auth</span>
                                <select className="bg-background-tertiary rounded px-2 py-1 text-text-primary"
                                    value={formState.transwayConfig?.authMode || 'apikey'}
                                    onChange={e => handleFormChange('transwayConfig', { ...formState.transwayConfig, authMode: e.target.value })}
                                >
                                    <option value="apikey">API Key</option>
                                    <option value="cert">Mutual TLS (cert)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* MOOD AVATAR TOGGLE — character swaps its own avatar from its vault home drive */}
                    <div className="flex items-center justify-between border-t border-border-neutral pt-4">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🎭</span>
                            <div>
                                <label className="block text-sm font-medium text-text-primary">Mood Avatar</label>
                                <p className="text-xs text-text-secondary">Character selects its own avatar to match its mood / the tone of the conversation, pulling from its home drive in the vault (<code className="bg-background-tertiary px-1 rounded">$NEXUS_VAULT/characters/&lt;slug&gt;/avatars/</code>).</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFormChange('moodAvatarEnabled', !formState.moodAvatarEnabled)}
                            className={`${formState.moodAvatarEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${formState.moodAvatarEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                        </button>
                    </div>

                    {/* AVATAR SIZE SLIDER */}
                    <div className="border-t border-border-neutral pt-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-text-primary">Avatar Size</label>
                            <span className="text-xs text-text-secondary">{formState.avatarSize || 128}px</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {formState.avatarUrl && (
                                <img src={formState.avatarUrl} alt="preview"
                                    style={{ width: `${Math.min(formState.avatarSize || 128, 96)}px`, height: `${Math.min(formState.avatarSize || 128, 96)}px` }}
                                    className="rounded-full object-cover border border-border-neutral flex-shrink-0" />
                            )}
                            <input type="range" min="64" max="512" step="8"
                                value={formState.avatarSize || 128}
                                onChange={e => handleFormChange('avatarSize', parseInt(e.target.value, 10))}
                                className="w-full accent-primary-600"
                            />
                        </div>
                    </div>

                    {/* LONG-TERM MEMORY TOGGLE + strategy + external paths */}
                    <div className="flex items-center justify-between border-t border-border-neutral pt-4">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🧠</span>
                            <div>
                                <label className="block text-sm font-medium text-text-primary">Long-Term Memory</label>
                                <p className="text-xs text-text-secondary">Persist important memories across sessions (encrypted in the vault). Importance × recency decides what the character keeps.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFormChange('longTermMemoryEnabled', !formState.longTermMemoryEnabled)}
                            className={`${formState.longTermMemoryEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${formState.longTermMemoryEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                        </button>
                    </div>
                    {formState.longTermMemoryEnabled && (
                        <div className="ml-7 space-y-3 pt-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">Strategy</span>
                                <select className="bg-background-tertiary rounded px-2 py-1 text-text-primary"
                                    value={formState.memoryConfig?.strategy || 'importance'}
                                    onChange={e => handleFormChange('memoryConfig', { ...formState.memoryConfig, strategy: e.target.value })}
                                >
                                    <option value="window">Sliding Window (last N)</option>
                                    <option value="summary">Rolling Summary</option>
                                    <option value="rag">RAG / Vector</option>
                                    <option value="importance">Importance-Weighted</option>
                                    <option value="hierarchical">Hierarchical (self-editing)</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">Recall depth (top-k)</span>
                                <input type="number" min="1" max="20" className="w-16 bg-background-tertiary rounded px-2 py-1 text-text-primary"
                                    value={formState.memoryConfig?.maxRecall || 5}
                                    onChange={e => handleFormChange('memoryConfig', { ...formState.memoryConfig, maxRecall: parseInt(e.target.value, 10) })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">External lore paths (one per line)</label>
                                <textarea rows={2} placeholder="$NEXUS_HOME/lore&#10;/path/to/wiki-export"
                                    className="w-full bg-background-tertiary rounded px-2 py-1 text-text-primary text-xs font-mono"
                                    value={(formState.memoryConfig?.lorePaths || []).join('\n')}
                                    onChange={e => handleFormChange('memoryConfig', { ...formState.memoryConfig, lorePaths: e.target.value.split('\n').filter(Boolean) })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">External knowledge paths (one per line)</label>
                                <textarea rows={2} placeholder="$NEXUS_HOME/docs&#10;/path/to/dataset"
                                    className="w-full bg-background-tertiary rounded px-2 py-1 text-text-primary text-xs font-mono"
                                    value={(formState.memoryConfig?.knowledgePaths || []).join('\n')}
                                    onChange={e => handleFormChange('memoryConfig', { ...formState.memoryConfig, knowledgePaths: e.target.value.split('\n').filter(Boolean) })}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </Section>

            <Section title="Character Logic (Experimental)" defaultOpen={false}>
                <div className="flex items-center space-x-3">
                    <label htmlFor="plugin-enabled" className="text-sm font-medium text-text-primary">Enable Character Logic</label>
                    <button
                        type="button"
                        onClick={() => handleFormChange('pluginEnabled', !formState.pluginEnabled)}
                        className={`${formState.pluginEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                        <span className={`${formState.pluginEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                    </button>
                </div>
                {formState.pluginEnabled && (
                    <div className="space-y-4 pt-4 border-t border-border-neutral mt-4">
                        <p className="text-xs text-text-secondary">
                            Write custom JavaScript that runs in a secure sandbox before this character generates a response. This allows for dynamic, complex behaviors. The code has access to a special <code className="bg-background-tertiary px-1 rounded">nexus</code> object to register a <code className="bg-background-tertiary px-1 rounded">'beforeResponseGenerate'</code> hook.
                        </p>
                        <div className="flex flex-col h-72">
                            <label htmlFor="pluginCode" className="block text-sm font-medium text-text-primary mb-1">Plugin Code</label>
                            <textarea
                                id="pluginCode"
                                value={formState.pluginCode || ''}
                                onChange={(e) => handleFormChange('pluginCode', e.target.value)}
                                className="flex-1 w-full bg-background-primary border border-border-strong rounded-md py-2 px-3 text-text-primary font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 resize-none"
                                spellCheck="false"
                                placeholder="nexus.hooks.register('beforeResponseGenerate', (payload) => { ... });"
                            />
                        </div>
                    </div>
                )}
            </Section>

            <Section title="Chat API Configuration" defaultOpen={false}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="api-service" className="block text-sm font-medium text-text-primary">AI Service Provider</label>
                        <select
                            id="api-service"
                            value={formState.apiConfig?.service || 'default'}
                            onChange={(e) => {
                                const svc = e.target.value;
                                setSelectedPreset(svc);
                                // Only SELECT provider — keys & endpoints are server-side (nexus.env).
                                setFormState(prev => ({ ...prev, apiConfig: { ...prev.apiConfig, service: svc as any, apiKey: '', apiEndpoint: '' } }));
                            }}
                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="default">Default — AI Horde (free)</option>
                            {chatProviders.map(p => (
                                <option key={p.id} value={p.id}>{p.label} — {readinessTag(p)}</option>
                            ))}
                            {/* keep the current value visible even if the server doesn't list it */}
                            {formState.apiConfig?.service
                              && formState.apiConfig.service !== 'default'
                              && !chatProviders.some(p => p.id === formState.apiConfig!.service)
                              && <option value={formState.apiConfig.service}>{formState.apiConfig.service}</option>}
                        </select>
                        <p className="text-xs text-text-secondary mt-1">🔒 API keys &amp; endpoints are managed server-side in <span className="font-mono">nexus.env</span>. Just pick a provider and model. Add more in that file (see the NeXuS Web Server help).</p>
                    </div>

                    {formState.apiConfig?.service && !['default','gemini','aihorde','aihorde_text'].includes(formState.apiConfig.service) && (
                        <div>
                            <label htmlFor="api-model" className="block text-sm font-medium text-text-primary">Model {chatModels.length > 0 && <span className="text-xs text-text-secondary">({chatModels.length} live)</span>}</label>
                            <div className="mt-1 relative">
                                <input
                                    id="api-model"
                                    type="text"
                                    list="model-list"
                                    value={formState.apiConfig?.model || ''}
                                    onChange={(e) => handleApiConfigChange('model', e.target.value)}
                                    className="block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    placeholder={chatModels.length ? "Select or type a model…" : "Type a model name…"}
                                />
                                <datalist id="model-list">
                                    {chatModels.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="api-rate-limit" className="block text-sm font-medium text-text-primary">Request Delay (ms)</label>
                        <input
                            id="api-rate-limit"
                            type="number"
                            value={formState.apiConfig?.rateLimit || ''}
                            onChange={(e) => handleApiConfigChange('rateLimit', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., 1000 (for 1 request per second)"
                            min="0"
                        />
                        <p className="text-xs text-text-secondary mt-1">Minimum time to wait between requests from this character to avoid rate limits.</p>
                    </div>
                </div>
            </Section>

            <Section title="Retrieval-Augmented Generation (RAG)" defaultOpen={false}>
                <div className="flex items-center space-x-3">
                    <label htmlFor="rag-enabled" className="text-sm font-medium text-text-primary">Enable RAG</label>
                    <button
                        type="button"
                        onClick={() => handleFormChange('ragEnabled', !formState.ragEnabled)}
                        className={`${formState.ragEnabled ? 'bg-primary-600' : 'bg-background-tertiary'} relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                        <span className={`${formState.ragEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                    </button>
                </div>
                {formState.ragEnabled && (
                    <div className="space-y-4 pt-4 border-t border-border-neutral mt-4">
                         <p className="text-xs text-text-secondary">
                            Enable this to allow the character to retrieve information from documents in your global library.
                         </p>

                        <h4 className="text-md font-semibold">Attached Knowledge</h4>
                        <div className="p-2 border border-dashed border-border-strong rounded-md max-h-60 overflow-y-auto">
                            {availableDocuments.length === 0 ? (
                                <p className="text-xs text-text-secondary text-center p-4">No documents available in the Library.</p>
                            ) : (
                                availableDocuments.map(doc => (
                                    <div key={doc.id} className="flex items-center space-x-2 p-2 hover:bg-background-tertiary rounded cursor-pointer" onClick={() => handleKnowledgeToggle(doc.id)}>
                                        <input
                                            type="checkbox"
                                            checked={(formState.knowledgeSourceIds || []).includes(doc.id)}
                                            readOnly
                                            className="h-4 w-4 text-primary-600 border-border-strong bg-background-primary focus:ring-primary-500 pointer-events-none"
                                        />
                                        <span className="text-sm truncate text-text-primary">{doc.fileName}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <h4 className="text-md font-semibold pt-4 border-t border-border-neutral">Embedding API Configuration</h4>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="embed-api-service" className="block text-sm font-medium text-text-primary">Embedding Service</label>
                                <select
                                    id="embed-api-service"
                                    value={formState.embeddingConfig?.service || 'gemini'}
                                    onChange={(e) => handleEmbeddingConfigChange('service', e.target.value as EmbeddingConfig['service'])}
                                    className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="gemini">Google Gemini</option>
                                    <option value="openai">OpenAI-Compatible (e.g., Ollama)</option>
                                </select>
                            </div>
                             {formState.embeddingConfig?.service === 'gemini' && (
                                 <div>
                                    <label htmlFor="embed-api-key" className="block text-sm font-medium text-text-primary">Gemini API Key</label>
                                    <input
                                        id="embed-api-key"
                                        type="password"
                                        value={formState.embeddingConfig.apiKey || ''}
                                        onChange={(e) => handleEmbeddingConfigChange('apiKey', e.target.value)}
                                        className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="Leave blank to use default key"
                                    />
                                </div>
                            )}
                             {formState.embeddingConfig?.service === 'openai' && (
                                <>
                                    <div>
                                        <label htmlFor="embed-api-endpoint" className="block text-sm font-medium text-text-primary">API Endpoint</label>
                                        <input
                                            id="embed-api-endpoint"
                                            type="text"
                                            value={formState.embeddingConfig.apiEndpoint || ''}
                                            onChange={(e) => handleEmbeddingConfigChange('apiEndpoint', e.target.value)}
                                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="e.g., http://localhost:11434/api/embeddings"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="embed-api-key" className="block text-sm font-medium text-text-primary">API Key</label>
                                        <input
                                            id="embed-api-key"
                                            type="password"
                                            value={formState.embeddingConfig.apiKey || ''}
                                            onChange={(e) => handleEmbeddingConfigChange('apiKey', e.target.value)}
                                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="API Key (optional for some services)"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="embed-api-model" className="block text-sm font-medium text-text-primary">Model Name</label>
                                        <input
                                            id="embed-api-model"
                                            type="text"
                                            value={formState.embeddingConfig.model || ''}
                                            onChange={(e) => handleEmbeddingConfigChange('model', e.target.value)}
                                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="e.g., nomic-embed-text"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </Section>
            </>
          )}

          {/* ============================ MEMORY & INTELLIGENCE ============================ */}
          {activeTab === 'memory' && (
            <>
            <Section title="Memory & Lore">
                 <div>
                    <label htmlFor="lore" className="block text-sm font-medium text-text-primary">Lore</label>
                    <p className="text-xs text-text-secondary mb-1">Key facts about the character. Add new facts in chat with '/lore [fact]'. One fact per line.</p>
                    <textarea
                        id="lore"
                        value={(formState.lore || []).join('\n')}
                        onChange={(e) => handleFormChange('lore', e.target.value.split('\n'))}
                        rows={8}
                        className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Fact 1 about the character...&#10;Fact 2 about the character..."
                    />
                </div>
                 <div>
                    <label htmlFor="memory" className="block text-sm font-medium text-text-primary">Memory</label>
                     <p className="text-xs text-text-secondary mb-1">Automatically summarized highlights from conversations.</p>
                    <textarea
                        id="memory"
                        value={formState.memory || ''}
                        readOnly
                        rows={6}
                        className="mt-1 block w-full bg-background-tertiary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-secondary focus:outline-none cursor-not-allowed"
                    />
                </div>
            </Section>

            <Section title="Memory & Intelligence (Summarizer Model)">
                <p className="text-xs text-text-secondary">
                    Optional: use a <span className="font-semibold">dedicated model</span> for memory summarization and the ✨ per-field generators —
                    independent of this character's chat model. Point it at a local bridge (e.g. aichat) to keep memory work offline/free.
                    Leave as <span className="font-mono">Default</span> to use the app default.
                </p>
                <div>
                    <label htmlFor="summary-service" className="block text-sm font-medium text-text-primary">Summarizer / Utility Model</label>
                    <select
                        id="summary-service"
                        value={selectedSummaryPreset}
                        onChange={(e) => handleSummaryPresetChange(e.target.value)}
                        className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                        {Object.entries(API_PRESETS).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                        ))}
                    </select>
                </div>

                {showSummaryEndpoint && (
                    <div>
                        <label htmlFor="summary-endpoint" className="block text-sm font-medium text-text-primary">API Endpoint</label>
                        <input
                            id="summary-endpoint"
                            type="text"
                            value={formState.summaryApiConfig?.apiEndpoint || ''}
                            onChange={(e) => handleSummaryConfigChange('apiEndpoint', e.target.value)}
                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., http://localhost:3030/v1/chat/completions"
                        />
                    </div>
                )}

                {showSummaryKey && (
                    <div>
                        <label htmlFor="summary-key" className="block text-sm font-medium text-text-primary">API Key</label>
                        <input
                            id="summary-key"
                            type="password"
                            value={formState.summaryApiConfig?.apiKey || ''}
                            onChange={(e) => handleSummaryConfigChange('apiKey', e.target.value)}
                            className="mt-1 block w-full bg-background-secondary border border-border-strong rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Enter your API key"
                        />
                    </div>
                )}

                {showSummaryModel && (
                    <div>
                        <label htmlFor="summary-model" className="block text-sm font-medium text-text-primary">Model Name</label>
                        <div className="mt-1 relative">
                            <input
                                id="summary-model"
                                type="text"
                                list="summary-model-list"
                                value={formState.summaryApiConfig?.model || ''}
                                onChange={(e) => handleSummaryConfigChange('model', e.target.value)}
                                className="block w-full bg-background-secondary border border-border-strong rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Select or type model name..."
                            />
                            <datalist id="summary-model-list">
                                {activeSummaryPreset.models.map(m => <option key={m} value={m} />)}
                            </datalist>
                        </div>
                    </div>
                )}
            </Section>
            </>
          )}

            <div className="flex justify-end space-x-4 pt-4 pb-4">
              <button
                type="button"
                onClick={onCancel}
                className="py-2 px-4 border border-border-strong rounded-md shadow-sm text-sm font-medium text-text-primary bg-background-tertiary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-primary focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-text-accent bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-primary focus:ring-primary-500"
              >
                Save Character
              </button>
            </div>
        </form>
      </div>
    </div>
  );
};
