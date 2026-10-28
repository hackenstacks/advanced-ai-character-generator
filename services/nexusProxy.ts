/**
 * NeXuS proxy interceptor — routes provider API calls through the same-origin server proxy
 * so the browser never holds an sk_ key (Rule Zero).
 *
 * Inspired by the OpenCharacters `window.fetch = new Proxy(fetch, …)` trick, but instead of
 * injecting a key *client-side*, it rewrites the request to our server's universal proxy
 * (`/api/llm/<provider>/v1/chat/completions`) and STRIPS any client Authorization header —
 * the NeXuS Web Server injects the real key server-side from nexus.env / .local.env.
 *
 * Transparent to callers: same method, same body, same (streamed or full) response.
 * Only rewrites known cloud chat endpoints; same-origin `/api/*`, keyless AI Horde, local
 * Ollama/aichat, and image requests are left untouched (image already proxies separately).
 *
 * Installed once, first thing, from index.tsx.
 */

// upstream host  ->  our provider id (must match the server's PROVIDERS registry)
const HOST_TO_PROVIDER: Record<string, string> = {
  'gen.pollinations.ai': 'pollinations',
  'text.pollinations.ai': 'pollinations',
  'api.openai.com': 'openai',
  'api.groq.com': 'groq',
  'api.mistral.ai': 'mistral',
  'openrouter.ai': 'openrouter',
};

// Only rewrite chat-completions calls; leave embeddings/models/etc. alone.
const CHAT_PATH = /\/v1\/chat\/completions\/?$/;

function inBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.location && /^https?:$/.test(window.location.protocol);
}

/** Returns the same-origin proxy URL for a known upstream chat endpoint, or null to leave as-is. */
function rewriteTarget(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl, window.location.origin);
    if (u.origin === window.location.origin) return null;          // already same-origin
    const provider = HOST_TO_PROVIDER[u.hostname];
    if (!provider) return null;                                     // unknown host — don't touch
    if (!CHAT_PATH.test(u.pathname)) return null;                  // only chat completions
    return `${window.location.origin}/api/llm/${provider}/v1/chat/completions`;
  } catch {
    return null;
  }
}

/** Drop client-side auth (key lives server-side now). Returns a new headers object. */
function stripAuth(init?: RequestInit): RequestInit {
  const next: RequestInit = { ...(init || {}) };
  const h = new Headers(next.headers || {});
  h.delete('authorization');
  h.delete('Authorization');
  if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
  next.headers = h;
  return next;
}

let installed = false;

export function installNexusProxy(): void {
  if (installed || !inBrowser() || typeof window.fetch !== 'function') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      // Only URL/string inputs carry a host we can map; Request objects pass through untouched.
      const rawUrl =
        typeof input === 'string' ? input :
        input instanceof URL ? input.toString() : null;

      if (rawUrl) {
        const target = rewriteTarget(rawUrl);
        if (target) {
          // eslint-disable-next-line no-console
          console.debug(`[nexus-proxy] ${rawUrl} → ${target} (key server-side)`);
          return originalFetch(target, stripAuth(init));
        }
      }
    } catch {
      /* fall through to the untouched call */
    }
    return originalFetch(input as any, init);
  }) as typeof window.fetch;
}
