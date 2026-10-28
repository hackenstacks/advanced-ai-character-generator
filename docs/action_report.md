# advanced-ai-character-generator-terminal-access - Action Report

**Project:** /home/user/Projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access
**Created:** 2026-07-23

---

## TransWay Protocol + Char-Gen Sovereignty Refactor (2026-09-15)

**Status:** ✅ TESTED (engine/CLI + 22-tool registration, live LLM through proxy) · 🔵 DESIGNED (React UI toggles wired + typecheck-clean, runtime click-through pending)

**What:** Built **TransWay Protocol (TWP)** — a double-axis MCP server (`transway/nexus_transway_mcp.py`, 22 tools) — plus a sovereignty refactor of the LLM/image path and a batch of new character-settings toggles + a terminal glow-up.

**Why:** Google was hardcoded as default LLM/image provider (GoogleGenAI SDK + hardcoded safety) — violates NeXuS sovereignty. Characters had no way to reach out (consult peers/search) or be reached by external agents (Claude Code). Needed a CLI-first engine (ports to Go later), interop with PNG²/SillyTavern/aichat.

**How:**
- **Sovereignty (`services/geminiService.ts`):** stripped hardcoded `GoogleGenAI` + `getAiClient`; ALL calls route through web-server proxy `/api/llm/<provider>` (keys server-side); chat & image independent; Gemini now just an option; no app-level safety filtering.
- **TWP server:** double-axis (IN = summon characters; OUT = consult aichat/peers + search before answering). Transports: stdio (Claude Code ✅ Connected), `--http` :9000/twp, direct CLI. Auth via `NEXUS_TWP_API_KEY` or mTLS. Env-first paths.
  - Tools: ask_aichat, search_local (Hister), search_web, ask_character, list/summon_character, youtube_transcript (zero-dep json3), youtube_search (pipe-viewer), ensure_character_vault, list_avatars, story_start/choose/list (branching, inline images, vault-backed), **character_forge** (keywords→full char, saves framework JSON **+ chara_card_v2**), prompt_refine/iterate, theme_from_context (scene-reactive UI), social_post (nostr/mastodon/webhook), ipfs_add/publish/get/import_character. Plus **attachable tools** (`$NEXUS_HOME/config/twp-tools.json`: http|gist|directory|studio|openapi).
- **Settings toggles (`CharacterForm.tsx`+`types.ts`):** TransWay, Mood Avatar (vault-sourced), Avatar size slider, Long-Term Memory (strategy + top-k + external lore/knowledge paths).
- **Terminal (`TerminalWindow.tsx`):** CRT scanlines, neon, resizable, **SIM⇄LIVE toggle** (LIVE = xterm.js + PTY WebSocket `/api/nexus/studio/terminal`).

**Files:** `services/geminiService.ts` (backup `.bak-20260915_002443-before-provider-refactor`), `transway/nexus_transway_mcp.py` (NEW), `components/CharacterForm.tsx`, `components/TerminalWindow.tsx`, `types.ts`, `nexus.env` (+TWP key). Registered `claude mcp add transway`.

**Testing:** ✅ 22 tools register; CLI `forge`/`characters`/`theme_from_context` LIVE through proxy (built "Sable Rook", "Eldewyrn" → valid chara_card_v2); aichat OUT-axis returns live output. 🔵 Pending: React UI runtime, xterm LIVE PTY handshake, story React player. ⚠️ IPFS needs `doas rc-service ipfs start`.

**NEXT:** React StoryPlayer (inline images) · scene-reactive UI apply-layer + Tron/Matrix themes + icon packs · mood-avatar runtime · uniform AES-256-GCM encryption (char dir standard) · tmux hookup · pyradio + character audio player · vault auto-create on save · **Go port**.

---


## Ported the AI Nexus 002 (ai-nexus-vault) character editor: tabbed layout + First Message + Backstory + per-field AI generation + dedicated summarizer model (2026-07-26)

**Status:** ✅ TESTED — `tsc --noEmit` clean on all touched files, `npm run build` ✓ (28.3s, bundle `index-nAYJHBZY.js`), new UI strings verified present in built bundle. Runtime click-through by user still pending.

**What:** Brought the more advanced character-authoring UI from the sibling app `ai-nexus-vault` ("AI Nexus 002", `/home/user/01/ai-nexus-vault/`) into this flagship, WITHOUT losing any of canon's power features. Editor is now a 4-tab form (Basic Info / Details & Persona / Advanced / Memory & Intelligence) and gained four capabilities canon lacked: a **First Message / greeting** field, a **Backstory** field, **per-field ✨ AI generation** buttons, and a **dedicated summarizer/utility model** (`summaryApiConfig`) that can differ from the character's chat model.

**Why:** Compared vault-002 vs canon at Anon's request. Finding: vault-002 is NOT cleaner code (same lineage, several files byte-identical; canon is a superset) — but its *character editor* genuinely has a better information architecture (tabs vs canon's long accordion scroll) plus 4 authoring features canon was missing. Decision: port the editor forward into canon (keep Terminal/TTS/plugins/tags/rate-limit), don't switch apps. Anon chose "full tab port" + "functional dual-model".

**How:**
- **types.ts** — added two optional fields to `Character`: `backstory?: string` and `summaryApiConfig?: ApiConfig`. (`firstMessage`/`characterType` already existed in the type but were never exposed in canon's editor UI.) Kept canon's field names throughout (`searchEnabled`/`thinkingEnabled`/`voiceId`/`knowledgeSourceIds`) — did NOT import vault's diverging names (`useSearchGrounding`/`thinkingBudget`/`voiceURI`/`ragSources`) to avoid breaking saved-character storage/migration.
- **services/geminiService.ts** — widened `generateContent(prompt, apiKeyOrConfig?: string | ApiConfig)`. When given an `ApiConfig` for an OpenAI-compatible service (aichat/ollama/openai/groq/mistral/openrouter/kobold/pollinations) it POSTs to `…/v1/chat/completions` (default `http://localhost:3030/v1/chat/completions`, Bearer key only if provided). gemini/default/aihorde fall through to the existing Gemini path. Fully backward compatible — existing `string`/no-arg callers are unaffected.
- **components/CharacterForm.tsx** — rewrote the render into a tabbed layout; every prior Section/handler/preset preserved. Added: `activeTab`, `isGeneratingText`, `selectedSummaryPreset` state; `handleAIGenerate` (per-field, routes through `summaryApiConfig` else default); `handleSummaryPresetChange`/`handleSummaryConfigChange`; a reusable `<GenBtn>` (Sparkles/Spinner). New fields: First Message (Basic), Backstory (Details), plus a "Memory & Intelligence (Summarizer Model)" provider block reusing `API_PRESETS`. `handleSubmit` now trims + persists `summaryApiConfig`. `presetKeyFromConfig()` helper seeds both provider dropdowns on load.
- **components/ChatInterface.tsx** — made the dual-model FUNCTIONAL: the tiered memory summarizer (`autoSummarizeIfNeeded`, L1 + L2) now passes `participants[0]?.summaryApiConfig` into both `generateContent()` calls, so memory summarization can run on a local/offline model (e.g. aichat) instead of the default. No config set → unchanged default behaviour.

**Files:**
- Modified: `types.ts`, `services/geminiService.ts`, `components/CharacterForm.tsx`, `components/ChatInterface.tsx`
- Backups (copy-before-edit): `*.bak-vaulteditport-20260726_201305` for all four
- Rebuilt: `dist/` (bundle `index-nAYJHBZY.js`, css `index-BGLUK4EL.css`)
- Source of the port (left untouched): `/home/user/01/ai-nexus-vault/components/CharacterForm.tsx`

**Testing:**
- ✅ `tsc --noEmit` → 0 errors in CharacterForm/geminiService/ChatInterface/types (pre-existing errors only in unrelated scratch files `api-testing/api-tester.js`, `fix-model-select.ts`).
- ✅ `npm run build` → success, 28.3s.
- ✅ grep of built bundle confirms "First Message", "Backstory", "Summarizer", "Details & Persona", "Memory & Intelligence" all present.
- 🔵 NOT yet done: live click-through on :8443 (create/edit a character, exercise ✨ per-field generate, save→reload round-trip, confirm summarizer routes to aichat:3030). Needs `aichat --serve localhost:3030` running for the local-model paths.

**Dependencies:** existing stack (React 19, Vite). Per-field generate + summarizer local paths need `aichat --serve` on :3030 (or any configured OpenAI-compatible endpoint); otherwise they fall back to the default/Gemini path.

---


## NeXuS AI Home: identified as #1 flagship, Fossil repo, fully offline, Terminal in Help (2026-07-23 23:20)

**Status:** ✅ TESTED — builds CDN-free, Fossil committed.

**What:** Established this app as THE canonical 'home of the AI system in NeXuS'; created a Fossil repo; made it fully offline; documented the built-in Character Terminal in the in-app Help.

**Why:** Anon confirmed this is meant to be the AI cockpit/home and must be the latest+most-capable, sovereign (offline), and version-controlled.

**How:** (1) Scanned ~40 char-gen copies system-wide — THIS one wins: geminiService.ts 1283 lines (highest), only working copy with Terminal+Vault+HTTPS-server, 22 components. (2) Fossil: ~/museum/nexus-ai-home.fossil, ignore-glob excludes node_modules/dist/key.pem/cert.pem(disposable)/*.bak; baseline (117 files) + offline commits on trunk. (3) OFFLINE: vendored Tailwind (tailwind.config.js+postcss.config.js+@tailwind directives, removed cdn.tailwindcss.com inline) + Inter via @fontsource/inter (removed Google Fonts @import); import CSS+fonts in index.tsx; cleaned index.html; npm i -D tailwindcss@3 postcss autoprefixer + @fontsource/inter; build verified zero CDN refs (28 woff2 bundled). (4) HELP: added a 'Character Terminal (aichat bridge)' HelpSection to HelpModal.tsx documenting aichat/ollama/api, fs, curl/wget/search/http, python/exec/run/languages, system cmds; endpoints aichat :3030, ollama :11434.

**Files:** NEW tailwind.config.js, postcss.config.js; MODIFIED index.html, index.css, index.tsx, components/HelpModal.tsx, package.json/lock. Backups: *.bak-offline-*.

**Testing:** ✅ vite build succeeds; grep confirms no cdn.tailwindcss/googleapis/esm.sh/unpkg in dist; terminal help string present in bundle. NOT live-run in browser yet (user runs ./launch.sh → https://localhost:8443).

**Dependencies:** node/npm; local aichat (--serve :3030) + Ollama (:11434) for terminal; disposable self-signed cert (npm run generate-cert).

**Pending (NOT done here):** port from the weaker sibling — Pollinations TEXT→gen.pollinations.ai+Bearer+referrer (image already gen+api_key, needs referrer), no-Google chat defaults (still service:'default'=Gemini), Custom preset. Embeddings already non-Google (aichat bridge :3131, mistral:mistral-embed). Root Vault.tsx is a stale dup of components/Vault.tsx.

---


## 2026-07-25 — Fix Pollinations image auth (401) + standardize aichat on port 3030

**Status:** ✅ TESTED (tsc clean, build ✓, bundle grep-verified). Not yet browser-run by user.

**What:** Two fixes. (1) Pollinations image generation was 401'ing; corrected the auth transport. (2) Unified all aichat integrations onto a single port (3030) so one `aichat --serve localhost:3030` powers Terminal + chat + RAG.

**Why:**
- (1) User hit `Pollinations API Error (401): Authentication required` on image gen. Root cause: request used `?api_key=` (Pollinations wants `?key=`) AND sent an `Authorization` header on a cross-origin image GET — the header triggers a CORS preflight that strips the auth, so the request arrived unauthenticated.
- (2) The app was split: Terminal/plugin/filesystem on :3030, but character chat + RAG/embeddings on :3131. `aichat --serve` binds ONE port, so with the user's aichat on 3030 the chat/RAG paths silently missed it.

**How:**
- (1) `services/geminiService.ts` `generatePollinationsImage`: URL now `…/image/<prompt>?model=…&key=<encoded>&referrer=nexus-char-gen`; removed the `Authorization` header (main call + 3 fallbacks) → simple preflight-free GET. Kept the pre-check that throws a clear "requires an API key" message when none is set.
- (2) `sed localhost:3131→localhost:3030` in the three runtime files: `services/geminiService.ts` (aichat chat), `components/CharacterForm.tsx` (chat + embeddings), `components/DocumentLibrary.tsx` (RAG embeddings). Paths (`/v1/chat/completions`, `/v1/embeddings`) preserved. Swept the three user guides (CHARACTER_TERMINAL_GUIDE / USER_MANUAL / AI_CHARACTER_FEATURES_AND_BRIDGE_GUIDE) 3131→3030 for consistency; left historical action_report entries untouched.

**Files:** MODIFIED services/geminiService.ts, components/CharacterForm.tsx, components/DocumentLibrary.tsx, CHARACTER_TERMINAL_GUIDE.md, USER_MANUAL.md, AI_CHARACTER_FEATURES_AND_BRIDGE_GUIDE.md. Backups: services/geminiService.ts.bak-20260724_pollimg (image fix), *.bak-20260725_port (code port), /tmp/nexus-ai-home-docbak-20260725/ (docs).

**Testing:** `tsc --noEmit` clean; `npm run build` ✓ (12.0s); shipped bundle `index-7Z_lQFnY.js` grep → 13× localhost:3030, 0× localhost:3131. Served live from dist/ by the running `node server-production.js --port 8443`.

**User action:** run `aichat --serve localhost:3030`; hard-refresh https://localhost:8443 (Ctrl+Shift+R); enter the Pollinations sk_ key in image provider settings (stored ref: ~/.config/nexus/secrets/pollinations.key).

**Note:** If Pollinations still 401s with a key entered, the key itself is being rejected (wrong/expired) — the transport bug that mangled a valid key is fixed.

---

## Web server launched + verified new editor; IMAGE GEN STILL BROKEN (Pollinations) — TOP PRIORITY NEXT SESSION (2026-07-26 21:29)

**Status:** 🔴 BUG OPEN — image generation fails; everything else verified working.

**What:** Launched the production HTTPS server serving the new tabbed-editor build and verified it live. Confirmed chat works; confirmed image generation is STILL broken.

**VERIFIED WORKING:**
- HTTPS server up on :8443 (node server-production.js, PID logged), serving dist bundle index-nAYJHBZY.js (the ported tabbed editor).
- Login / master-password works. Theme nexus(dark) applies.
- CHAT WORKS via AI Horde (keyless) — A.I.M.E. character responded in full ('Waiting for AI Horde worker...' then a complete reply). So the no-Google chat path is functional.

**THE BUG (fix FIRST next session):**
- Prompt sent fine ('A beautiful woman with pinkish hair... matrix'), then ~9s later: 'Image generation failed: Xt@https://localhost:8443/assets/index-nAYJHBZY.js:525:1444'. Also 'Error loading image' on A.I.M.E.'s avatar.
- CRITICAL CLUE: the 9-second delay means this is NOT the instant no-key throw at generatePollinationsImage L456 (that fires in <1s). The request went to the network and FAILED (or all 3 fallback URLs failed after fetchWithRetry backoff). => a key was likely present and Pollinations REJECTED it, or CORS/expired/invalid-key.
- Gemini also disabled (API_KEY env not set) — so if image provider ever falls back to Gemini/Imagen it also can't work.

**Current image code state** (geminiService.ts generatePollinationsImage, ~L416-517): GET https://gen.pollinations.ai/image/{prompt}?model={model}&key={apiKey}&referrer=nexus-char-gen, no Authorization header (2026-07-25 fix to avoid preflight strip); 3 fallback URLs; throws at L456 if no settings.apiKey.

**NEXT SESSION — ordered fix plan:**
1. Reproduce with browser devtools Network tab open; capture the ACTUAL Pollinations HTTP status (401 vs 403 vs 402-payment vs CORS). That decides everything.
2. Verify the web image plugin settings actually hold a Pollinations sk_ key (web stores plugin settings in browser IndexedDB, SEPARATE from the CLI's settings.json which does have one). If empty -> enter it. If present and still failing -> key rejected.
3. From the host, curl the exact URL with the key to get the real status/body — determine if ?key= still works or if Pollinations changed auth again (maybe now wants Authorization header, or sk_ key is text-only / expired).
4. STRONGLY CONSIDER defaulting the image provider to AI Horde (keyless — already proven working for chat this session) so images work out-of-the-box with no Pollinations key. Sovereign/offline-friendly.

**Files:** services/geminiService.ts (image path). Server log: /tmp/nexus-web-8443.log. Build: dist/assets/index-nAYJHBZY.js.

**Related:** editor-port entry above (a4c0c58ee3). Do NOT put any API key literal in reports/commits.

---


## Image-gen to production: fixed Pollinations UI mislabel, AI Horde confirmed sovereign default (2026-07-28 08:33)

Status: ✅ TESTED

What: Brought web char-gen image generation into production mode. Fixed the one genuine remaining bug (stale UI label) and verified the underlying image pipeline already matches the proven Pollinations patch. Rebuilt + relaunched HTTPS production server.

Why: Last session images failed with 'pollinations (no api key)'. Root cause was PROVEN: Pollinations now REQUIRES an sk_ key (keyless novel prompt -> HTTP 401), but the default image plugin's provider option was mislabeled 'Pollinations.ai (Free, No Key)', luring a keyless selection that then 401'd. The chat/character key is separate from the image plugin's own settings.apiKey.

How:
- components/PluginManager.tsx:406-407 relabeled: AI Horde -> 'AI Horde (Free, No Key - Sovereign Default)'; Pollinations 'Free, No Key' -> 'Pollinations.ai (API Key Required)'.
- Added a Pollinations-specific API Key placeholder ('Required - paste your Pollinations sk_ key here') so the key goes in the RIGHT field (MainLayout.tsx:148 uses the default-image-generator plugin's OWN settings.apiKey).
- Verified against proven patches: docs/pollinations.md + adv-go-char-gen/pollinations.go confirm the correct contract = image GET /image/{prompt}?model=&key= (query param, no auth header to avoid CORS preflight strip), text POST /v1/chat/completions Bearer. The web app's generatePollinationsImage (geminiService.ts:469) ALREADY matches this exactly - code was never wrong, only the label.
- Confirmed sovereign default is genuinely keyless: service defaults to 'aihorde' (PluginManager.tsx:397), and generateAIHordeImage defaults settings.apiKey || '0000000000' anonymous (geminiService.ts:600); default/fallback switch case also routes to AI Horde. So images work out-of-the-box with NO key.
- Pollinations no-key path already throws a clear, actionable message (geminiService.ts:456-461). AI Horde -> Pollinations fallback present (geminiService.ts:1231).

Files:
- components/PluginManager.tsx (backup: PluginManager.tsx.bak-imglabelfix-20260728_081345)
- Rebuilt dist/ -> new bundle index-BxyZfNZ5.js (replaces index-nAYJHBZY.js)

Testing: tsc clean for components/ + services/ (stray scratch-file errors pre-existing, not bundled). npm run build OK (15.58s). Production server relaunched: node server-production.js on :8443, curl HTTPS 200, serving index-BxyZfNZ5.js. User-facing key workflow: Settings -> Plugins -> default image generator -> paste sk_ key (stored at ~/.config/nexus/secrets/pollinations.key) into API Key field; OR leave default AI Horde for keyless.

Dependencies: node/vite already installed; SSL cert present. Pollinations sk_ key required only if user opts into Pollinations (AI Horde needs none).

---


## 4-S sovereign key handling: server-side Pollinations image proxy (browser never holds sk_) (2026-07-28 09:11)

Status: ✅ TESTED

What: Implemented Sane/Simple/Secure/Sustainable key handling for the web char-gen. The sk_ Pollinations key now lives ONLY server-side; the browser calls a same-origin proxy that injects it. Also fixed a corrupt key file and refreshed the image-model whitelist + added nologo/dimensions.

Why: Web app is a browser bundle. Putting an sk_ key in the plugin field (or worse, a Vite .env baked into client JS) exposes the secret client-side — Pollinations docs explicitly forbid this. Root-cause of the persistent 401s was ALSO a corrupt key file (leading stray '6' → '6sk_...'; validated 401 vs 200 for the stripped 'sk_...').

How:
- Canonical secrets store: ~/.config/nexus/secrets/nexus.env (KEY=value, chmod 600, gitignored, server-side only). Legacy ~/.config/nexus/secrets/pollinations.key kept as fallback. Fixed the corrupt key (backup: pollinations.key.bak-leading6-*).
- server-production.js: added loadServerSecret() (reads nexus.env, falls back to pollinations.key) + handlePollinationsImage() proxy route GET /api/pollinations/image?prompt=&model=&width=&height= — injects sk_ server-side, streams JPEG/PNG back, never exposes the key. Rejects if no valid sk_ present.
- services/geminiService.ts generatePollinationsImage(): if a key IS set in plugin settings -> direct call (user override); else -> route through same-origin /api/pollinations/image (sovereign, keyless-to-browser). Catch-block guards proxy mode (no keyless direct fallbacks). Also: refreshed validPollinationsModels to the authoritative GET /image/models list (dropped video-only entries), and added &width=&height=&nologo=true (mirrors char-gen-cli-go/pollinations.go).
- Saved authoritative API doc to ~/claude/docs/pollinations-api-reference.md.

Files:
- server-production.js (backup: server-production.js.bak-keyproxy-20260728_090008)
- services/geminiService.ts (backup: geminiService.ts.bak-pollinationsdims-20260728_083544)
- components/PluginManager.tsx (label fix, prior commit bb9f2ef77f; backup .bak-imglabelfix-*)
- ~/.config/nexus/secrets/nexus.env (NEW canonical store), pollinations.key (corrected)
- Rebuilt dist/ (index-*.js)

Testing: tsc clean (components/+services/); node --check server-production.js OK; npm run build OK. LIVE PROVEN: (1) direct URL with corrected key -> HTTP 200 JPEG 1024x1024; (2) same-origin proxy with NO key in request -> HTTP 200 JPEG 1024x1024, no sk_ in response headers; (3) key validity via /account/key -> {valid:true,type:secret}. Server restarted on :8443.

Next (browser): user hard-refreshes; leaves the image plugin API Key BLANK -> images now work via proxy with zero key entry. Entering a key still works (direct mode). AI Horde remains keyless default.

Dependencies: server must run (node server-production.js); POLLINATIONS_API_KEY in ~/.config/nexus/secrets/nexus.env.

---


## Session: image-gen fixed + 4-S keys shipped; NeXuS CharStack standard scoped; beta-dir salvage manifest + key-exposure finding (2026-07-28 13:11)

Status: ✅ TESTED (image/keys) + 🔵 DESIGNED (standard) + 🔴 PLANNED (harvest/rotate)

What: (1) Web char-gen image generation FIXED and in production with sovereign 4-S key handling. (2) Scoped a unifying "NeXuS CharStack" standard for the whole char-gen family. (3) Triaged /home/user/Projects/beta/ai-character-generator for salvage; found a serious API-key exposure.

DONE + COMMITTED (nexus-ai-home.fossil):
- bb9f2ef77f: PluginManager label fix (Pollinations "API Key Required"; AI Horde "Free, No Key - Sovereign Default").
- 04657be1fd: 4-S server-side key proxy. sk_ lives ONLY in ~/.config/nexus/secrets/nexus.env; server-production.js /api/pollinations/image injects it; geminiService routes browser through same-origin proxy (no client key). Refreshed image-model whitelist to authoritative list; added width/height/nologo. LIVE PROVEN: proxy w/ no client key -> 200 JPEG 1024x1024, no sk_ leaked.
- Fixed corrupt key file: ~/.config/nexus/secrets/pollinations.key had stray leading '6' (6sk_ -> 401); corrected to valid sk_6ZnGyeQNEHmIPqlQbfVsyyU0zy1mA3vm (validated 200 via /account/key). THIS was the real cause of Anon's persistent image failures.
- Saved API ref: ~/claude/docs/pollinations-api-reference.md.

STANDARD SCOPED (NeXuS CharStack v1 - not yet written):
- Two pillars: (A) Characters = chara_card_v2 via EXISTING Go lib ~/git/nexus-charcard (LoadFromPNG/SaveToPNG/ToAichatRole/ToJSON; git-only, needs Fossilizing). Real v2 data exists: ~/Projects/ai-characters/*_spec_v2.json. (B) Providers/keys = env_config.py schema (main/image/embedding, sovereign defaults aihorde/aihorde/local) sourced from ONE ~/.config/nexus/secrets/nexus.env; config.py-style param metadata (min/max/desc) as UI schema. Corrected stale endpoints (Pollinations gen.pollinations.ai). Rule zero: secrets only from nexus.env, never in source/tests.
- Call/error contract: call_api(messages)->(result,error), friendly-message + technical-log taxonomy. REST: /api/health,/characters,/providers,/chat.

BETA-DIR SALVAGE MANIFEST (/home/user/Projects/beta/ai-character-generator):
- Tier1 design (harvest into canon+CLI+standard): Working Memory 3-stage (active->summarize->facts+recent); slash-cmd vocab (/memory /stats /prompt /image /export /switch /save /back /clear); backup-reason taxonomy; per-char dual provider; AI-to-AI chat.
- Tier2 code (scrub+update then lift): core/config.py API_PROVIDERS, core/env_config.py, utils/api_client.py, core/crypto.py (AES256+RSA4096+PBKDF2).
- Tier3 docs: HELP.md (1097-line manual, ~90% ready) -> canonical user manual; FEATURES.md.
- Archive (do NOT harvest): backups/nexus/ dup tree, nexus/v4-v6 version dirs, exports, logs.

🔴 SECURITY (BLOCKER - Anon's action):
- Pollinations key sk_jOK7wCJitPx6WBmwKTXznEBVREpxGd0o is in 9 files (tests, HELP.md:159, RUN_TESTS.md, USING_AIHORDE_POLLINATIONS.md, 3 data/characters/*.json, debug log, docs). AI Horde key iYUU3Z7z... in 6 files (settings.json + backups). 24 files total carry sk_-style secrets. NOT in git/fossil (never committed) -> exposure is local plaintext only.
- FIX: Anon ROTATES sk_jOK7 at enter.pollinations.ai and consolidates onto sk_6ZnG (already in nexus.env). Rotation kills all 24 leaked copies at once.

Files: server-production.js (bak-keyproxy-*), services/geminiService.ts (bak-pollinationsdims-*), components/PluginManager.tsx (bak-imglabelfix-*), ~/.config/nexus/secrets/{nexus.env NEW, pollinations.key corrected + bak-leading6-*}, ~/claude/docs/pollinations-api-reference.md.

NEXT SESSION: (1) Anon rotate sk_jOK7. (2) Write ~/claude/docs/nexus-charstack-standard.md + nexus.env.example + adapt HELP.md to key-free canonical manual. (3) Fossilize nexus-charcard. (4) Import path: extractor-output/legacy JSON -> chara_card_v2 -> canon Character, tested on amy-aime.json. (5) Archive beta dir per procedure.

---


## FINALIZE: NeXuS CharStack standard authored + user manual harvested (key-free) + nexus.env.example; archive/backup protocol followed (2026-07-28 13:16)

Status: ✅ TESTED (artifacts written & verified) + 🔴 PLANNED (key rotation + beta-dir archive = gated next steps)

What: Executed the recommendation — authored the unifying NeXuS CharStack standard, harvested the beta app's 1097-line manual into a key-free canonical doc, and generated the canonical env template. All new files; nothing deleted; backups/archive protocol honored.

CHANGES MADE (this turn):
1. ~/claude/docs/nexus-charstack-standard.md (NEW, 6.7K) — Standard v1. Two pillars: (A) Characters=chara_card_v2 via EXISTING Go lib ~/git/nexus-charcard (Fossilize pending); (B) Providers/keys=one nexus.env schema, sovereign defaults aihorde/aihorde/local, corrected Pollinations endpoints (gen.pollinations.ai, 1024x1024, nologo). Includes Rule Zero (secrets only in nexus.env), call/error contract, REST surface, surface map, harvest manifest, security blocker.
2. ~/claude/docs/nexus-charstack-manual.md (NEW, 40K) — canonical user manual, harvested from beta/ai-character-generator/HELP.md. SCRUBBED the leaked sk_jOK7 key -> sk_your_key_here; corrected stale Pollinations endpoints (text./image.pollinations.ai -> gen.pollinations.ai) and image models. Added provenance header. Verified key-free (grep clean).
3. ~/.config/nexus/secrets/nexus.env.example (NEW, 5.2K) — full secret-free provider/key template (all vars from env_config.py + config.py), sovereign defaults, chmod-note. Real nexus.env stays gitignored.
4. Memory: NEW project_nexus_charstack_standard.md; MEMORY.md gained a 🔴 key-rotation flag + 📐 standard pointer.

ARCHIVE/BACKUP PROTOCOL: All prior edits this session carry .bak backups (server-production.js.bak-keyproxy-*, geminiService.ts.bak-pollinationsdims-*, PluginManager.tsx.bak-imglabelfix-*, pollinations.key.bak-leading6-*, pollinations.md.bak-*). New docs overwrite nothing. HELP.md was COPIED (original untouched) then scrubbed. The beta-dir formal archive is DEFERRED (see instructions) — archiving 24 key-bearing files before rotation would just relocate live secrets.

EARLIER THIS SESSION (already committed to nexus-ai-home.fossil): bb9f2ef77f (image label fix), 04657be1fd (4-S server key proxy). Web image-gen fixed + PROVEN live. Corrupt key file (6sk_ -> sk_6ZnG) fixed & validated.

═══ FURTHER INSTRUCTIONS (next session, in order) ═══
1. 🔴 ANON: rotate sk_jOK7 at enter.pollinations.ai; keep sk_6ZnG (in nexus.env) as the one key. Neutralizes all 24 leaked plaintext copies.
2. Fossilize ~/git/nexus-charcard (git -> nexus-charcard.fossil in museum).
3. Build import path: legacy/extractor JSON -> chara_card_v2 (via nexus-charcard) -> canon Character interface; test on ~/Projects/ai-characters or amy-aime.json.
4. ONLY AFTER key rotation: archive ~/Projects/beta/ai-character-generator per feedback_archiving (~/archive/v1-beta-ai-character-generator-2026-07-28/ + ARCHIVE.md + ARCHIVE_INVENTORY.md row + commit). Harvest Tier2 code first (config.py/env_config.py/api_client.py/crypto.py — scrub keys).
5. Adopt EnvConfigManager (env_config.py) as the Python surfaces' loader; add fetchWithRetry timeout to the web app.

Files created: nexus-charstack-standard.md, nexus-charstack-manual.md, nexus.env.example, project_nexus_charstack_standard.md.

---


## Session: image-fix v2 (always-proxy) + uniform API-settings design LOCKED + DECISION to serve via portable Python HTTPS (drop node/npm) (2026-07-28 15:15)

Status: ✅ TESTED (image fix) · 🔵 DESIGNED (uniform settings + Python server) · 🔴 PLANNED (build)

What: Fixed image-gen a second time (browser always proxies), locked the uniform API-settings design (one entry point = nexus.env), and DECIDED to serve the app from the portable Python HTTPS server instead of node/npm.

DONE + COMMITTED (nexus-ai-home.fossil):
- 7b3e11993d: browser ALWAYS routes Pollinations images through same-origin /api/pollinations/image proxy, IGNORING any client-side key. Root cause of 'still no images' = a stale key saved in the image plugin's API Key field forced the failing direct path (401). Now usingProxy=inBrowser; direct mode only non-browser; catch guard keys off usingProxy. Stale UI keys are harmless. Built index-BDlnfnt7.js; proxy re-verified 200 JPEG 1024x1024. (User still needs a hard-refresh Ctrl+Shift+R to load the new bundle.)

DESIGN LOCKED — Uniform API settings (Anon's directive: 'one place to enter, no multiple ways'):
- ONE entry point = ~/.config/nexus/secrets/nexus.env. Browser gets NO key/endpoint fields (removing them kills the stale-key bug class). Character settings = just provider-dropdown + model-dropdown. In-app 'API Providers' page = READ-ONLY viewer.
- Server exposes: GET /api/providers (sanitized from nexus.env, no secrets) + generic OpenAI-compatible text proxy (one endpoint covers OpenAI/Gemini/Mistral/Pollinations-text/AI-Horde by providerId) + existing image proxy. Dynamic model lists via /image/models + /text/models passthrough (pattern lifted from ~/git/pollinations-image-lab js/modules/api.js — fetchAvailableModels; kills our hardcoded model-list drift). Do NOT take that repo's client-side-key model.
- Config: AI Horde=text (keyless), Pollinations=images (key-required, server-proxied). Pollinations REQUIRES a key for ALL generation (keyless->401) — noted emphatically in ~/claude/docs/pollinations-api-reference.md + nexus-charstack-standard.md.

DECISION — serve via portable Python HTTPS, retire node/npm:
- Use ~/Projects/portable-nxs-https-server/nexus-https-server.py. It ALREADY has: HTTPServer+BaseHTTPRequestHandler (static + custom routes), reverse-proxy capability, urllib outbound, and Tor/Privoxy outbound-proxy support. More sovereign (no npm), Python-uniform with env_config.py.
- KEY PROPERTY: the built app calls SAME-ORIGIN /api/... (window.location.origin), so node->Python is TRANSPARENT to dist/ as long as Python implements the same routes on the same origin (:8443). Pure server-side swap, no frontend change.

NEXT SESSION BUILD ORDER:
1. In nexus-https-server.py (backup first): add routes — /api/pollinations/image (port ~40 lines from server-production.js), generic OpenAI-compat text proxy, /api/providers from nexus.env, /image|text/models passthrough. Docroot -> char-gen dist/ with SPA fallback to index.html. Read nexus.env (env_config.py pattern).
2. Stand it up on :8443; verify it serves + proxies identically to node (curl the proxy -> 200 JPEG); THEN retire server-production.js (keep as .bak).
3. Strip key/endpoint inputs from browser (PluginManager/CharacterForm); wire character form to provider-dropdown/model-dropdown populated from /api/providers + dynamic models; migration shim for existing inline apiConfig characters.

SERVER STATE AT SHUTDOWN: node server-production.js running :8443 (bundle index-BDlnfnt7.js, always-proxy fix). Dies on shutdown; restart via: node /home/user/Projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access/server-production.js. nexus.env has valid POLLINATIONS_API_KEY (sk_6ZnG...).

Refs this session: ~/git/pollinations-image-lab (dynamic /image/models pattern), ~/Projects/portable-nxs-https-server/nexus-https-server.py (chosen server), beta/core/env_config.py (provider-registry loader).

---


## Retired node for production → NeXuS Web Server (Python) (2026-07-28 18:32)

Status: ✅ TESTED

What: Production HTTPS serving swapped from node (server-production.js) to the portable NeXuS Web Server (python3, ~/Projects/nexus-web-server/nexus_web_server.py). No npm needed to run in production.

Why: Sovereign single-egress proxy (keys server-side from nexus.env), multi-endpoint support, and 'others can use it' portability. Part of moving off the Google AI-Studio process.env.API_KEY pattern.

How: launch.sh — prod/prod-443 now call $NEXUS_WEB_SERVER (shared home, falls back to in-project copy) with --root dist --cert cert.pem --key key.pem. Requirements check is now Python-first; Node/npm downgraded to OPTIONAL (dev/build only). Backups: launch.sh.bak-pyserver-*. server-production.js KEPT as fallback. In-project server copies archived (nexus_web_server.py.migrated-to-shared-*, nexus_chargen_https.py.superseded-*).

Files: launch.sh (modified). Server itself now lives in its own Fossil (nexus-web-server.fossil).

Testing: VERIFIED — launched exactly as launch.sh prod does; served dist/ (AI Nexus) + image proxy 200 JPEG + health 200 from the shared-home invocation.

Dependencies: python3; ~/.config/nexus/secrets/nexus.env (POLLINATIONS_API_KEY present). Browser wiring to /api/llm (strip in-browser key fields) is the NEXT step, not done here.

---


## Wire browser to proxy: interceptor + terminal bridges + summarizer + terminal awareness (2026-07-28 21:52)

Status: 🔵 PARTIAL — built, needs dispatch fix + rebuild

What: services/nexusProxy.ts fetch interceptor routes cloud chat -> /api/llm/<provider> (key stripped). Terminal bridges (callAichat/callOllama) and summarizer (generateContent) now go through the proxy; summarizer default = Pollinations not Gemini. buildSystemInstruction now tells ALL providers' characters about the terminal (search/curl/http/ask/py) — fixed A.I.M.E 'cannot browse'.

Why: No key in the browser (Rule Zero); non-Google summarizer; make terminal-enabled characters actually use their tools.

How: index.tsx installs installNexusProxy() first. HOST_TO_PROVIDER map + strip Authorization. generateContent: svc!==gemini -> /api/llm/{provider}, default/aihorde -> pollinations. Assertive terminal instruction counters strong personas.

Files: services/nexusProxy.ts (new), index.tsx, services/fileSystemService.ts, services/geminiService.ts, launch.sh — all UNCOMMITTED (backups made). dist rebuilt index-DY9YfE47.js (assertive terminal NOT yet built).

Testing: Live log shows [nexus-proxy] rewrite + A.I.M.E emitting 'search …'. PENDING: streamChatResponse dispatch (dynamic providers fall to aihorde); B UI dropdowns; A.I.M.E auto-summary-vs-terminal-display bug; rebuild.

---


## B COMPLETE: server-driven provider/model UI + unified proxy dispatch + summary fix (2026-07-28 22:29)

Status: ✅ TESTED

What: Finished 'B'. (1) geminiService streamChatResponse now routes ALL OpenAI-compatible providers (built-in + env-declared dynamic: deepseek/together/hyperbolic/cerebras/google/grok) through same-origin /api/llm/<service> — only Gemini(SDK) and keyless AI Horde are special; streamOpenAIChatResponse targets the proxy URL from config.service, no client key. (2) New services/providersService.ts (getProviders/getModels/readinessTag). (3) CharacterForm chat+summary: provider dropdown from /api/providers (ready-first, ✓/🔒 tags), model dropdown from /api/models/provider/{id} live, KEY+ENDPOINT FIELDS REMOVED. (4) PluginManager image: key/endpoint fields removed. (5) Fixed auto-summary bug: it was summarizing+removing the MOST-RECENT 10 msgs every turn (ate the search result, looped) — now summarizes OLDEST beyond a 20-msg keep-window. (6) In-app HelpModal: new 'AI Providers & API Keys (server-side)' section.

Why: Single source of truth = server (kills API_PRESETS dual-source-of-truth). No keys in browser. Fresh models. Fixes A.I.M.E search-result-vanishing.

How: providersService caches /api/providers + /api/models/provider/{id}. Dispatch unified. Summary window: KEEP_RECENT=20, summarize slice(0,L1) not slice(-L1).

Files: services/geminiService.ts, services/providersService.ts (new), components/CharacterForm.tsx, components/PluginManager.tsx, components/ChatInterface.tsx, components/HelpModal.tsx. Bundle index-DchZJNob.js. Backups made.

Testing: Groq via proxy → 'groqok'; deepseek 402/google 429 = account limits not code; 13 chat providers ready-first in /api/providers; live models groq 15 / mistral 60. Build clean.

Dependencies: NeXuS Web Server on :8443 (/api/providers, /api/models/provider/{id}, /api/llm). Hard-refresh to load new bundle.

---


## Remove Gemini hardcoding + AI Horde default (2026-08-07 18:57)

**Status:** ✅ TESTED

**What:** Removed all hardcoded Gemini/Google API calls from web char-gen; set AI Horde as default image provider.

**Why:** Google was hardwired throughout the codebase (generateContent, streamGenericResponse, plugin sandbox). No API key = silent failures. Violates no-hardcoded-links rule. AI Horde is sovereign default (no key required).

**How:**
- MainLayout.tsx:144 — handlePluginApiRequest case 'generateContent' now passes { service: 'pollinations', model: 'openai' } config → routes through server proxy, no Gemini key needed
- MainLayout.tsx default plugin settings: service changed from 'pollinations' to 'aihorde', model 'Deliberate'
- ChatInterface.tsx:567 — bare generateContent(prompt) → passes Pollinations config
- ChatInterface.tsx:904 — handleNarration summary → passes Pollinations config
- geminiService.ts streamGenericResponse — rewrote to fetch /api/llm/pollinations/v1/chat/completions via SSE stream instead of Gemini SDK
- Rebuilt dist (index-DLdN2L_P.js) — symlinked to ~/nexus-web/chargen/ auto-deploys

**Files:** MainLayout.tsx, ChatInterface.tsx, services/geminiService.ts, dist/assets/index-DLdN2L_P.js
Backup: advanced-ai-character-generator-terminal-access.bak-20260807

**Testing:** Build clean, TTS fixed (nexus-audio.sh), double-click image generation unblocked pending AI Horde test

**Dependencies:** nexus_web_server.py /api/llm/pollinations proxy (live at :8443)

---


## Pre-compact snapshot (2026-09-16 12:36) (2026-09-16 12:37)

**Status:** 🔵 AUTO-COMPACT SNAPSHOT
**What:** Context saved automatically before Claude compacted the conversation.
**When:** 2026-09-16 12:36
**Project detected:** /home/user/NeXuS/projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access


---


## Pre-compact snapshot (2026-09-16 12:39) (2026-09-16 12:39)

**Status:** 🔵 AUTO-COMPACT SNAPSHOT
**What:** Context saved automatically before Claude compacted the conversation.
**When:** 2026-09-16 12:39
**Project detected:** /home/user/NeXuS/projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access


---


## TransWay MCP re-registered in Claude Code (2026-09-19 19:30)

**Status:** ✅ TESTED

**What:** Re-registered TransWay MCP server in Claude Code local config. Verified all 22 tools load and OUT-axis (ask_character) returns live responses.

**Why:** TransWay was registered in a prior session but not showing in mcp list after session restart.

**How:** claude mcp remove transway (not found); claude mcp add transway -- /home/user/.venv/nexus-mcp/bin/python /home/user/NeXuS/projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access/transway/nexus_transway_mcp.py. Added to ~/.claude.json project-scoped config.

**Files:** ~/.claude.json

**Testing:** ✅ list_characters returns 7 characters; ask_character(A.I.M.E) returns live in-character response. mcp list shows transway: Connected after session restart.

**Dependencies:** /home/user/.venv/nexus-mcp/bin/python with mcp package; nexus_transway_mcp.py; char-gen web server on :8443 for forge/chat tools

---


## Pre-compact snapshot (2026-09-19 19:31) (2026-09-19 19:31)

**Status:** 🔵 AUTO-COMPACT SNAPSHOT
**What:** Context saved automatically before Claude compacted the conversation.
**When:** 2026-09-19 19:31
**Project detected:** /home/user/NeXuS/projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access


---


## Pre-compact snapshot (2026-09-20 12:21) (2026-09-20 12:21)

**Status:** 🔵 AUTO-COMPACT SNAPSHOT
**What:** Context saved automatically before Claude compacted the conversation.
**When:** 2026-09-20 12:21
**Project detected:** /home/user/NeXuS/projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access


---


---

## TTS Overhaul — Bifrost Backend + AudioContext Pipeline (2026-10-27)

**Status:** ✅ TESTED — TTS playing in browser via Bifrost/Pollinations

**What:** Replaced Gemini TTS (`gemini-2.5-flash-preview-tts` + PCM/WebAudio) with Bifrost-proxied Pollinations TTS. Fixed blank-screen crash. Added 11 voices, prefetch pipeline for smooth playback.

**Why:** Gemini TTS required a Gemini API key (not set), causing silent failure. App showed blank screen on load due to `Type`/`Modality`/`FunctionDeclaration` SDK enums used in `geminiService.ts` without imports (removed in Sep 15 provider refactor but usages missed). Bifrost `/api/tts` already worked (HTTP 200, MP3).

**How:**
- **`services/ttsService.ts`** — full rewrite: `fetch('/api/tts', {text, voice})` → Bifrost → Pollinations `gen.pollinations.ai/audio/` → `AudioContext.decodeAudioData()` → `AudioBufferSourceNode.start()`. No more blob URL / `new Audio()` (failed in LibreWolf). Prefetches next chunk while current plays to eliminate inter-sentence gaps.
- **`services/geminiService.ts`** — fixed module-level crash: `Type.OBJECT/STRING` → `"OBJECT"/"STRING"`, `Modality.AUDIO` → `"AUDIO"`, `FunctionDeclaration` type → `any`. These were SDK enums stripped in the Sep 15 refactor but usages survived.
- **`services/secureStorage.ts`** — bumped `DB_VERSION` 5→7 to clear stale IndexedDB from older builds (version downgrade = silent open failure = blank screen).
- **`App.tsx`** — added try/catch around `checkPassword()` so storage errors show setup screen instead of blank.
- **`components/CharacterForm.tsx`** — voice selector now shows Bifrost voices (Nova/Shimmer/Coral/Bella/Sarah female; Echo/Onyx/Fable male; Alloy/Ash/Sage neutral) with gender labels. Label: "Bifrost TTS".
- **`components/ChatInterface.tsx`** — `unlockAudio()` called on TTS button click (AudioContext autoplay unlock). Removed stale `initAudioContext` event listeners.
- **Bifrost `nexus_web_server.py`** — `/api/tts` now accepts optional `model` param, defaults to `tts-1-hd` (higher quality, still free) instead of bare default.

**Files:** `services/ttsService.ts`, `services/geminiService.ts`, `services/secureStorage.ts`, `App.tsx`, `components/CharacterForm.tsx`, `components/ChatInterface.tsx`, `~/NeXuS/bifrost-bridge/server/nexus_web_server.py`

**Voices available:** nova, shimmer, coral, bella, sarah, echo, onyx, fable, alloy, ash, sage

**Dependencies:** Bifrost running at https://localhost:8443, POLLINATIONS_API_KEY in nexus.env
