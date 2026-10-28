import React, { useState, useEffect, useRef } from 'react';
import { Plugin, ApiConfig, ConfirmationRequest } from '../types.ts';
import { logger } from '../services/loggingService.ts';
import { PlusIcon } from './icons/PlusIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { EditIcon } from './icons/EditIcon.tsx';
import { PowerIcon } from './icons/PowerIcon.tsx';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { DownloadIcon } from './icons/DownloadIcon.tsx';

interface PluginManagerProps {
  plugins: Plugin[];
  onPluginsUpdate: (plugins: Plugin[]) => void;
  onSetConfirmation: (request: ConfirmationRequest | null) => void;
}

const examplePluginCode = `// Example Plugin: UPPERCASE every message
// This plugin intercepts every message sent by the user and converts it to uppercase.

// Use nexus.hooks.register to listen for specific events in the application.
// 'beforeMessageSend' is triggered right before a user's message is sent to the AI.
nexus.hooks.register('beforeMessageSend', (payload) => {
  // payload is an object like { content: "some message" }
  // Use nexus.log for safe debugging from the sandbox.
  nexus.log('Plugin transforming message:', payload.content);

  const modifiedContent = payload.content.toUpperCase();

  // The hook must return an object with the same structure as the payload.
  return { content: modifiedContent };
});

nexus.log('UPPERCASE plugin loaded and ready.');
`;

const imageStyles = ["Default (None)", "Anime/Manga", "Photorealistic", "Digital Painting", "Fantasy Art", "Cyberpunk", "Vintage Photo", "Low Poly", "Custom"];

// Pollinations model lists — synced from gen.pollinations.ai/v1/models
const POLLINATIONS_TEXT_MODELS = [
    'openai', 'openai-fast', 'openai-large',
    'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
    'claude-fast', 'claude', 'claude-sonnet-5', 'claude-opus-4.6', 'claude-opus-4.7', 'claude-large', 'claude-fable-5',
    'gemini-3-flash', 'gemini', 'gemini-flash-lite-3.5', 'gemini-fast', 'gemini-search', 'gemini-search-fast',
    'grok', 'grok-large', 'grok-4.5',
    'deepseek', 'deepseek-pro',
    'mistral', 'mistral-small-3.2', 'mistral-large',
    'llama', 'llama-maverick', 'llama-scout',
    'qwen-coder', 'qwen-coder-large', 'qwen-large', 'qwen3.7-max',
    'perplexity', 'perplexity-fast', 'perplexity-high', 'perplexity-reasoning',
    'mercury', 'kimi', 'kimi-code', 'kimi-k3', 'nova', 'nova-fast', 'gemma', 'gemma-4-31b',
];

const POLLINATIONS_IMAGE_MODELS = [
    'flux', 'sana', 'kontext',
    'nanobanana', 'nanobanana-2', 'nanobanana-2-lite', 'nanobanana-pro',
    'seedream', 'seedream-pro', 'seedream5', 'seedream5-pro',
    'gptimage', 'gptimage-large', 'gpt-image-2',
    'ideogram-v4-turbo', 'ideogram-v4-balanced', 'ideogram-v4-quality',
    'grok-imagine', 'grok-imagine-pro',
    'zimage', 'wan-image', 'wan-image-pro', 'qwen-image',
    'p-image', 'p-image-edit', 'nova-canvas', 'klein', 'recraft-v4.1-vector',
];

const POLLINATIONS_VIDEO_MODELS = [
    'veo', 'veo-1080p',
    'seedance-pro', 'seedance-2.0',
    'wan', 'wan-fast', 'wan-pro', 'wan-pro-1080p',
    'grok-video-pro', 'happyhorse-1.1',
    'p-video-720p', 'p-video-1080p', 'nova-reel',
];

const POLLINATIONS_AUDIO_MODELS = [
    'elevenlabs', 'elevenflash', 'eleven-multilingual-v2', 'eleven-dialogue',
    'elevenmusic', 'qwen-tts', 'qwen-tts-instruct',
    'csm-1b', 'stable-audio-3-medium', 'stable-audio-3-large',
    'lyria-3-clip', 'eleven-sfx',
];

// Constants for Image Providers and their Models
const PROVIDER_MODELS: Record<string, string[]> = {
    'pollinations': POLLINATIONS_IMAGE_MODELS,
    'aihorde': [
        'Deliberate', 'Dreamshaper', 'Realistic Vision',
        'stable_diffusion', 'stable_diffusion_2.1', 'ChilloutMix',
        'ICBINP - I Can\'t Believe It\'s Not Photography',
        'Anything Diffusion', 'Midjourney Diffusion', 'OpenJourney',
    ],
    'huggingface': [
        'black-forest-labs/FLUX.1-dev',
        'black-forest-labs/FLUX.1-schnell',
        'stabilityai/stable-diffusion-xl-base-1.0',
        'runwayml/stable-diffusion-v1-5',
        'prompthero/openjourney',
        'stabilityai/stable-diffusion-2-1',
        'hakurei/waifu-diffusion',
    ],
    'stability': [
        'stable-diffusion-xl-1024-v1-0',
        'stable-diffusion-v1-6',
        'stable-diffusion-512-v2-1',
    ],
    'gemini': ['gemini-2.5-flash-image'],
    'openai': ['dall-e-3', 'dall-e-2'],
    'imagerouter': [],
    'custom': [],
};

const TTS_PROVIDER_MODELS: Record<string, string[]> = {
    'pollinations': POLLINATIONS_AUDIO_MODELS,
    'openai': ['tts-1', 'tts-1-hd'],
    'elevenlabs': [],
    'custom': [],
};

const VIDEO_PROVIDER_MODELS: Record<string, string[]> = {
    'pollinations': POLLINATIONS_VIDEO_MODELS,
    'custom': [],
};

export const PluginManager: React.FC<PluginManagerProps> = ({ plugins, onPluginsUpdate, onSetConfirmation }) => {
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<Omit<Plugin, 'id' | 'enabled'>>({
    name: '', description: '', code: '', settings: { service: 'pollinations' }
  });
  const [liveModels, setLiveModels] = useState<{image: string[], text: string[], video: string[], audio: string[]}>({
    image: [], text: [], video: [], audio: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch live Pollinations model list on mount
  useEffect(() => {
    fetch('/api/llm/pollinations/v1/models')
      .then(r => r.json())
      .then(data => {
        const models = (data.data || []).map((m: any) => m.id || m);
        const img   = models.filter((m: string) => POLLINATIONS_IMAGE_MODELS.includes(m));
        const txt   = models.filter((m: string) => POLLINATIONS_TEXT_MODELS.includes(m));
        const vid   = models.filter((m: string) => POLLINATIONS_VIDEO_MODELS.includes(m));
        const aud   = models.filter((m: string) => POLLINATIONS_AUDIO_MODELS.includes(m));
        setLiveModels({
          image: img.length ? img : POLLINATIONS_IMAGE_MODELS,
          text:  txt.length ? txt : POLLINATIONS_TEXT_MODELS,
          video: vid.length ? vid : POLLINATIONS_VIDEO_MODELS,
          audio: aud.length ? aud : POLLINATIONS_AUDIO_MODELS,
        });
      })
      .catch(() => setLiveModels({
        image: POLLINATIONS_IMAGE_MODELS,
        text:  POLLINATIONS_TEXT_MODELS,
        video: POLLINATIONS_VIDEO_MODELS,
        audio: POLLINATIONS_AUDIO_MODELS,
      }));
  }, []);

  useEffect(() => {
    if (editingPlugin) {
      setFormState({
        name: editingPlugin.name,
        description: editingPlugin.description,
        code: editingPlugin.code,
        settings: editingPlugin.settings || {},
      });
      setIsCreating(false);
    } else if (isCreating) {
      setFormState({
        name: '',
        description: '',
        code: examplePluginCode,
        settings: {}
      });
    }
  }, [editingPlugin, isCreating]);

  const handleSave = () => {
    if (!formState.name.trim()) {
      alert('Plugin name cannot be empty.');
      return;
    }
    
    let updatedPlugins;
    if (editingPlugin) {
      updatedPlugins = plugins.map(p => p.id === editingPlugin.id ? { ...editingPlugin, ...formState } : p);
      logger.log(`Plugin updated: ${formState.name}`);
    } else {
      const newPlugin: Plugin = { ...formState, id: crypto.randomUUID(), enabled: false };
      updatedPlugins = [...plugins, newPlugin];
      logger.log(`Plugin created: ${formState.name}`);
    }
    onPluginsUpdate(updatedPlugins);
    setEditingPlugin(null);
    setIsCreating(false);
  };
  
  const handleDelete = (pluginId: string) => {
    const pluginName = plugins.find(p => p.id === pluginId)?.name || 'Unknown';
    onSetConfirmation({
        message: `Are you sure you want to delete the plugin "${pluginName}"? This action cannot be undone.`,
        onConfirm: () => {
            const updatedPlugins = plugins.filter(p => p.id !== pluginId);
            onPluginsUpdate(updatedPlugins);
            logger.log(`Plugin deleted: ${pluginName}`);
            onSetConfirmation(null);
        },
        onCancel: () => onSetConfirmation(null),
    });
  };

  const handleToggle = (pluginId: string) => {
    // Prevent disabling core plugins
    if (pluginId === 'default-image-generator' || pluginId === 'default-tts-narrator' || pluginId === 'default-terminal') {
        alert("This is a core plugin and cannot be disabled.");
        return;
    }
    const updatedPlugins = plugins.map(p => p.id === pluginId ? { ...p, enabled: !p.enabled } : p);
    onPluginsUpdate(updatedPlugins);
    const plugin = updatedPlugins.find(p => p.id === pluginId);
    if (plugin) {
        logger.log(`Plugin ${plugin.enabled ? 'enabled' : 'disabled'}: ${plugin.name}`);
    }
  };
  
  const handleCancel = () => {
    setEditingPlugin(null);
    setIsCreating(false);
  };
  
  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    try {
      const jsonString = JSON.stringify(plugins, null, 2);
      const filename = 'ai-nexus-plugins.json';
      triggerDownload(filename, jsonString);
      logger.log(`Exported all ${plugins.length} plugins.`, { filename });
    } catch (error) {
        logger.error("Failed to export all plugins.", error);
        alert("Failed to export plugins. Check logs for details.");
    }
  };

  const handleExportPlugin = (plugin: Plugin) => {
    try {
        const jsonString = JSON.stringify(plugin, null, 2);
        const filename = `${plugin.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        triggerDownload(filename, jsonString);
        logger.log(`Exported plugin: ${plugin.name}`, { filename });
    } catch (error) {
        logger.error(`Failed to export plugin: ${plugin.name}`, error);
        alert("Failed to export plugin. Check logs for details.");
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    logger.log(`Starting plugin import from file: ${file.name}`);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = JSON.parse(text);
        
        let pluginsToImport: Plugin[] = [];

        const isValidPlugin = (p: any): p is Plugin => {
          return p && typeof p.name === 'string' && typeof p.code === 'string';
        };

        if (Array.isArray(imported)) {
          pluginsToImport = imported.filter(isValidPlugin);
        } else if (isValidPlugin(imported)) {
          pluginsToImport = [imported];
        } else {
            throw new Error("Invalid plugin file format. Expected a plugin object or an array of plugins.");
        }

        if (pluginsToImport.length === 0) {
            alert("No valid plugins found in the file.");
            logger.warn("Plugin import completed with no valid plugins found.", { filename: file.name });
            return;
        }

        const newPlugins = pluginsToImport.map(p => ({
            ...p,
            id: crypto.randomUUID(), // Assign new ID to avoid conflicts
            enabled: false, // Import as disabled for security
        }));

        const finalPlugins = [...plugins, ...newPlugins];
        onPluginsUpdate(finalPlugins);
        logger.log(`${newPlugins.length} plugin(s) imported successfully. They are disabled by default.`);
        alert(`${newPlugins.length} plugin(s) imported successfully. They are disabled by default.`);

      } catch (error) {
        logger.error("Plugin import failed:", error);
        alert(`Failed to import plugins. Check logs for details. Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
  
  const handleSettingsChange = (key: string, value: any) => {
      setFormState(prev => ({
          ...prev,
          settings: {
              ...prev.settings,
              [key]: value
          }
      }));
  };
  
  const isDefaultImagePlugin = editingPlugin?.id === 'default-image-generator';
  const isDefaultTtsPlugin = editingPlugin?.id === 'default-tts-narrator';
  const isDefaultTerminalPlugin = editingPlugin?.id === 'default-terminal';

  const mediaType = formState.settings?.mediaType || 'image';

  const getCurrentServiceModels = () => {
    const service = formState.settings?.service || 'pollinations';
    if (service === 'pollinations') {
      if (mediaType === 'tts')   return liveModels.audio.length  ? liveModels.audio  : POLLINATIONS_AUDIO_MODELS;
      if (mediaType === 'video') return liveModels.video.length  ? liveModels.video  : POLLINATIONS_VIDEO_MODELS;
      return liveModels.image.length ? liveModels.image : POLLINATIONS_IMAGE_MODELS;
    }
    if (mediaType === 'tts')   return TTS_PROVIDER_MODELS[service]   || [];
    if (mediaType === 'video') return VIDEO_PROVIDER_MODELS[service] || [];
    return PROVIDER_MODELS[service] || [];
  };

  const currentModels = getCurrentServiceModels();
  // Keys & endpoints are server-side (nexus.env); the image proxy injects them. Only select
  // provider + model here. (Custom endpoints are declared in nexus.env as PROVIDER_<ID>_*.)
  const showApiEndpoint = false;
  const showApiKey = false;

  if (editingPlugin || isCreating) {
     return (
      <div className="flex-1 flex flex-col bg-background-secondary h-full">
         <header className="flex items-center p-4 border-b border-border-neutral flex-shrink-0">
            <h2 className="text-xl font-bold text-text-primary">{(isDefaultImagePlugin || isDefaultTerminalPlugin) ? 'Configure Plugin' : (editingPlugin ? 'Edit Plugin' : 'Create New Plugin')}</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="space-y-6 max-w-4xl mx-auto">
              <input
                type="text"
                placeholder="Plugin Name"
                value={formState.name}
                onChange={(e) => setFormState(s => ({...s, name: e.target.value}))}
                className="w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                readOnly={isDefaultImagePlugin || isDefaultTtsPlugin || isDefaultTerminalPlugin}
              />
              <textarea
                placeholder="Plugin Description"
                value={formState.description}
                onChange={(e) => setFormState(s => ({...s, description: e.target.value}))}
                rows={2}
                className="w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                readOnly={isDefaultTtsPlugin || isDefaultTerminalPlugin}
              />
              {isDefaultTerminalPlugin && (
                <div className="p-4 rounded-md border border-green-700/40 bg-green-900/10 space-y-4">
                  <h3 className="text-lg font-medium text-text-primary mb-1">Terminal Endpoint Configuration</h3>
                  <p className="text-xs text-text-secondary mb-3">
                    Set the URLs for aichat and Ollama. Characters with Terminal Access use these to run <code className="bg-background-tertiary px-1 rounded">ask</code> and <code className="bg-background-tertiary px-1 rounded">ollama ask</code> commands.
                    Start aichat with: <code className="bg-background-tertiary px-1 rounded">aichat --serve localhost:3030</code>
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary">aichat URL</label>
                      <input
                        type="text"
                        value={formState.settings?.aichatUrl || 'http://localhost:3030'}
                        onChange={(e) => handleSettingsChange('aichatUrl', e.target.value)}
                        placeholder="http://localhost:3030"
                        className="mt-1 block w-full bg-background-primary border border-border-strong rounded-md py-2 px-3 text-text-primary font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-text-secondary mt-1">OpenAI-compatible endpoint. aichat serves at /v1/chat/completions</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary">Ollama URL</label>
                      <input
                        type="text"
                        value={formState.settings?.ollamaUrl || 'http://localhost:11434'}
                        onChange={(e) => handleSettingsChange('ollamaUrl', e.target.value)}
                        placeholder="http://localhost:11434"
                        className="mt-1 block w-full bg-background-primary border border-border-strong rounded-md py-2 px-3 text-text-primary font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-text-secondary mt-1">Ollama native API. Start with: <code className="bg-background-tertiary px-1 rounded">ollama serve</code></p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border-neutral">
                    <p className="text-xs text-text-secondary">
                      In the terminal, type <code className="bg-background-tertiary px-1 rounded">api list</code> to see active URLs, <code className="bg-background-tertiary px-1 rounded">api status</code> to test connections.
                    </p>
                  </div>
                </div>
              )}
              {isDefaultImagePlugin && (
                <div className="p-4 rounded-md border border-nexus-gray-light-400 dark:border-nexus-gray-700 bg-nexus-gray-light-200/50 dark:bg-nexus-gray-800/50 space-y-4">
                  <h3 className="text-lg font-medium text-nexus-gray-900 dark:text-white mb-3">Media Generation Settings</h3>

                  {/* Media type selector */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary">Media Type</label>
                    <div className="mt-1 flex gap-2">
                      {['image', 'video', 'tts'].map(t => (
                        <button key={t}
                          onClick={() => {
                            const first = t === 'tts'   ? (liveModels.audio[0]  || POLLINATIONS_AUDIO_MODELS[0])
                                        : t === 'video' ? (liveModels.video[0]  || POLLINATIONS_VIDEO_MODELS[0])
                                        :                 (liveModels.image[0]  || POLLINATIONS_IMAGE_MODELS[0]);
                            setFormState(prev => ({
                              ...prev,
                              settings: { ...prev.settings, mediaType: t, service: 'pollinations', model: first }
                            }));
                          }}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium border ${mediaType === t ? 'bg-primary-600 border-primary-500 text-white' : 'bg-background-primary border-border-neutral text-text-secondary hover:text-text-primary'}`}
                        >{t.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>

                  {/* Image-specific settings */}
                  {mediaType === 'image' && (<>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                            <label htmlFor="image-style" className="block text-sm font-medium text-text-primary">Image Style</label>
                            <select id="image-style" value={formState.settings?.style || 'Default (None)'}
                                onChange={(e) => handleSettingsChange('style', e.target.value)}
                                className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                {imageStyles.map(style => <option key={style} value={style}>{style}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="negative-prompt" className="block text-sm font-medium text-text-primary">Negative Prompt</label>
                            <input type="text" id="negative-prompt" value={formState.settings?.negativePrompt || ''}
                                onChange={(e) => handleSettingsChange('negativePrompt', e.target.value)}
                                className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md shadow-sm py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none"
                                placeholder="e.g., ugly, blurry, deformed" />
                        </div>
                   </div>
                   {formState.settings?.style === 'Custom' && (
                       <div>
                          <label htmlFor="custom-style-prompt" className="block text-sm font-medium text-text-primary">Custom Style Prompt</label>
                          <textarea id="custom-style-prompt" value={formState.settings?.customStylePrompt || ''}
                              onChange={(e) => handleSettingsChange('customStylePrompt', e.target.value)}
                              rows={2} className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md shadow-sm py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none"
                              placeholder="e.g., in the style of vaporwave, cinematic lighting" />
                       </div>
                  )}
                  </>)}

                  {/* TTS-specific settings */}
                  {mediaType === 'tts' && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary">Voice</label>
                      <input type="text" value={formState.settings?.voice || 'nova'}
                        onChange={(e) => handleSettingsChange('voice', e.target.value)}
                        className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary focus:outline-none"
                        placeholder="e.g., nova, alloy, eleven_multilingual_v2" />
                      <p className="text-xs text-text-secondary mt-1">Pollinations voices: nova, alloy, echo, fable, onyx, shimmer</p>
                    </div>
                  )}

                  {/* Video-specific settings */}
                  {mediaType === 'video' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary">Duration (s)</label>
                        <input type="number" value={formState.settings?.duration || 4}
                          onChange={(e) => handleSettingsChange('duration', parseInt(e.target.value))}
                          className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary focus:outline-none"
                          min={1} max={30} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary">Aspect Ratio</label>
                        <select value={formState.settings?.aspectRatio || '16:9'}
                          onChange={(e) => handleSettingsChange('aspectRatio', e.target.value)}
                          className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary focus:outline-none">
                          <option>16:9</option><option>9:16</option><option>1:1</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <h3 className="text-lg font-medium text-nexus-gray-900 dark:text-white pt-4 border-t border-nexus-gray-light-400 dark:border-nexus-gray-700">Service Configuration</h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="api-service" className="block text-sm font-medium text-text-primary">API Service</label>
                      <select id="api-service"
                          value={formState.settings?.service || 'pollinations'}
                          onChange={(e) => {
                            const svc = e.target.value;
                            let modelList: string[];
                            if (svc === 'pollinations') {
                              modelList = mediaType === 'tts' ? (liveModels.audio  || POLLINATIONS_AUDIO_MODELS)
                                        : mediaType === 'video' ? (liveModels.video || POLLINATIONS_VIDEO_MODELS)
                                        : (liveModels.image || POLLINATIONS_IMAGE_MODELS);
                            } else {
                              modelList = mediaType === 'tts'   ? (TTS_PROVIDER_MODELS[svc]   || [])
                                        : mediaType === 'video' ? (VIDEO_PROVIDER_MODELS[svc] || [])
                                        : (PROVIDER_MODELS[svc] || []);
                            }
                            setFormState(prev => ({
                              ...prev,
                              settings: { ...prev.settings, service: svc, model: modelList[0] || '' }
                            }));
                          }}
                          className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                          <option value="pollinations">Pollinations.ai (key via nexus.env)</option>
                          {mediaType === 'image' && <>
                            <option value="aihorde">AI Horde (Free, No Key)</option>
                            <option value="huggingface">Hugging Face</option>
                            <option value="stability">Stability.ai</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI / DALL-E</option>
                            <option value="imagerouter">ImageRouter.io</option>
                          </>}
                          {mediaType === 'tts' && <>
                            <option value="openai">OpenAI TTS</option>
                            <option value="elevenlabs">ElevenLabs</option>
                          </>}
                          <option value="custom">Custom Endpoint</option>
                      </select>
                    </div>

                    {/* Dynamic Model Dropdown */}
                    <div>
                        <label htmlFor="api-model" className="block text-sm font-medium text-text-primary">Model</label>
                        <div className="flex gap-2">
                            <select
                                id="api-model-select"
                                value={currentModels.includes(formState.settings?.model) ? formState.settings?.model : 'custom'}
                                onChange={(e) => {
                                    if(e.target.value !== 'custom') {
                                        handleSettingsChange('model', e.target.value);
                                    } else {
                                        // If switching to custom, keep current value if it was not in list, or clear if it was
                                        if (currentModels.includes(formState.settings?.model)) {
                                            handleSettingsChange('model', '');
                                        }
                                    }
                                }}
                                className="flex-1 mt-1 block w-full bg-background-primary border border-border-neutral rounded-md shadow-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            >
                                {currentModels.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="custom">Other / Custom...</option>
                            </select>
                        </div>
                        {/* Show text input if 'custom' is effectively selected (value not in known list) */}
                        {(!currentModels.includes(formState.settings?.model) || currentModels.length === 0) && (
                             <input
                                id="api-model-text"
                                type="text"
                                value={formState.settings?.model || ''}
                                onChange={(e) => handleSettingsChange('model', e.target.value)}
                                className="mt-2 block w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder={formState.settings?.service === 'custom' ? 'Enter your custom model name' : 'Enter custom model ID'}
                            />
                        )}
                    </div>

                    {showApiEndpoint && (
                        <div>
                            <label htmlFor="api-endpoint" className="block text-sm font-medium text-nexus-gray-800 dark:text-nexus-gray-300">API Endpoint</label>
                            <input
                                id="api-endpoint"
                                type="text"
                                value={formState.settings?.apiEndpoint || ''}
                                onChange={(e) => handleSettingsChange('apiEndpoint', e.target.value)}
                                className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder={formState.settings?.service === 'custom' ? 'e.g., https://your-api-endpoint.com/v1/generate' : 'e.g., https://api.openai.com/v1/images/generations'}
                            />
                        </div>
                    )}

                    {showApiKey && (
                        <div>
                          <label htmlFor="api-key" className="block text-sm font-medium text-nexus-gray-800 dark:text-nexus-gray-300">API Key</label>
                          <input
                            id="api-key"
                            type="password"
                            value={formState.settings?.apiKey || ''}
                            onChange={(e) => handleSettingsChange('apiKey', e.target.value)}
                            className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md shadow-sm py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder={
                                formState.settings?.service === 'aihorde' ? '0000000000 for Anonymous' :
                                formState.settings?.service === 'pollinations' ? 'Required — paste your Pollinations sk_ key here' :
                                formState.settings?.service === 'custom' ? 'Enter your custom API key' :
                                'Enter API Key'
                            }
                          />
                        </div>
                    )}

                    <div>
                        <label htmlFor="plugin-api-rate-limit" className="block text-sm font-medium text-nexus-gray-800 dark:text-nexus-gray-300">Request Delay (ms)</label>
                        <input
                            id="plugin-api-rate-limit"
                            type="number"
                            value={formState.settings?.rateLimit || ''}
                            onChange={(e) => handleSettingsChange('rateLimit', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            className="mt-1 block w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., 1000 (for 1 request per second)"
                            min="0"
                        />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col h-96">
                <label className="block text-sm font-medium text-nexus-gray-800 dark:text-nexus-gray-300 mb-1">Plugin Code (JavaScript)</label>
                <textarea
                  placeholder="Enter your plugin code here..."
                  value={formState.code}
                  onChange={(e) => setFormState(s => ({...s, code: e.target.value}))}
                  className={`flex-1 w-full bg-background-primary border border-border-neutral rounded-md py-2 px-3 text-text-primary placeholder-text-secondary font-mono text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 resize-none ${(isDefaultImagePlugin || isDefaultTtsPlugin || isDefaultTerminalPlugin) ? 'opacity-70 cursor-not-allowed' : ''}`}
                  spellCheck="false"
                  readOnly={isDefaultImagePlugin || isDefaultTtsPlugin || isDefaultTerminalPlugin}
                />
              </div>
              <div className="flex justify-end space-x-4 pb-4">
                <button onClick={handleCancel} className="py-2 px-4 rounded-md text-text-primary bg-background-tertiary hover:bg-opacity-80">Cancel</button>
                <button onClick={handleSave} className="py-2 px-4 rounded-md text-text-accent bg-primary-600 hover:bg-primary-500">Save Plugin</button>
              </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background-secondary">
        <header className="flex items-center p-4 border-b border-border-neutral flex-shrink-0">
            <div className="flex-1 flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Plugin Manager</h2>
                <div className="flex items-center space-x-2">
                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} title="Import Plugin(s) from File" className="flex items-center space-x-2 py-2 px-3 rounded-md text-text-primary bg-background-tertiary hover:bg-opacity-80">
                        <UploadIcon className="w-5 h-5"/>
                        <span>Import</span>
                    </button>
                    <button onClick={handleExportAll} title="Export All Plugins" className="flex items-center space-x-2 py-2 px-3 rounded-md text-text-primary bg-background-tertiary hover:bg-opacity-80">
                        <DownloadIcon className="w-5 h-5"/>
                        <span>Export All</span>
                    </button>
                    <button onClick={() => setIsCreating(true)} title="Create a New Plugin" className="flex items-center space-x-2 py-2 px-4 rounded-md text-text-accent bg-primary-600 hover:bg-primary-500">
                        <PlusIcon className="w-5 h-5" />
                        <span>New Plugin</span>
                    </button>
                </div>
            </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="space-y-4 max-w-4xl mx-auto">
                {plugins.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">No plugins installed. Click 'New Plugin' to create one.</p>
                ) : (
                  plugins.map(plugin => (
                    <div key={plugin.id} className="bg-background-primary p-4 rounded-lg flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold text-text-primary truncate">{plugin.name}</p>
                        <p className="text-sm text-text-secondary truncate">{plugin.description}</p>
                      </div>
                      <div className="flex items-center space-x-3 ml-4">
                        <button onClick={() => handleExportPlugin(plugin)} title="Export Plugin" className="text-text-secondary hover:text-text-primary"><DownloadIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleToggle(plugin.id)} title={plugin.enabled ? 'Disable' : 'Enable'}>
                          <PowerIcon className={`w-6 h-6 ${(plugin.id === 'default-image-generator' || plugin.id === 'default-tts-narrator' || plugin.id === 'default-terminal') ? 'text-nexus-green-500 cursor-not-allowed' : (plugin.enabled ? 'text-nexus-green-500' : 'text-nexus-gray-500 hover:text-white')}`}/>
                        </button>
                        <button onClick={() => setEditingPlugin(plugin)} title={plugin.id === 'default-image-generator' ? 'Configure Plugin' : 'Edit Plugin'} className="text-text-secondary hover:text-text-primary"><EditIcon className="w-5 h-5" /></button>
                        {plugin.id !== 'default-image-generator' && plugin.id !== 'default-tts-narrator' && plugin.id !== 'default-terminal' && (
                            <button onClick={() => handleDelete(plugin.id)} title="Delete Plugin" className="text-text-secondary hover:text-accent-red"><TrashIcon className="w-5 h-5" /></button>
                        )}
                      </div>
                    </div>
                  ))
                )}
            </div>
        </div>
    </div>
  );
};
