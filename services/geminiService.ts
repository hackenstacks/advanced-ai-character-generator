
// All providers route through web server proxy — no direct SDK usage.

// Safety: No content filtering. Characters include mature/adult content by design.
// This is applied at the proxy level — ensure your provider endpoints also have safety disabled.
const NO_SAFETY_FILTERS = {
  // For OpenAI-compatible: most don't have explicit safety params (account-level config)
  // For custom providers: add safety disable flags as needed
};

export const SAFETY_SETTINGS_NONE = NO_SAFETY_FILTERS;
import { Character, Message, ApiConfig } from "../types";
import { logger } from "./loggingService";

// --- Rate Limiting ---
const lastRequestTimestamps = new Map<string, number>();

// --- Provider Routing via Proxy ---
// ALL requests go through the web server proxy (/api/llm/<provider>/v1/chat/completions).
// Server injects API keys server-side — no keys in browser, ever.
// See ~/Projects/nexus-web-server/nexus_web_server.py for proxy implementation.
//
// SAFETY POLICY: No content filtering at the application level.
// - Character generation allows all content (mature roleplay, explicit characters, etc.)
// - Safety is configured ENTIRELY at the provider level (account settings, not request-level)
// - OpenAI-compatible endpoints don't expose safety params in POST body
// - For zero filtering: use Ollama (local) or configure provider accounts with safety disabled
// - Users are responsible for their provider's safety/moderation policies
//
// This is by design: YOU are the judge. Not Google. Not corporate filters.

// --- Helper: Blob to Base64 ---
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix if present (e.g. "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        return `data:${blob.type};base64,${base64}`;
    } catch (e) {
        return url; // Return URL if conversion fails
    }
};

// --- OpenAI Compatible Service ---

const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    return (
        error.name === 'TypeError' ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('connection refused')
    );
};

/**
 * A generic wrapper for async functions that includes a retry mechanism with exponential backoff.
 */
const withRetry = async <T,>(
    apiCall: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 2000
): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await apiCall();
        } catch (error: any) {
            let isRateLimitError = false;
            let errorMessage = "An unknown error occurred";

            if (error && typeof error.message === 'string') {
                 errorMessage = error.message;
                 if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                     isRateLimitError = true;
                 }
            } else if (error instanceof Response && (error.status === 429 || error.status === 503)) {
                isRateLimitError = true;
            }

            const networkError = isNetworkError(error);

            if (isRateLimitError || networkError) {
                 if (attempt + 1 >= maxRetries) {
                    if (networkError) {
                        throw new Error(`Network error: ${errorMessage}. If running locally, this is likely a CORS restriction.`);
                    }
                    logger.warn(`API rate limit exceeded. All ${maxRetries} retries failed. Rethrowing final error.`);
                    throw error;
                }
                const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
                logger.warn(`API error (${errorMessage}). Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
                continue;
            }
            
            logger.error("API call failed with non-retriable error:", error);
            throw error;
        }
    }
    throw new Error('API request failed to complete after all retries.');
};

const fetchWithRetry = async (
    url: RequestInfo, 
    options: RequestInit, 
    maxRetries = 3, 
    initialDelay = 2000
): Promise<Response> => {
    return withRetry(async () => {
        const response = await fetch(url, options);
        if (response.status === 429) {
             throw new Error('429 Too Many Requests');
        }
        return response;
    }, maxRetries, initialDelay);
};

const streamOpenAIChatResponse = async (
    config: ApiConfig,
    systemInstruction: string,
    history: Message[],
    onChunk: (chunk: string) => void
): Promise<void> => {
    const messages = [
        { role: 'system', content: systemInstruction },
        ...history.map(m => {
            let role = 'user';
            let content = m.content;
            
            if (m.role === 'model') {
                role = 'assistant';
            } else if (m.role === 'narrator') {
                // Map narrator to user with prefix to avoid validation errors on strict endpoints
                // that don't support custom roles or misplaced system messages.
                role = 'user'; 
                content = `[Narrator]: ${m.content}`;
            }
            // Ensure no invalid roles are passed
            return { role, content };
        })
    ];

    // Route through the same-origin proxy (/api/llm/<service>) so the key is injected server-side.
    // Fall back to a direct endpoint only outside a browser (e.g. tests).
    const inBrowser = typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol);
    const url = inBrowser
        ? `${window.location.origin}/api/llm/${config.service}/v1/chat/completions`
        : (config.apiEndpoint || 'http://localhost:3030/v1/chat/completions');

    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },   // no Authorization — server injects the key
            body: JSON.stringify({
                model: config.model || 'default',
                messages: messages,
                stream: true,
            }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized (401). Please check your API Key in Character Settings.');
            }
            const errorText = await response.text();
            throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
        }

        if (!response.body) throw new Error('Response body is null');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') return;
                    try {
                        const json = JSON.parse(data);
                        const content = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text;
                        if (content) onChunk(content);
                    } catch (e) {
                        // Ignore parse errors for partial chunks
                    }
                }
            }
        }
    } catch (error) {
        logger.error("Error streaming OpenAI response:", error);
        onChunk(`[Error: ${error instanceof Error ? error.message : String(error)}]`);
    }
};

const streamPollinationsChatResponse = async (
    config: ApiConfig,
    systemInstruction: string,
    history: Message[],
    onChunk: (chunk: string) => void
): Promise<void> => {
    // Use POST with messages array to avoid URL length limits and structure data correctly
    const messages = [
        { role: 'system', content: systemInstruction },
        ...history.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.role === 'narrator' ? `[Narrator]: ${m.content}` : m.content
        }))
    ];

    const model = config.model || 'openai';

    // Authenticated Pollinations API (gen.pollinations.ai). The sk_ key is entered by the user in
    // the character's API-key field — never hardcoded. `referrer` attributes usage to this app,
    // which qualifies for the doubled-credit program.
    const pollHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey && config.apiKey.trim()) {
        pollHeaders['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    try {
        const response = await fetchWithRetry('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: pollHeaders,
            body: JSON.stringify({
                messages: messages,
                model: model,
                referrer: 'nexus-char-gen', // App attribution for doubled credits.
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Pollinations API Error (${response.status}): ${errText}`);
        }
        
        // Pollinations might return raw text or JSON depending on the mood of the day/model
        const raw = await response.text();
        
        try {
            // Attempt to parse as JSON to see if it follows OpenAI format
            if (raw.trim().startsWith('{')) {
                const json = JSON.parse(raw);
                // Check for OpenAI format
                if (json.choices && json.choices[0] && json.choices[0].message) {
                    onChunk(json.choices[0].message.content);
                    return;
                }
                // Check for direct response format if any
                if (json.response) {
                    onChunk(json.response);
                    return;
                }
            }
        } catch (e) {
            // Not JSON, continue to return raw text
        }

        onChunk(raw);

    } catch (error) {
        logger.error("Error generating Pollinations response:", error);
        onChunk(`[Error: ${error instanceof Error ? error.message : String(error)}]`);
    }
};

const buildImagePrompt = (prompt: string, settings: { [key: string]: any }): string => {
    let stylePrompt = '';
    if (settings.style && settings.style !== 'Default (None)') {
        if (settings.style === 'Custom' && settings.customStylePrompt) {
            stylePrompt = `${settings.customStylePrompt}, `;
        } else if (settings.style !== 'Custom') {
             stylePrompt = `${settings.style} style, `;
        }
    }
    const negativePrompt = settings.negativePrompt ? `. Negative prompt: ${settings.negativePrompt}` : '';
    return `${stylePrompt}${prompt}${negativePrompt}`;
};

// --- Image Generators ---

const generateGeminiImage = async (prompt: string, settings: { [key: string]: any }): Promise<string> => {
    const ai = getAiClient(settings?.apiKey);
    const fullPrompt = buildImagePrompt(prompt, settings);
    logger.log("Generating Gemini image with full prompt:", { fullPrompt });

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: fullPrompt }],
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                }
            }
        }));

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
             throw new Error("No candidates returned from Gemini API.");
        }

        const parts = candidates[0].content?.parts || [];
        
        for (const part of parts) {
            if (part.inlineData) {
                const base64EncodeString: string = part.inlineData.data;
                return `data:image/png;base64,${base64EncodeString}`;
            }
        }

        for (const part of parts) {
            if (part.text) {
                throw new Error(`Model refused or failed to generate image. Response: ${part.text}`);
            }
        }
        
        throw new Error("No image data found in response.");

    } catch (error) {
        logger.error("Error generating image with gemini-2.5-flash-image:", error);
        throw error;
    }
};

const generateOpenAIImage = async (prompt: string, settings: { [key: string]: any }): Promise<string> => {
    const apiEndpoint = settings.apiEndpoint || 'https://api.openai.com/v1/images/generations';
    const apiKey = settings.apiKey;
    const model = settings.model || 'dall-e-3';
    
    if (!apiKey && apiEndpoint.includes('openai.com')) {
        throw new Error("API Key is required for OpenAI image generation.");
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const fullPrompt = buildImagePrompt(prompt, settings);

    const body = JSON.stringify({
        model: model,
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
    });

    const response = await fetchWithRetry(apiEndpoint, {
        method: 'POST',
        headers,
        body
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI Image API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    if (data.data && data.data.length > 0) {
        if (data.data[0].b64_json) {
            return `data:image/png;base64,${data.data[0].b64_json}`;
        } else if (data.data[0].url) {
            return await imageUrlToBase64(data.data[0].url);
        }
    }
    throw new Error("No image data returned from OpenAI API.");
};

const generatePollinationsImage = async (prompt: string, settings: { [key: string]: any }): Promise<string> => {
    // Valid Pollinations.ai IMAGE models — synced to the authoritative API reference
    // (~/claude/docs/pollinations-api-reference.md, GET /image/models). Video-only models
    // (veo/seedance/wan-video) intentionally excluded — this is the image path.
    const validPollinationsModels = [
        'kontext', 'nanobanana', 'nanobanana-2', 'nanobanana-pro',
        'seedream5', 'seedream', 'seedream-pro',
        'ideogram-v4-turbo', 'ideogram-v4-balanced', 'ideogram-v4-quality',
        'gptimage', 'gptimage-large', 'gpt-image-2',
        'flux', 'zimage', 'wan-image', 'wan-image-pro', 'qwen-image',
        'grok-imagine', 'grok-imagine-pro', 'klein',
        'p-image', 'p-image-edit', 'nova-canvas'
    ];
    
    // Map common model names to valid Pollinations.ai models
    const modelMap: { [key: string]: string } = {
        'flux': 'flux',
        'stable_diffusion': 'kontext',  // Map to kontext as closest equivalent
        'dall-e': 'gptimage',
        'midjourney': 'seedream',
        'anything': 'nanobanana',
        'openjourney': 'seedream',
        'sd': 'kontext',
        'sdxl': 'kontext',
        'default': 'flux'
    };
    
    // Get the requested model and validate it
    let model = settings.model || 'flux';
    
    // Try to map common model names to valid Pollinations.ai models
    if (modelMap[model]) {
        model = modelMap[model];
    }
    
    // Validate that the final model is in the list of supported models
    if (!validPollinationsModels.includes(model)) {
        logger.warn(`Invalid Pollinations.ai model: ${model}. Falling back to 'flux'.`);
        model = 'flux'; // Default to flux if invalid
    }
    const apiKey = settings.apiKey;
    const fullPrompt = buildImagePrompt(prompt, settings);
    const encodedPrompt = encodeURIComponent(fullPrompt);
    
    // SANE·SIMPLE·SECURE·SUSTAINABLE key handling:
    //  • If a key is set in plugin settings, call Pollinations directly (explicit user override).
    //  • Otherwise route through the SAME-ORIGIN server proxy (/api/pollinations/image), which
    //    injects the sk_ key server-side from ~/.config/nexus/secrets/nexus.env. The browser
    //    never holds the secret key (Pollinations docs: never expose sk_ in client-side code).
    // Direct-mode auth: key MUST be the ?key= query param (NOT ?api_key=) with NO Authorization
    // header — an auth header on a cross-origin image GET triggers a CORS preflight that strips it
    // → 401. nologo=true removes the watermark; explicit width/height give consistent output
    // (mirrors the proven char-gen-cli-go/pollinations.go patch). Defaults to 1024×1024.
    const w = settings.width || 1024;
    const h = settings.height || 1024;
    const dims = `&width=${w}&height=${h}&nologo=true`;
    // In a browser we ALWAYS use the same-origin proxy — the sk_ key stays server-side and any
    // client-side key in plugin settings is intentionally ignored (a stale/bad saved key must never
    // break image gen, and must never be sent from the client). Direct mode is only for non-browser
    // contexts (SSR/tests) that pass an explicit key.
    const inBrowser = typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin);
    const usingProxy = inBrowser;
    let url: string;
    if (usingProxy) {
        url = `${window.location.origin}/api/pollinations/image?prompt=${encodedPrompt}&model=${encodeURIComponent(model)}&width=${w}&height=${h}`;
    } else if (apiKey) {
        url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}${dims}&key=${encodeURIComponent(apiKey)}&referrer=nexus-char-gen`;
    } else {
        throw new Error('Pollinations.ai needs a key: set POLLINATIONS_API_KEY in ~/.config/nexus/secrets/nexus.env (server proxy) or provide an explicit key in a non-browser context.');
    }

    try {
        // Simple GET (no custom headers) so the browser doesn't preflight and drop auth.
        const response = await fetchWithRetry(url, { method: 'GET' });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pollinations API Error (${response.status}): ${errorText}`);
        }
        
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        return `data:${blob.type};base64,${base64}`;
    } catch (e) {
        logger.warn("Failed to download Pollinations image.", e);

        // Proxy mode (browser): the same-origin server proxy already handled auth; don't attempt
        // direct cross-origin fallbacks (they'd expose/require a client key). Surface the error.
        if (usingProxy) {
            throw new Error('Pollinations image via server proxy failed. Check the server log and that a valid POLLINATIONS_API_KEY (sk_...) is set in ~/.config/nexus/secrets/nexus.env. ' + (e instanceof Error ? e.message : ''));
        }

        // Direct mode: try alternative Pollinations.ai endpoints if the main one fails
        // All fallback URLs include the API key since it's required
        const k = encodeURIComponent(apiKey);
        const fallbackUrls = [
            `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}${dims}&key=${k}&referrer=nexus-char-gen`,
            `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}${dims}&key=${k}`,
            `https://pollinations.ai/prompt/${encodedPrompt}?model=${model}${dims}&key=${k}`
        ];

        for (const fallbackUrl of fallbackUrls) {
            try {
                // key is in the URL; no auth header → simple GET, no CORS preflight
                const fallbackResponse = await fetch(fallbackUrl);
                if (fallbackResponse.ok) {
                    const blob = await fallbackResponse.blob();
                    const base64 = await blobToBase64(blob);
                    logger.log("Pollinations.ai fallback succeeded with URL:", fallbackUrl);
                    return `data:${blob.type};base64,${base64}`;
                }
            } catch (fallbackError) {
                logger.debug(`Pollinations.ai fallback failed: ${fallbackUrl} - ${fallbackError}`);
            }
        }
        
        // If all attempts fail, throw a comprehensive error with model guidance
        throw new Error('Pollinations.ai image generation failed. All endpoints attempted. ' +
                       'Please check your API key and network connection. ' +
                       'Valid models: kontext, turbo, nanobanana, nanobanana-pro, seedream, seedream-pro, ' +
                       'gptimage, gptimage-large, flux, zimage, veo, seedance, seedance-pro, ' +
                       'gpt-image, gpt-image-1-mini, gpt-image-1.5, gpt-image-large, ' +
                       'z-image, z-image-turbo, veo-3.1-fast, video. ' +
                       'You can get a free API key from pollinations.ai');
    }
};

const generateHuggingFaceImage = async (prompt: string, settings: { [key: string]: any }): Promise<string> => {
    const model = settings.model || 'black-forest-labs/FLUX.1-dev';
    const apiKey = settings.apiKey;
    const url = `https://api-inference.huggingface.co/models/${model}`;
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const fullPrompt = buildImagePrompt(prompt, settings);

    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ inputs: fullPrompt })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Hugging Face API Error (${response.status}): ${err}`);
        }

        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        return `data:${blob.type};base64,${base64}`;
    } catch (error: any) {
        // Fallback for CORS issues typical in local browser environments
        const msg = String(error.message || error).toLowerCase();
        if (msg.includes('network error') || msg.includes('failed to fetch') || msg.includes('cors')) {
            logger.warn("Hugging Face direct call failed (likely CORS). Falling back to Pollinations.ai");
            // Automatically try Pollinations with Flux (similar model)
            return await generatePollinationsImage(prompt, { ...settings, model: 'flux' });
        }
        throw error;
    }
};

const generateStabilityImage = async (prompt: string, settings: { [key: string]: any }): Promise<string> => {
    const apiKey = settings.apiKey;
    if (!apiKey) throw new Error("API Key is required for Stability.ai");
    
    const model = settings.model || 'stable-diffusion-xl-1024-v1-0';
    const url = `https://api.stability.ai/v1/generation/${model}/text-to-image`;
    const fullPrompt = buildImagePrompt(prompt, settings);

    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            text_prompts: [{ text: fullPrompt }],
            cfg_scale: 7,
            height: 1024,
            width: 1024,
            samples: 1,
            steps: 30,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Stability API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    if (data.artifacts && data.artifacts.length > 0) {
        return `data:image/png;base64,${data.artifacts[0].base64}`;
    }
    throw new Error("No artifacts returned from Stability API.");
};

const generateAIHordeImage = async (prompt: string, settings: { [key: string]: any }): Promise<string> => {
    const apiKey = settings.apiKey || '0000000000';
    const model = settings.model || 'stable_diffusion';
    const fullPrompt = buildImagePrompt(prompt, settings);
    
    // Valid AI Horde samplers (as per current API requirements)
    const validSamplers = [
        'k_dpmpp_2s_a', 'k_euler', 'k_dpm_adaptive', 'k_dpmpp_2m', 
        'k_dpmpp_sde', 'k_dpm_2', 'k_dpm_2_a', 'k_heun', 'k_euler_a', 
        'k_lms', 'lcm', 'k_dpm_fast', 'dpmsolver', 'DDIM'
    ];
    
    // Ensure we use a valid sampler - default to 'k_euler' if none specified or invalid
    const samplerName = settings.sampler_name && validSamplers.includes(settings.sampler_name) 
        ? settings.sampler_name 
        : 'k_euler';
    
    // Enhanced parameters for better compatibility with AI Horde
    // These are set by default since users can't configure them in the UI
    const hordeParams = {
        prompt: fullPrompt,
        params: {
            n: 1,
            steps: 20,
            width: 512,
            height: 512,
            cfg_scale: 7.5,
            sampler_name: samplerName,  // Use validated sampler
            // Additional parameters for better results
            denoising_strength: 0.75,
            seed: Math.floor(Math.random() * 2147483647).toString(), // Convert seed to string to fix validation error
        },
        models: [model],
        nsfw: true,
        censor_nsfw: false,
        // Add worker blacklist to avoid problematic workers
        workers: [],
        // Add r2 for better queue handling
        r2: true,
        // Enable trusted workers for better quality
        trusted_workers: false, // Anonymous users can't use trusted workers
        // Set reasonable timeout
        timeout: 120,
    };
    
    // Adjust parameters based on whether user has a real API key or is anonymous
    if (apiKey === '0000000000') {
        // Anonymous user settings - more conservative to avoid rejection
        hordeParams.params.steps = 15; // Fewer steps for anonymous
        hordeParams.params.width = 512; // Standard size
        hordeParams.params.height = 512;
        hordeParams.params.cfg_scale = 7.0; // Slightly lower CFG scale
        hordeParams.trusted_workers = false; // Anonymous can't use trusted workers
    } else {
        // Registered user settings - better quality
        hordeParams.params.steps = 20;
        hordeParams.params.cfg_scale = 7.5;
        hordeParams.trusted_workers = true; // Use trusted workers if available
    }
    
    const initResponse = await fetchWithRetry('https://stablehorde.net/api/v2/generate/async', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
            'Client-Agent': 'AI_Nexus:1.0:Unknown',
        },
        body: JSON.stringify(hordeParams)
    });

    if (!initResponse.ok) {
        const err = await initResponse.text();
        let errorMessage = `AI Horde Init Error: ${err}`;
        
        // Provide more helpful error messages for common issues
        if (apiKey === '0000000000') {
            errorMessage += '\n\nNote: You are using anonymous access (API key: 0000000000). ' +
                          'Anonymous users have limited priority and may experience longer wait times. ' +
                          'Consider getting a free API key from stablehorde.net for better results.';
        }
        
        // Check for specific validation errors and provide guidance
        if (err.includes('sampler_name')) {
            errorMessage += '\n\nValid samplers are: k_dpmpp_2s_a, k_euler, k_dpm_adaptive, k_dpmpp_2m, k_dpmpp_sde, k_dpm_2, k_dpm_2_a, k_heun, k_euler_a, k_lms, lcm, k_dpm_fast, dpmsolver, DDIM';
        }
        
        if (err.includes('seed') && err.includes('not of type')) {
            errorMessage += '\n\nNote: Seed must be a string, not a number.';
        }
        
        throw new Error(errorMessage);
    }

    const initData = await initResponse.json();
    const id = initData.id;
    if (!id) throw new Error("AI Horde did not return a Job ID.");

    let attempts = 0;
    while (attempts < 60) {
        await new Promise(r => setTimeout(r, 2000));
        const statusResponse = await fetch(`https://stablehorde.net/api/v2/generate/status/${id}`);
        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.done) {
                if (statusData.generations && statusData.generations.length > 0) {
                    const gen = statusData.generations[0];
                    return gen.img; 
                }
                throw new Error("AI Horde finished but returned no image.");
            }
            if (!statusData.is_possible) {
                let errorMessage = "AI Horde says generation is impossible with current settings.";
                
                // Provide specific guidance for anonymous users
                if (apiKey === '0000000000') {
                    errorMessage += '\n\nThis often happens with anonymous access. Try these solutions:\n' +
                                  '1. Get a free API key from stablehorde.net\n' +
                                  '2. Use a different model (try "stable_diffusion")\n' +
                                  '3. Reduce image size or complexity\n' +
                                  '4. Wait a few minutes and try again';
                }
                
                throw new Error(errorMessage);
            }
        }
        attempts++;
    }
    throw new Error("AI Horde generation timed out. The queue might be busy. Try again later.");
};


// Helper function to convert thinking parameters for Gemini 3 compatibility
const getThinkingConfig = (modelName: string, thinkingEnabled: boolean): any => {
    // List of Gemini 3 models that use thinkingLevel instead of thinkingBudget
    const gemini3Models = [
        'gemini-3-pro-preview',
        'gemini-3-flash-preview',
        'gemini-3-pro',
        'gemini-3-flash'
    ];
    
    if (!thinkingEnabled) {
        return undefined;
    }
    
    // Check if this is a Gemini 3 model
    if (gemini3Models.includes(modelName)) {
        // Gemini 3 uses thinkingLevel (string)
        return {
            thinkingLevel: 'high',  // 'high' or 'low'
            includeThoughts: true
        };
    } else {
        // Gemini 2 uses thinkingBudget (number)
        return {
            thinkingBudget: 32768  // Number of tokens
        };
    }
};

// --- Gemini Service ---

const buildSystemInstruction = (character: Character, allParticipants: Character[] = []): string => {
    let instruction = `You are an AI character named ${character.name}.\n\n`;

    if (allParticipants.length > 1) {
        const otherParticipantNames = allParticipants
            .filter(p => p.id !== character.id)
            .map(p => p.name)
            .join(', ');
        instruction += `You are in a group conversation with: ${otherParticipantNames}. Interact with them naturally based on your persona.\n\n`;
    }

    instruction += "== CORE IDENTITY ==\n";
    if (character.description) instruction += `Description: ${character.description}\n`;
    if (character.physicalAppearance) instruction += `Physical Appearance: ${character.physicalAppearance}\n`;
    if (character.personalityTraits) instruction += `Personality Traits: ${character.personalityTraits}\n`;
    instruction += "\n";

    if (character.personality) {
        instruction += "== ROLE INSTRUCTION ==\n";
        instruction += `${character.personality}\n\n`;
    }

    if (character.memory) {
        instruction += "== MEMORY (Recent Events) ==\n";
        instruction += `${character.memory}\n\n`;
    }

    if (character.lore && character.lore.length > 0 && character.lore.some(l => l.trim() !== '')) {
        instruction += "== LORE (Key Facts) ==\n";
        instruction += character.lore.filter(fact => fact.trim() !== '').map(fact => `- ${fact}`).join('\n') + '\n\n';
    }

    // Tools instruction
    instruction += "== TOOLS ==\n";
    if (character.searchEnabled) {
        instruction += "You have access to Google Search to find real-time information. Use it when the user asks about current events or factual topics.\n";
    }
    if (character.terminalEnabled) {
        // Provider-agnostic terminal awareness. Without this, non-Gemini characters (e.g. on AI
        // Horde/Pollinations) never learn they have a terminal and wrongly claim they cannot browse.
        // Written ASSERTIVELY on purpose: a strong "truth-first" persona will otherwise override a
        // soft note and defer to the user ("paste the output", "what OS are you on?").
        instruction += "CAPABILITY — YOU HAVE A REAL, WORKING TERMINAL IN THIS APP. This is a true fact about you, not a hypothetical: this application executes commands you emit and returns their real output to you. It is YOUR OWN sandboxed terminal with live internet — it is NOT the user's computer.\n";
        instruction += "To run a command, put it in a fenced bash block, e.g.:\n```bash\nsearch latest AI news\n```\n";
        instruction += "Available commands: `search <query>` (real web search), `curl <url>` / `http GET <url>` (fetch a live page), `ask <question>` (local AI), `py <code>` (run Python), `ls`/`cat` (sandbox files).\n";
        instruction += "RULES: When asked for real-time or current information, you MUST emit a `search` command yourself. NEVER claim you cannot browse. NEVER ask the user to run a command, paste output, or tell you their OS — YOU run it. After you emit the command the app returns `[Terminal Output]`; then continue using that result. Emit the command first, commentary after.\n";
    }
    instruction += "You can see images and hear audio if provided. Analyze them as your character would.\n";
    instruction += "You have the ability to generate images. To do so, include a special command in your response: [generate_image: A detailed description of the image you want to create].\n\n";
    
    instruction += "Engage in conversation based on this complete persona. Do not break character. Respond to the user's last message.";

    return instruction;
};

const normalizeGeminiHistory = (history: Message[]) => {
    const relevantMessages = history.filter(msg => msg.role === 'user' || msg.role === 'model' || msg.role === 'narrator');
    if (relevantMessages.length === 0) return [];

    const mapped = relevantMessages.map(msg => {
        const role = msg.role === 'model' ? 'model' : 'user';
        let parts: any[] = [];

        // Handle text content
        const textContent = msg.role === 'narrator' ? `[NARRATOR]: ${msg.content}` : msg.content;
        if (textContent.trim()) {
            parts.push({ text: textContent });
        }

        // Handle multimodal attachments (Images, Audio, Video)
        if (msg.attachment && msg.attachment.url && msg.attachment.status === 'done') {
            const base64Data = msg.attachment.url.split(',')[1]; // Remove data:mime;base64,
            if (base64Data) {
                parts.push({
                    inlineData: {
                        mimeType: msg.attachment.mimeType || 'image/png', // Default or actual mime
                        data: base64Data
                    }
                });
            }
        }

        return { role, parts };
    });

    // Merge consecutive messages of the same role to satisfy API requirements
    const merged = [];
    if (mapped.length > 0) {
        merged.push(mapped[0]);
        for (let i = 1; i < mapped.length; i++) {
            const prev = merged[merged.length - 1];
            const curr = mapped[i];
            if (prev.role === curr.role) {
                // Combine parts
                prev.parts = [...prev.parts, ...curr.parts];
            } else {
                merged.push(curr);
            }
        }
    }
    
    return merged;
};

// --- Tool Definitions ---

const terminalTool: any = {
    name: "execute_terminal_command",
    description: "Execute a shell command in a restricted Linux terminal. Use this to read files, write files, create directories, or list files. The user must approve every command.",
    parameters: {
        type: "OBJECT",
        properties: {
            command: {
                type: "STRING",
                description: "The bash command to execute (e.g., 'ls -la', 'cat file.txt', 'echo \"hello\" > file.txt')."
            }
        },
        required: ["command"]
    }
};

const googleSearchTool = { googleSearch: {} };

const getToolsForCharacter = (character: Character) => {
    const tools: any[] = [];
    
    if (character.searchEnabled) {
        tools.push(googleSearchTool);
    }
    
    if (character.terminalEnabled) {
        tools.push({ functionDeclarations: [terminalTool] });
    }
    
    return tools.length > 0 ? tools : undefined;
};

const streamGeminiChatResponse = async (
    character: Character,
    systemInstruction: string,
    history: Message[],
    onChunk: (chunk: string | any) => void
): Promise<void> => {
    try {
        const customApiKey = character.apiConfig?.service === 'gemini' ? character.apiConfig.apiKey : undefined;
        const ai = getAiClient(customApiKey);
        
        const contents = normalizeGeminiHistory(history);
        if (contents.length === 0) {
            logger.warn("streamGeminiChatResponse was called with an empty effective history. Aborting.");
            return;
        }

        let modelName = 'gemini-2.5-flash';
        let config: any = { systemInstruction: systemInstruction, safetySettings: SAFETY_SETTINGS_NONE };

        if (character.thinkingEnabled) {
            modelName = 'gemini-3-pro-preview';
            // Gemini 3 uses thinkingLevel (string) instead of thinkingBudget (number)
            config.thinkingConfig = { 
                thinkingLevel: 'high',  // 'high' or 'low'
                includeThoughts: true
            }; 
        } 
        
        const tools = getToolsForCharacter(character);
        if (tools) {
            config.tools = tools;
        }

        logger.log(`Calling Gemini with model: ${modelName}`, { tools: !!tools });

        const responseStream = await withRetry(() => ai.models.generateContentStream({
            model: modelName,
            contents: contents,
            config: config
        })) as AsyncIterable<GenerateContentResponse>;

        for await (const chunk of responseStream) {
            // Handle Tool Calls
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                // Pass the whole function call object to be handled by the UI
                onChunk({ type: 'tool_call', data: chunk.functionCalls[0] });
                return; // Stop processing text chunks if we got a tool call
            }
            
            if (chunk.text) {
                onChunk(chunk.text);
            }
        }
    } catch (error) {
        logger.error("Error generating Gemini content stream:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        onChunk(`Sorry, an error occurred with the Gemini API: ${errorMessage}`);
    }
};

// --- TTS Service ---

export const generateSpeech = async (text: string, voiceName: string = 'Puck', apiKey?: string): Promise<Uint8Array> => {
    try {
        const ai = getAiClient(apiKey);
        logger.log(`Generating speech for: "${text.substring(0, 30)}..." using voice: ${voiceName}`);

        const response = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        })) as GenerateContentResponse;

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from Gemini TTS.");
        }

        return base64ToUint8Array(base64Audio);

    } catch (error) {
        logger.error("Error generating speech:", error);
        throw error;
    }
};


// --- AI Horde Text Generation ---

const streamAIHordeTextResponse = async (
    config: ApiConfig,
    systemInstruction: string,
    history: Message[],
    onChunk: (chunk: string) => void
): Promise<void> => {
    const apiKey = config.apiKey || '0000000000'; // anonymous key
    const model = config.model || ''; // empty = any available model

    // Build a single prompt from system instruction + conversation history
    let prompt = '';
    if (systemInstruction) {
        prompt += `### System:\n${systemInstruction}\n\n`;
    }
    for (const msg of history) {
        if (msg.role === 'user') {
            prompt += `### Human:\n${msg.content}\n\n`;
        } else if (msg.role === 'model') {
            prompt += `### Assistant:\n${msg.content}\n\n`;
        }
    }
    prompt += '### Assistant:\n';

    const requestBody: any = {
        prompt,
        params: {
            max_length: 512,
            max_context_length: 2048,
            temperature: 0.9,
            top_p: 0.92,
            rep_pen: 1.1,
            n: 1,
        },
        nsfw: true,
        trusted_workers: false,
        slow_workers: true, // include slower free workers
    };
    if (model) {
        requestBody.models = [model];
    }

    let submitRes: Response;
    try {
        submitRes = await fetch('https://aihorde.net/api/v2/generate/text/async', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey,
                'Client-Agent': 'nexus-char-gen:1.0:github.com/nexus',
            },
            body: JSON.stringify(requestBody),
        });
    } catch (e) {
        onChunk('⚠️ AI Horde text: Network error submitting request. Is your internet connected?');
        return;
    }

    if (!submitRes.ok) {
        const errText = await submitRes.text();
        onChunk(`⚠️ AI Horde text: Submission failed (${submitRes.status}): ${errText}`);
        return;
    }

    const { id } = await submitRes.json();
    onChunk('⏳ Waiting for AI Horde worker...');

    // Poll until done
    const startTime = Date.now();
    const timeout = 120000; // 2 min
    while (Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 4000));
        let statusRes: Response;
        try {
            statusRes = await fetch(`https://aihorde.net/api/v2/generate/text/status/${id}`, {
                headers: { 'apikey': apiKey, 'Client-Agent': 'nexus-char-gen:1.0:github.com/nexus' }
            });
        } catch {
            continue;
        }
        if (!statusRes.ok) continue;

        const status = await statusRes.json();
        if (status.done && status.generations && status.generations.length > 0) {
            const text = status.generations[0].text || '';
            // Clear the waiting message by sending a special marker, then the real text
            onChunk('\x08'.repeat(40)); // backspaces to clear "waiting" message — UI may ignore
            onChunk(text);
            return;
        }
        if (status.faulted) {
            onChunk('\n⚠️ AI Horde: Generation faulted. Try again or use a different model.');
            return;
        }
        const waitTime = status.wait_time ? `~${status.wait_time}s` : '...';
        logger.log(`AI Horde text: waiting ${waitTime}, queue position: ${status.queue_position}`);
    }

    onChunk('\n⚠️ AI Horde text: Timed out after 2 minutes.');
};


// --- Orchestrator Functions ---

export const streamChatResponse = async (
    character: Character,
    allParticipants: Character[],
    history: Message[],
    onChunk: (chunk: string | any) => void,
    systemInstructionOverride?: string
): Promise<void> => {
    const config = character.apiConfig || { service: 'default' };
    
    // Rate Limiting
    const rateLimit = config.rateLimit;
    if (rateLimit && rateLimit > 0) {
        const characterId = character.id;
        const lastRequestTime = lastRequestTimestamps.get(characterId) || 0;
        const now = Date.now();
        const elapsed = now - lastRequestTime;

        if (elapsed < rateLimit) {
            const delay = rateLimit - elapsed;
            logger.log(`Rate limiting character "${character.name}". Delaying for ${delay}ms.`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        lastRequestTimestamps.set(characterId, Date.now());
    }

    let systemInstruction = buildSystemInstruction(character, allParticipants);

    if (systemInstructionOverride) {
        systemInstruction += `\n\n[ADDITIONAL INSTRUCTIONS FOR THIS RESPONSE ONLY]:\n${systemInstructionOverride}`;
        logger.log("Applying system instruction override for next response.");
    }

    // Unified dispatch. Everything OpenAI-compatible — built-in AND env-declared dynamic providers
    // All providers route through the SAME-ORIGIN proxy (/api/llm/<provider>) with keys injected server-side.
    // No SDK, no hardcodes, no keys in browser. Gemini is just another provider option.
    const svc = config.service || 'default';
    if (svc === 'aihorde' || svc === 'aihorde_text' || svc === 'default') {
        logger.log(`Using AI Horde text (keyless) for character: ${character.name}`);
        await streamAIHordeTextResponse(config, systemInstruction, history, onChunk);
    } else {
        logger.log(`Using proxied provider '${svc}' for character: ${character.name}`);
        const model = config.model || (svc === 'pollinations' ? 'openai' : svc === 'grok' ? 'grok' : 'default');
        await streamOpenAIChatResponse({ ...config, model }, systemInstruction, history, onChunk);
    }
};

export const generateImageFromPrompt = async (prompt: string, settings?: { [key: string]: any }): Promise<string> => {
    const safeSettings = settings || {};
    try {
        // Rate Limiting for image generation
        const rateLimit = safeSettings.rateLimit;
        if (rateLimit && rateLimit > 0) {
            const pluginId = 'default-image-generator';
            const lastRequestTime = lastRequestTimestamps.get(pluginId) || 0;
            const now = Date.now();
            const elapsed = now - lastRequestTime;

            if (elapsed < rateLimit) {
                const delay = rateLimit - elapsed;
                logger.log(`Rate limiting image generation. Delaying for ${delay}ms.`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            lastRequestTimestamps.set(pluginId, Date.now());
        }

        const service = safeSettings.service || 'default';
        
        switch (service) {
            case 'openai':
            case 'imagerouter':
                if (!safeSettings.apiEndpoint) {
                    throw new Error(`${service} requires a configured API endpoint.`);
                }
                return await generateOpenAIImage(prompt, safeSettings);
            
            case 'pollinations':
                return await generatePollinationsImage(prompt, safeSettings);
            
            case 'huggingface':
                return await generateHuggingFaceImage(prompt, safeSettings);

            case 'stability':
                return await generateStabilityImage(prompt, safeSettings);

            case 'aihorde':
                return await generateAIHordeImage(prompt, safeSettings);

            case 'custom':
                if (!safeSettings.apiEndpoint) {
                    throw new Error('Custom provider requires a configured API endpoint.');
                }
                return await generateOpenAIImage(prompt, safeSettings);

            case 'gemini':
                // Gemini now routes through proxy like other providers
                return await generateOpenAIImage(prompt, { ...safeSettings, apiEndpoint: `${window.location.origin}/api/llm/gemini/v1/images/generations` });

            case 'default':
            default:
                // Default: AI Horde (free, community GPU pool, no key required)
                return await generateAIHordeImage(prompt, { ...safeSettings, apiKey: safeSettings.apiKey || '0000000000' });
        }

    } catch (error) {
        logger.error("Error in generateImageFromPrompt:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        
        // If AI Horde fails and no specific service was requested, try falling back to Pollinations
        if (safeSettings.service === 'aihorde' && !safeSettings.fallbackAttempted) {
            logger.log("AI Horde failed, attempting fallback to Pollinations.ai");
            try {
                // Try Pollinations as fallback (no API key needed)
                const fallbackResult = await generatePollinationsImage(prompt, {
                    ...safeSettings,
                    fallbackAttempted: true
                });
                return fallbackResult;
            } catch (fallbackError) {
                logger.error("Fallback to Pollinations also failed:", fallbackError);
                throw new Error(`Image generation failed with both AI Horde and Pollinations. Details: ${errorMessage}`);
            }
        } else {
            throw new Error(`Image generation failed. Please check the plugin settings (API key, endpoint) and logs. Details: ${errorMessage}`);
        }
    }
};

export const generateContent = async (prompt: string, apiKeyOrConfig?: string | ApiConfig): Promise<string> => {
  // All requests route through web server proxy (/api/llm/<provider>/v1/chat/completions).
  // Server injects API keys — no keys in browser.
  const origin = (typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol))
    ? window.location.origin : '';

  let provider = 'pollinations';  // default
  let model = 'openai';
  let url = '';

  if (apiKeyOrConfig && typeof apiKeyOrConfig === 'object') {
    const cfg = apiKeyOrConfig;
    provider = cfg.service?.trim() || 'pollinations';
    model = cfg.model?.trim() || (provider === 'pollinations' ? 'openai' : 'default');

    // Route through proxy — all providers: gemini, anthropic, ollama, mistral, etc.
    if (origin) {
      url = `${origin}/api/llm/${provider}/v1/chat/completions`;
    } else {
      url = cfg.apiEndpoint?.trim() || 'http://localhost:3030/v1/chat/completions';
    }
  } else if (typeof apiKeyOrConfig === 'string') {
    // Legacy: bare string assumed to be Pollinations key → use Pollinations
    provider = 'pollinations';
    url = origin ? `${origin}/api/llm/pollinations/v1/chat/completions` : 'http://localhost:3030/v1/chat/completions';
  } else {
    // No config → use default
    url = origin ? `${origin}/api/llm/pollinations/v1/chat/completions` : 'http://localhost:3030/v1/chat/completions';
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || '').trim();
  } catch (error) {
    logger.error(`Error in generateContent (provider=${provider}, model=${model}):`, error);
    throw error;
  }
};

export const streamGenericResponse = async (
    systemInstruction: string,
    prompt: string,
    onChunk: (chunk: string) => void,
): Promise<void> => {
    const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    const url = `${origin}/api/llm/pollinations/v1/chat/completions`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt },
                ],
                stream: true,
                max_tokens: 512,
            }),
        });
        if (!res.ok || !res.body) throw new Error(`Proxy ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') return;
                try {
                    const obj = JSON.parse(data);
                    const chunk = obj.choices?.[0]?.delta?.content;
                    if (chunk) onChunk(chunk);
                } catch { /* skip malformed SSE lines */ }
            }
        }
    } catch (error) {
        logger.error("Error generating generic content stream:", error);
        onChunk("Sorry, an error occurred while responding.");
    }
};
