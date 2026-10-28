/**
 * providersService — single source of truth for "what providers/models exist", straight from the
 * NeXuS Web Server. Replaces the hardcoded API_PRESETS list so the UI always reflects the server's
 * real registry (built-in + env-declared dynamic providers) and which ones have a key.
 *
 * Keys never appear here — /api/providers exposes only `key_present` booleans; the server injects
 * the real key when a call is proxied.
 */

export interface ProviderInfo {
  id: string;
  label: string;
  kind: string;            // "chat" | "image" | "chat+image"
  requires_key: boolean;
  key_present: boolean;    // usable now? (keyless providers are always true)
  dynamic: boolean;        // declared in nexus.env / .local.env vs built-in
  proxied: boolean;
}

export interface ProvidersResponse {
  providers: Record<string, ProviderInfo>;
  defaults: { main: string; image: string; embedding: string };
}

const origin = (): string =>
  (typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol))
    ? window.location.origin : '';

let _providers: Promise<ProvidersResponse> | null = null;
const _models = new Map<string, Promise<string[]>>();

/** Fetch the provider registry once (cached). Returns an empty registry if the server is unreachable. */
export function getProviders(force = false): Promise<ProvidersResponse> {
  if (force) _providers = null;
  if (!_providers) {
    _providers = fetch(`${origin()}/api/providers`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .catch(() => ({ providers: {}, defaults: { main: 'aihorde', image: 'pollinations', embedding: 'local' } }));
  }
  return _providers;
}

/** Providers filtered by capability ("chat" or "image"), ready-first. */
export async function getProvidersByKind(kind: 'chat' | 'image'): Promise<ProviderInfo[]> {
  const { providers } = await getProviders();
  return Object.values(providers)
    .filter(p => p.kind.includes(kind))
    .sort((a, b) => Number(b.key_present) - Number(a.key_present) || a.label.localeCompare(b.label));
}

/** Live model ids for a provider (cached). '' or unknown → []. */
export function getModels(providerId: string): Promise<string[]> {
  if (!providerId) return Promise.resolve([]);
  if (!_models.has(providerId)) {
    const p = fetch(`${origin()}/api/models/provider/${encodeURIComponent(providerId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: any) => {
        const raw = Array.isArray(d) ? d : (d.models || d.data || []);
        return raw.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
      })
      .catch(() => [] as string[]);
    _models.set(providerId, p);
  }
  return _models.get(providerId)!;
}

/** A short readiness label for a dropdown option. */
export function readinessTag(p: ProviderInfo): string {
  if (!p.requires_key) return '✓ free';
  return p.key_present ? '✓ ready' : '🔒 no key';
}
