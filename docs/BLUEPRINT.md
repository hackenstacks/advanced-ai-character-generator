# NeXuS Char-Gen Framework — Master Blueprint
**The booster seat.** Read this first to resume at full altitude. Precise, file-level, contract-level.
Last updated: 2026-09-15 (TransWay session).

---

## 0. System Map (30k ft)

```
                        ┌─────────────────────────────────────────┐
   Claude Code ────────▶│  TransWay MCP (transway/nexus_transway   │  Axis IN
   (external agent)     │  _mcp.py) — 22 tools                     │
                        │  stdio | --http :9000/twp | CLI          │
                        └───────────────┬──────────────────────────┘
                                        │ Axis OUT
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼               ▼                ▼               ▼               ▼
   aichat :3030    Hister :4433    Web proxy :8443   IPFS :5001    Social (toot/nak)
   (peer LLM)      (local search)  (/api/llm/*,      (kubo)        (nostr/mastodon)
                                    keys server-side)
                                        ▲
                                        │  (browser: keys NEVER here)
        ┌───────────────────────────────┴───────────────────────────────┐
        │   React app (Vite :3001 dev / :8443 prod)                      │
        │   App.tsx · CharacterForm.tsx · TerminalWindow.tsx             │
        │   services/geminiService.ts (proxy-only) · providersService.ts │
        └────────────────────────────────────────────────────────────────┘
```

**Golden rule:** browser holds NO keys. Everything LLM/image goes through `:8443/api/llm/<provider>`
or `:8443/api/pollinations/image`. Server injects keys from `~/.config/nexus/secrets/nexus.env`.

---

## 1. File Map (exact anchors)

### TransWay server — `transway/nexus_transway_mcp.py`
```
config block            env-first: NEXUS_HOME, NEXUS_CHARACTERS, NEXUS_VAULT,
                        AICHAT_URL, HISTER_URL, NEXUS_WEB_PROXY, SEARX_URL,
                        NEXUS_TWP_API_KEY, IPFS_API/GATEWAY, NOSTR_KEY_FILE, SOCIAL_WEBHOOK
helpers                 _post_json, _get (SSL-relaxed), _character_slug,
                        _load_character, _chat_via_proxy   ← all LLM calls funnel here
OUT-axis tools          ask_aichat, search_local, search_web, ask_character
IN-axis tools           list_characters, summon_character (consult→gather→answer)
media                   youtube_transcript (json3+xml fallback), youtube_search (pipe-viewer)
story engine            _story_dir/_story_path/_story_image/_story_generate,
                        story_start, story_choose, story_list   (state in vault memory/)
forge                   _to_chara_card_v2 (THE converter), character_forge (save→ .json + .card.json)
prompt refiner          prompt_refine, prompt_refine_iterate
scene-reactive UI       theme_from_context  → {mood,palette{bg,header,bezel,accent,text},effect,lightness,base}
social                  social_post(platform=nostr|mastodon|webhook)
IPFS                    ipfs_add_text, ipfs_publish_character, ipfs_get, ipfs_import_character
attachable tools        _load_attached_tools() reads $NEXUS_HOME/config/twp-tools.json
                        types: http|gist|directory|studio|openapi
vault                   ensure_character_vault, list_avatars
CLI dispatch            _cli(argv): forge|refine|story|choose|stories|summon|yt|ytsearch|
                        characters|avatars|vault
entry                   --http (transceiver) | <cmd> (CLI) | else stdio MCP
```

### React — `services/geminiService.ts`
- `generateContent(prompt, apiKeyOrConfig?)` — proxy-only, provider from ApiConfig.service, model from .model.
- `generateImageFromPrompt(prompt, settings)` — switch on settings.service (pollinations/aihorde/openai/
  huggingface/stability/custom/gemini→proxy). Default = aihorde keyless.
- `streamOpenAIChatResponse` / `streamAIHordeTextResponse` — the two live chat paths.
- **Removed:** GoogleGenAI SDK, getAiClient default, hardcoded safety. `SAFETY_SETTINGS_NONE` = no-op export.

### React — `components/CharacterForm.tsx`
- Defaults: `defaultApiConfig`, `defaultEmbeddingConfig`, `defaultTranswayConfig`, `defaultMemoryConfig`.
- formState init (2 places: edit branch ~L255, new branch ~L288) sets: transwayEnabled/Config,
  avatarSize, moodAvatarEnabled, longTermMemoryEnabled, memoryConfig.
- Toggle blocks (in the Advanced Section, after Terminal toggle): TransWay (+sub-options),
  Mood Avatar, Avatar size slider, Long-Term Memory (+strategy, top-k, lore/knowledge paths).

### React — `components/TerminalWindow.tsx`
- `mode: 'sim'|'live'`, `liveStatus`. LIVE effect lazy-imports xterm from esm.sh, opens WS to
  `PTY_WS` = `${VITE_NEXUS_WEB_PROXY || host}`.replace(http→ws)`/api/nexus/studio/terminal`.
- SIM render = neon CRT history; LIVE render = xterm container div.

### types.ts (interfaces added)
- `Character`: +transwayEnabled, transwayConfig, avatarSize, moodAvatarEnabled, avatarGallery,
  longTermMemoryEnabled, memoryConfig.
- `TransWayConfig`: peers[], searchBackends[], consultBeforeAnswer, reachable, authMode, mcpEndpoint.
- `MemoryConfig`: strategy, windowSize, summarizeEvery, importanceThreshold, recencyHalfLifeHours,
  maxRecall, lorePaths[], knowledgePaths[].

---

## 2. Data Contracts

### character_forge output (JSON)
```json
{ "character": { name, description, personality, physicalAppearance, personalityTraits,
                 backstory, firstMessage, imagePrompt, avatarUrl, characterType, _forged },
  "card": { "spec":"chara_card_v2", "spec_version":"2.0",
            "data": { name, description, personality, scenario, first_mes, mes_example,
                      system_prompt, post_history_instructions, creator, creator_notes,
                      character_version, tags[], alternate_greetings[], extensions.nexus{} } } }
```
Saved (save=true): `$NEXUS_CHARACTERS/<slug>/<slug>.json` + `<slug>.card.json` + vault dirs.

### story_start / story_choose output (JSON)
```json
{ "story_id", "scene", "image" (proxy pollinations url), "choices":[{keyword,label}], "turn"? }
```
State: `$NEXUS_VAULT/characters/<slug>/memory/story-<id>.json` {id,character,system,history[],scenes[]}.

### theme_from_context output (JSON) — the scene-reactive UI contract
```json
{ "mood","palette":{"bg","header","bezel","accent","text"},"effect":"none|scanlines|rain|glow|fog",
  "lightness":"dark|dim|light","base":"auto|tron|matrix" }
```

### proxy chat contract (server side, :8443)
`POST /api/llm/<provider>/v1/chat/completions` {model,messages,stream:false} → OpenAI shape.
Providers from `PROVIDER_<ID>_*` in nexus.env. No Authorization header from browser.

---

## 3. Pending Features — EXACT specs

### 3.1 React StoryPlayer MVP  (`components/StoryPlayer.tsx` — NEW)
- Props: `{ character: Character, onClose }`.
- State: `scene, imageUrl, choices[], turn, storyId, loading`.
- Engine: mirror TWP in TS OR call TWP `--http`. MVP = call geminiService.generateContent with the
  story system prompt (same as `_story_generate`), parse `{scene,image_prompt,choices}`, then
  generateImageFromPrompt(image_prompt).
- Render: inline `<img src={imageUrl}>` above scene text; choice buttons (keyword→advance).
- Persistence: POST scene to a `/api/nexus/story` OR localStorage keyed by storyId (MVP).

### 3.2 Scene-reactive UI apply-layer  (`services/themeService.ts` — extend)
- `applyTheme(spec)`: set CSS vars `--bg,--header,--bezel,--accent,--text` on `:root`;
  toggle body class for `effect` (scanlines/rain/glow/fog) + `lightness`.
- Timer: `useEffect` interval (default 5 min, configurable) → build summary of last N messages →
  `theme_from_context(summary, base)` → applyTheme. base from a UI selector: auto|tron|matrix.
- Tron preset: bg #000814, accent #00e5ff, bezel #00b4d8, effect glow.
- Matrix preset: bg #000000, accent #00ff41, text #00ff41, effect rain.

### 3.3 Mood Avatar runtime
- When `moodAvatarEnabled`, after each AI turn: classify mood (1 word) → pick nearest avatar from
  `list_avatars(character)` (vault) → set active avatarUrl. Fallback: generate via imagePrompt.
- Vault path: `$NEXUS_VAULT/characters/<slug>/avatars/`. Seed on character save (see 3.6).

### 3.4 Uniform encryption (AES-256-GCM, one password)  — CRITICAL, cross-cutting
- Standard (per char dir memory): PBKDF2(password) → AES-256-GCM. Encrypt: `<slug>.json`, chats/,
  memory/, backup/. Plain: `.png`, images/, saves/, `.card.json` (shareable by design).
- One `cryptoService.ts` in web + one `nexus_crypto.py` for CLI/TWP — SAME KDF params + format so a
  file encrypted by one decrypts in the other. Format: `NXSV1|<b64 salt>|<b64 iv>|<b64 ct>`.
- No key files. Password IS the key. This must be identical web ⇄ python ⇄ (future) go.

### 3.5 tmux pluggable hookup
- `~/.tmux/plugins/` script: prefix+key → menu launching TWP CLI (forge/story/summon) in a popup.
- Report/help lives with the script per file protocol.

### 3.6 Vault auto-create on character save
- On CharacterForm save: call `ensure_character_vault(name)` (via TWP http or a small endpoint) so
  `avatars/ chats/ memory/ audio/` exist. Copy the base avatar into `avatars/` as seed.

### 3.7 pyradio + character audio player
- `pyradio` station selector (station list) as a framework panel; character `audio` dir in vault for
  per-character tracks; player selects from `$NEXUS_VAULT/characters/<slug>/audio/`.

### 3.8 Go port (of TWP engine)
- Port `_chat_via_proxy`, `_to_chara_card_v2`, forge/story/refine as a Go binary (matches
  adv-go-char-gen lineage + nexus-charcard Go lib). CLI parity first, then MCP via mcp-go.

---

## 4. Runbook

```bash
# TransWay CLI
~/.venv/nexus-mcp/bin/python transway/nexus_transway_mcp.py forge "cyberpunk oracle" --save
~/.venv/nexus-mcp/bin/python transway/nexus_transway_mcp.py story A.I.M.E "a haunted station" scifi
~/.venv/nexus-mcp/bin/python transway/nexus_transway_mcp.py characters
# Transceiver (external agents)
NEXUS_TWP_API_KEY=$… python transway/nexus_transway_mcp.py --http    # :9000/twp
# Dev UI
cd <app> && npm run dev          # https://localhost:3001
# Deps to start: web :8443, aichat :3030, hister :4433, (ipfs: doas rc-service ipfs start)
```

Registered MCP: `claude mcp add transway -- ~/.venv/nexus-mcp/bin/python <abs path>` → ✅ Connected.

---

## 5. 🎪 The NeXuS Menagerie (release-mode easter eggs — canon)

Triggered by system states (overload, idle, release). All chafa/gif walkers across the screen.

| Trigger | Character | Behavior |
|---|---|---|
| **Task overload** (queue saturated) | 🐒 **The Monkier** | Cymbal monkey in a **football helmet**, marches back & forth banging cymbals. Each screen edge → **a few kitties follow in, all meowing**. |
| big compute / long op | 🦍 **Surfing Gorilla** | Catches a wave clean across the screen. |
| random idle | 🫏 **Blue Donkey** | Ambles in, deadpan. |
| navigation flurry | 🐒 **Tarzan** | Swings icon-to-icon across the desktop. |
| dairy event / error digest | 🦛 **Lactose Hippo** | The lactose-intolerant hippo. Consequences. |
| soundtrack moment | 🎸 **Sgt. Pepper's Quartet** | Rides in on the **Crazy Train** that **Ozzy wrecked into the Start button**. |
| **RELEASE / ship** | 🔨 **Mjölnir Rage Room** | User is handed the **Hammer of Thor** — total rage-room, have your way with the desktop. Cathartic release ritual. |
| smash lands a hole | 🐹 **Grover** | Pops his head up through the smashed hole, then ducks back into it. |

> Doctrine: turn system states into charm. Overload isn't an error — it's a show.

---

*NeXuS — Sane · Simple · Secure · Stealthy · Sustainable · Beautiful. You are the judge.*
