#!/usr/bin/env python3
"""
nexus_transway_mcp.py — TransWay Protocol (TWP) server for the NeXuS Char-Gen Framework.

TransWay is a DOUBLE-AXIS MCP (a transceiver):
  • Axis IN  — external agents you grant a key/cert can SUMMON your characters
               (e.g. Claude Code: "ask ShadowVault what he thinks about this protocol")
  • Axis OUT — characters reach OUT before answering: consult aichat / other
               characters, and search the web/local for current data.

Auth (NeXuS principle — you are the judge): API key (NEXUS_TWP_API_KEY) or mutual TLS.

Transports:
  stdio  (default) — Claude Code launches this directly:
      claude mcp add transway -- ~/.venv/nexus-mcp/bin/python <this file>
  http   — serve external agents:  this-file --http   (streamable-http on :9000/twp)

All paths & endpoints come from env vars — NO HARDCODED LINKS.
"""

import os
import sys
import json
import glob
import urllib.request
import urllib.parse
import ssl
from pathlib import Path

from mcp.server.mcpserver import MCPServer

# ── config (env-first, sane defaults) ───────────────────────────────────────────
NEXUS_HOME     = Path(os.environ.get("NEXUS_HOME", str(Path.home() / "NeXuS")))
CHARACTERS_DIR = Path(os.environ.get("NEXUS_CHARACTERS", str(NEXUS_HOME / "characters")))
VAULT_DIR      = Path(os.environ.get("NEXUS_VAULT", str(NEXUS_HOME / "vault")))
AICHAT_URL     = os.environ.get("AICHAT_URL", "http://127.0.0.1:3030")
HISTER_URL     = os.environ.get("HISTER_URL", "http://127.0.0.1:4433")
WEB_PROXY      = os.environ.get("NEXUS_WEB_PROXY", "https://127.0.0.1:8443")
SEARX_URL      = os.environ.get("SEARX_URL", "")   # optional web search (SearXNG/Brave gateway)
TWP_API_KEY    = os.environ.get("NEXUS_TWP_API_KEY", "")
TWP_PORT       = int(os.environ.get("NEXUS_TWP_PORT", "9000"))

# accept self-signed cert from the local web-server proxy
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE

app = MCPServer("transway", version="0.1.0",
                instructions="TransWay Protocol — double-axis MCP for NeXuS characters.")


# ── helpers ─────────────────────────────────────────────────────────────────────
def _post_json(url: str, payload: dict, timeout: int = 60) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    ctx = _SSL if url.startswith("https") else None
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return json.loads(r.read().decode())


def _get(url: str, timeout: int = 20) -> str:
    ctx = _SSL if url.startswith("https") else None
    with urllib.request.urlopen(url, timeout=timeout, context=ctx) as r:
        return r.read().decode(errors="replace")


def _character_slug(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in name.lower()).strip("-")


def _load_character(name: str) -> dict | None:
    """Load a character record (aime/aime.json standard, or flat <name>.json)."""
    slug = _character_slug(name)
    for candidate in (CHARACTERS_DIR / slug / f"{slug}.json",
                      CHARACTERS_DIR / slug / "character.json",
                      CHARACTERS_DIR / f"{name}.json"):
        if candidate.is_file():
            try:
                return json.loads(candidate.read_text())
            except Exception:
                pass
    # fuzzy: any dir whose name matches
    for d in CHARACTERS_DIR.glob("*/"):
        if _character_slug(d.name) == slug:
            j = next(iter(d.glob("*.json")), None)
            if j:
                try:
                    return json.loads(j.read_text())
                except Exception:
                    pass
    return None


def _chat_via_proxy(provider: str, model: str, messages: list, timeout: int = 90) -> str:
    """Route an LLM call through the web-server proxy (keys server-side, no key here)."""
    url = f"{WEB_PROXY}/api/llm/{provider}/v1/chat/completions"
    try:
        d = _post_json(url, {"model": model, "messages": messages, "stream": False}, timeout)
        return (d.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
    except Exception as e:
        return f"[proxy error via {provider}: {e}]"


# ── OUTBOUND-axis tools (characters reach out) ──────────────────────────────────
@app.tool()
def ask_aichat(prompt: str, model: str = "") -> str:
    """Ask the local aichat instance a question. Use for a second AI opinion or current reasoning."""
    body = {"model": model or "default",
            "messages": [{"role": "user", "content": prompt}], "stream": False}
    try:
        d = _post_json(f"{AICHAT_URL}/v1/chat/completions", body)
        return (d.get("choices", [{}])[0].get("message", {}).get("content") or "").strip() or "[empty]"
    except Exception as e:
        return f"[aichat error: {e}]"


@app.tool()
def search_local(query: str, limit: int = 8) -> str:
    """Deep-search the LOCAL knowledge base (Hister) — your files, notes, scripts, datasets."""
    try:
        raw = _get(f"{HISTER_URL}/api/search?q={urllib.parse.quote(query)}&limit={limit}")
        try:
            hits = json.loads(raw)
            items = hits.get("results", hits if isinstance(hits, list) else [])
            return "\n".join(f"• {h.get('title', h.get('path', '?'))}: {h.get('snippet', '')[:160]}"
                             for h in items[:limit]) or "[no local results]"
        except json.JSONDecodeError:
            return raw[:2000]
    except Exception as e:
        return f"[hister error: {e}]"


@app.tool()
def search_web(query: str, limit: int = 6) -> str:
    """Deep-search the WEB for current data (via SEARX_URL if configured, else local fallback)."""
    if not SEARX_URL:
        return "[web search not configured — set SEARX_URL. Falling back to local]\n" + search_local(query, limit)
    try:
        raw = _get(f"{SEARX_URL}/search?format=json&q={urllib.parse.quote(query)}")
        d = json.loads(raw)
        return "\n".join(f"• {r.get('title', '?')} — {r.get('url', '')}\n  {r.get('content', '')[:160]}"
                         for r in d.get("results", [])[:limit]) or "[no web results]"
    except Exception as e:
        return f"[web search error: {e}]"


@app.tool()
def ask_character(name: str, prompt: str) -> str:
    """Ask ANOTHER character a question (character-to-character bridge). Returns their in-character reply."""
    return summon_character(name, prompt, consult=False)


# ── INBOUND-axis tools (external agents summon characters) ──────────────────────
@app.tool()
def list_characters() -> str:
    """List characters available to summon over TransWay, with their reachability."""
    out = []
    for d in sorted(CHARACTERS_DIR.glob("*/")):
        j = next(iter(d.glob("*.json")), None)
        if not j:
            continue
        try:
            c = json.loads(j.read_text())
        except Exception:
            continue
        tw = c.get("transwayEnabled") and (c.get("transwayConfig", {}) or {}).get("reachable")
        out.append(f"  {'⇅' if tw else '·'} {c.get('name', d.name)}"
                   f"{'  [reachable]' if tw else ''}")
    return "TransWay characters:\n" + "\n".join(out) if out else "[no characters found]"


@app.tool()
def summon_character(name: str, prompt: str, consult: bool = True) -> str:
    """
    Summon a character and get its response. THE main inbound entry point.
    If the character has consultBeforeAnswer, it first consults its peers + searches,
    then synthesizes a reply (double-axis: IN summons, OUT gathers, then answers).
    """
    char = _load_character(name)
    if not char:
        return f"[character '{name}' not found in {CHARACTERS_DIR}]"

    tw = char.get("transwayConfig", {}) or {}
    system = (char.get("personality") or char.get("description")
              or f"You are {char.get('name', name)}.")

    gathered = []
    if consult and char.get("transwayEnabled") and tw.get("consultBeforeAnswer"):
        # OUTBOUND axis — gather context before answering
        for peer in (tw.get("peers") or []):
            if peer.lower() in ("aichat",):
                gathered.append(f"[aichat]: {ask_aichat(prompt)}")
            else:
                gathered.append(f"[{peer}]: {ask_character(peer, prompt)}")
        backend = (tw.get("searchBackends") or ["local"])[0]
        if backend in ("local", "both"):
            gathered.append(f"[local search]: {search_local(prompt, 5)}")
        if backend in ("web", "both"):
            gathered.append(f"[web search]: {search_web(prompt, 5)}")

    ctx = ("\n\nContext gathered before answering:\n" + "\n".join(gathered)) if gathered else ""
    api = char.get("apiConfig", {}) or {}
    provider = api.get("service") or "pollinations"
    if provider in ("default", "aihorde", "aihorde_text"):
        provider = "pollinations"
    model = api.get("model") or "openai"

    return _chat_via_proxy(provider, model, [
        {"role": "system", "content": system + ctx},
        {"role": "user", "content": prompt},
    ])


# ── media: YouTube transcript reader (zero-dependency) ──────────────────────────
def _yt_id(url_or_id: str) -> str:
    s = url_or_id.strip()
    for pat in ("v=", "youtu.be/", "/shorts/", "/embed/"):
        if pat in s:
            s = s.split(pat, 1)[1]
            break
    return s.split("&")[0].split("?")[0].split("/")[0]


@app.tool()
def youtube_transcript(url_or_id: str, lang: str = "en") -> str:
    """Read the transcript/captions of a YouTube video. Accepts a full URL or a video ID."""
    import re, html
    vid = _yt_id(url_or_id)
    try:
        page = _get(f"https://www.youtube.com/watch?v={vid}&hl={lang}", timeout=25)
        m = re.search(r'"captionTracks":(\[.*?\])', page)
        if not m:
            return f"[no captions found for {vid} — video may have captions disabled]"
        tracks = json.loads(m.group(1).replace('\\u0026', '&'))
        track = next((t for t in tracks if t.get("languageCode", "").startswith(lang)), tracks[0])
        cap_url = track["baseUrl"].replace('\\u0026', '&')
        # json3 format is the most reliable modern format
        j3 = cap_url + ("&" if "?" in cap_url else "?") + "fmt=json3"
        transcript = ""
        try:
            data = json.loads(_get(j3, timeout=25))
            segs = []
            for ev in data.get("events", []):
                for s in ev.get("segs", []) or []:
                    segs.append(s.get("utf8", ""))
            transcript = "".join(segs).replace("\n", " ").strip()
        except Exception:
            pass
        if not transcript:  # fallback to XML
            xml = _get(cap_url, timeout=25)
            texts = re.findall(r'<text[^>]*>(.*?)</text>', xml, re.S)
            transcript = " ".join(html.unescape(re.sub(r'<[^>]+>', '', t)).strip() for t in texts)
        transcript = transcript.replace("&#39;", "'").replace("&amp;", "&").strip()
        if not transcript:
            return f"[transcript empty for {vid}]"
        return f"[transcript {vid} · {track.get('languageCode', lang)} · {len(transcript)} chars]\n\n{transcript[:12000]}"
    except Exception as e:
        return f"[youtube transcript error for {vid}: {e}]"


@app.tool()
def youtube_search(query: str, limit: int = 8) -> str:
    """Search YouTube via pipe-viewer (privacy-respecting, no API key). Returns titles + IDs + URLs."""
    import subprocess, shutil
    pv = shutil.which("pipe-viewer")
    if not pv:
        return "[pipe-viewer not installed — doas apk add pipe-viewer]"
    try:
        r = subprocess.run(
            [pv, "--no-interactive", "--results", str(limit), "--print-url", query],
            capture_output=True, text=True, timeout=40)
        out = (r.stdout or "").strip()
        if not out:
            # fallback: parse titles+ids in JSON mode
            r2 = subprocess.run([pv, "--no-interactive", "--results", str(limit), query],
                                capture_output=True, text=True, timeout=40)
            out = (r2.stdout or r2.stderr or "").strip()
        return out[:4000] or "[no results]"
    except Exception as e:
        return f"[pipe-viewer error: {e}]"


# ── vault home-drive management ─────────────────────────────────────────────────
@app.tool()
def ensure_character_vault(name: str) -> str:
    """Create the character's home drive in the vault (avatars/, chats/, memory/) if missing."""
    slug = _character_slug(name)
    base = VAULT_DIR / "characters" / slug
    for sub in ("avatars", "chats", "memory", "audio"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return f"[vault ready: {base}]"


@app.tool()
def list_avatars(name: str) -> str:
    """List avatars available in a character's vault home drive (for Mood Avatar selection)."""
    slug = _character_slug(name)
    adir = VAULT_DIR / "characters" / slug / "avatars"
    if not adir.is_dir():
        return f"[no avatar dir — run ensure_character_vault('{name}') first]"
    files = [p.name for p in adir.iterdir()
             if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif")]
    return "\n".join(f"• {f}" for f in sorted(files)) or "[no avatars in vault]"


# ── STORY MODE — branching narrative, keyword crossroads, inline images ─────────
# State lives in the character's vault home drive: $VAULT/characters/<slug>/memory/story-<id>.json
import time as _time
import uuid as _uuid


def _story_dir(character: str) -> Path:
    slug = _character_slug(character)
    d = VAULT_DIR / "characters" / slug / "memory"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _story_path(character: str, story_id: str) -> Path:
    return _story_dir(character) / f"story-{story_id}.json"


def _story_image(character: str, image_prompt: str) -> str:
    """Generate an inline scene image via the char's image provider through the proxy. Returns a URL."""
    char = _load_character(character) or {}
    img = (char.get("imageApiConfig") or char.get("apiConfig") or {})
    provider = img.get("service") or "pollinations"
    if provider in ("default", "aihorde", "aihorde_text", "gemini"):
        provider = "pollinations"
    # Same-origin proxy image route (keyless pollinations default)
    enc = urllib.parse.quote(image_prompt[:300])
    return f"{WEB_PROXY}/api/pollinations/image?prompt={enc}&width=768&height=512&model=flux"


def _story_generate(character: str, system: str, history: list, user_turn: str) -> dict:
    """Ask the LLM for the next scene as JSON: {scene, image_prompt, choices:[{keyword,label}]}."""
    char = _load_character(character) or {}
    api = char.get("apiConfig", {}) or {}
    provider = api.get("service") or "pollinations"
    if provider in ("default", "aihorde", "aihorde_text"):
        provider = "pollinations"
    model = api.get("model") or "openai"

    instruct = (
        "You are the narrator of an interactive branching story. "
        "Respond ONLY with compact JSON, no prose, no code fences, in this exact shape:\n"
        '{"scene":"2-4 vivid sentences of narration","image_prompt":"a visual description for an illustration of this scene",'
        '"choices":[{"keyword":"SHORT_KEY","label":"what the reader does"}]}\n'
        "Provide 2 to 4 choices. Keywords must be single UPPERCASE tokens (no spaces). "
        "Each choice is a crossroad decision that meaningfully changes the story."
    )
    messages = [{"role": "system", "content": f"{system}\n\n{instruct}"}]
    messages += history[-8:]
    messages.append({"role": "user", "content": user_turn})

    raw = _chat_via_proxy(provider, model, messages)
    # tolerant JSON extraction
    txt = raw.strip()
    if "```" in txt:
        txt = txt.split("```")[1].replace("json", "", 1) if txt.count("```") >= 2 else txt
    start, end = txt.find("{"), txt.rfind("}")
    try:
        obj = json.loads(txt[start:end + 1])
    except Exception:
        obj = {"scene": raw[:600], "image_prompt": raw[:120],
               "choices": [{"keyword": "CONTINUE", "label": "Continue"}]}
    obj.setdefault("choices", [{"keyword": "CONTINUE", "label": "Continue"}])
    obj.setdefault("image_prompt", obj.get("scene", "")[:120])
    return obj


@app.tool()
def story_start(character: str, premise: str = "", genre: str = "") -> str:
    """Begin an interactive branching story narrated by a character. Returns the opening scene, an inline image URL, and keyword crossroad choices (as JSON)."""
    char = _load_character(character)
    if not char:
        return f"[character '{character}' not found]"
    ensure_character_vault(character)
    story_id = _uuid.uuid4().hex[:8]
    system = (char.get("personality") or char.get("description")
              or f"You are {char.get('name', character)}, a master storyteller.")
    seed = f"Begin a new {genre or 'adventure'} story. Premise: {premise or 'Surprise the reader.'}"
    scene = _story_generate(character, system, [], seed)
    img = _story_image(character, scene["image_prompt"])
    state = {
        "id": story_id, "character": character, "genre": genre, "premise": premise,
        "system": system, "created": _time.time(),
        "history": [{"role": "user", "content": seed},
                    {"role": "assistant", "content": json.dumps(scene)}],
        "scenes": [{"scene": scene["scene"], "image": img, "choices": scene["choices"]}],
    }
    _story_path(character, story_id).write_text(json.dumps(state, indent=2))
    return json.dumps({"story_id": story_id, "scene": scene["scene"],
                       "image": img, "choices": scene["choices"]})


@app.tool()
def story_choose(character: str, story_id: str, keyword: str) -> str:
    """Advance a story by choosing a crossroad keyword. Returns the next scene, inline image, and new choices (JSON)."""
    p = _story_path(character, story_id)
    if not p.is_file():
        return f"[story {story_id} not found for {character}]"
    state = json.loads(p.read_text())
    prev_choices = state["scenes"][-1]["choices"] if state["scenes"] else []
    chosen = next((c for c in prev_choices if c["keyword"].upper() == keyword.upper()), None)
    turn = f"The reader chose: {chosen['label']} ({keyword})" if chosen else f"The reader chose: {keyword}"
    scene = _story_generate(character, state["system"], state["history"], turn)
    img = _story_image(character, scene["image_prompt"])
    state["history"] += [{"role": "user", "content": turn},
                         {"role": "assistant", "content": json.dumps(scene)}]
    state["scenes"].append({"scene": scene["scene"], "image": img, "choices": scene["choices"]})
    p.write_text(json.dumps(state, indent=2))
    return json.dumps({"story_id": story_id, "scene": scene["scene"],
                       "image": img, "choices": scene["choices"],
                       "turn": len(state["scenes"])})


@app.tool()
def story_list(character: str) -> str:
    """List saved stories for a character."""
    d = _story_dir(character)
    out = []
    for f in sorted(d.glob("story-*.json")):
        try:
            s = json.loads(f.read_text())
            out.append(f"• {s['id']}  [{s.get('genre', '?')}]  turns={len(s.get('scenes', []))}  {s.get('premise', '')[:50]}")
        except Exception:
            pass
    return "\n".join(out) or "[no stories yet]"


# ── CHARACTER FORGE — keywords → full character (backstory, traits, image) ──────
def _forge_llm(system: str, user: str, provider: str = "pollinations", model: str = "openai") -> str:
    return _chat_via_proxy(provider, model,
                           [{"role": "system", "content": system},
                            {"role": "user", "content": user}])


def _to_chara_card_v2(char: dict) -> dict:
    """Convert a forged/framework character → chara_card_v2 (PNG² editor, SillyTavern,
    TavernAI, aichat-role compatible). One interop format across all NeXuS systems."""
    traits = char.get("personalityTraits", "")
    personality = char.get("personality", "")
    if traits:
        personality = (personality + f"\n\nTraits: {traits}").strip()
    return {
        "spec": "chara_card_v2",
        "spec_version": "2.0",
        "data": {
            "name": char.get("name", ""),
            "description": char.get("description", ""),
            "personality": personality,
            "scenario": char.get("backstory", char.get("scenario", "")),
            "first_mes": char.get("firstMessage", char.get("first_mes", "")),
            "mes_example": char.get("mes_example", ""),
            "system_prompt": char.get("system_prompt", ""),
            "post_history_instructions": char.get("post_history_instructions", ""),
            "creator": char.get("creator", "NeXuS TransWay Forge"),
            "creator_notes": char.get("physicalAppearance", ""),
            "character_version": char.get("character_version", "1.0"),
            "tags": [t.strip() for t in traits.split(",") if t.strip()],
            "alternate_greetings": char.get("alternate_greetings", []),
            "extensions": {
                "nexus": {
                    "imagePrompt": char.get("imagePrompt", ""),
                    "avatarUrl": char.get("avatarUrl", ""),
                    "forged": char.get("_forged", {}),
                }
            },
        },
    }


@app.tool()
def character_forge(keywords: str, genre: str = "", save: bool = False) -> str:
    """Generate a COMPLETE character from a few keywords: name, description, personality,
    physical appearance, traits, backstory, first message, and an image prompt.
    Returns character JSON (chara_card_v2-compatible). Set save=true to write to the roster + vault."""
    system = (
        "You are a master character designer. From the user's keywords, invent a complete, "
        "vivid, original character. Respond ONLY with compact JSON, no prose, no code fences:\n"
        '{"name":"","description":"one-line hook","personality":"2-3 sentences",'
        '"physicalAppearance":"","personalityTraits":"comma,separated,traits",'
        '"backstory":"a paragraph of origin","firstMessage":"how they greet the user in-character",'
        '"imagePrompt":"a detailed prompt to illustrate this character"}'
    )
    user = f"Keywords: {keywords}" + (f"\nGenre: {genre}" if genre else "")
    raw = _forge_llm(system, user)
    txt = raw.strip()
    if "```" in txt and txt.count("```") >= 2:
        txt = txt.split("```")[1].replace("json", "", 1)
    s, e = txt.find("{"), txt.rfind("}")
    try:
        char = json.loads(txt[s:e + 1])
    except Exception:
        return f"[forge parse error]\n{raw[:800]}"

    # generate an avatar image
    if char.get("imagePrompt"):
        char["avatarUrl"] = _story_image(char.get("name", "new"), char["imagePrompt"])

    char.setdefault("characterType", "character")
    char["_forged"] = {"keywords": keywords, "genre": genre, "at": _time.time()}

    if save:
        slug = _character_slug(char.get("name", f"forged-{_uuid.uuid4().hex[:6]}"))
        cdir = CHARACTERS_DIR / slug
        cdir.mkdir(parents=True, exist_ok=True)
        char["id"] = slug
        # framework record
        (cdir / f"{slug}.json").write_text(json.dumps(char, indent=2))
        # portable chara_card_v2 (PNG² editor / SillyTavern / aichat-role compatible)
        card = _to_chara_card_v2(char)
        (cdir / f"{slug}.card.json").write_text(json.dumps(card, indent=2))
        ensure_character_vault(char.get("name", slug))
        return json.dumps({"saved": str(cdir / f"{slug}.json"),
                           "card": str(cdir / f"{slug}.card.json"),
                           "character": char})
    return json.dumps({"character": char, "card": _to_chara_card_v2(char)})


# ── PROMPT REFINER — subtle variations, pick one, iterate ───────────────────────
@app.tool()
def prompt_refine(prompt: str, count: int = 4, images: bool = True) -> str:
    """Take a prompt and produce N SUBTLE variations (small tweaks, not rewrites).
    Optionally generate an image per variation so the user can pick a favorite.
    Returns JSON: {variations:[{prompt, image?}]}."""
    system = (
        "You refine image prompts. Produce SUBTLE variations of the user's prompt — small, "
        "tasteful changes to lighting, mood, composition, detail — NOT complete rewrites. "
        f"Return ONLY a JSON array of exactly {count} strings, each a full refined prompt."
    )
    raw = _forge_llm(system, prompt)
    txt = raw.strip()
    s, e = txt.find("["), txt.rfind("]")
    try:
        variants = json.loads(txt[s:e + 1])[:count]
    except Exception:
        variants = [prompt]
    out = []
    for v in variants:
        item = {"prompt": v}
        if images:
            item["image"] = f"{WEB_PROXY}/api/pollinations/image?prompt={urllib.parse.quote(str(v)[:300])}&width=768&height=512&model=flux"
        out.append(item)
    return json.dumps({"variations": out})


@app.tool()
def prompt_refine_iterate(chosen_prompt: str, direction: str = "", count: int = 4, images: bool = True) -> str:
    """Build off a CHOSEN variation: generate the next round of subtle variations,
    optionally nudged by a direction (e.g. 'more dramatic', 'warmer light')."""
    seed = chosen_prompt + (f"\n\nNudge in this direction: {direction}" if direction else "")
    return prompt_refine(seed, count, images)


# ── SCENE-REACTIVE UI — theme spec generated from the live conversation/scene ───
# The UI polls this on a timer (e.g. every 5 min) with the current summary; the whole
# chrome (header, bezel, background, accent) morphs to match the mood/setting.
@app.tool()
def theme_from_context(summary: str, base: str = "auto") -> str:
    """Generate a UI theme spec from the current conversation summary or story scene.
    Returns JSON: {mood, palette:{bg,header,bezel,accent,text}, effect, base}.
    base can pin a style (tron|matrix|auto). The UI applies this to reskin live."""
    system = (
        "You are a UI mood director. Given a scene/summary, output ONLY compact JSON:\n"
        '{"mood":"one word","palette":{"bg":"#hex","header":"#hex","bezel":"#hex",'
        '"accent":"#hex","text":"#hex"},"effect":"none|scanlines|rain|glow|fog",'
        '"lightness":"dark|dim|light"}\n'
        "Colors must suit the scene's time-of-day, setting, and emotional tone. "
        + (f"Bias toward a {base} aesthetic. " if base in ("tron", "matrix") else "")
    )
    raw = _forge_llm(system, summary[:1500])
    txt = raw.strip()
    s, e = txt.find("{"), txt.rfind("}")
    try:
        spec = json.loads(txt[s:e + 1])
    except Exception:
        spec = {"mood": "neutral",
                "palette": {"bg": "#0a0a0f", "header": "#0e1620", "bezel": "#00e5ff",
                            "accent": "#00ff88", "text": "#e5e7eb"},
                "effect": "none", "lightness": "dark"}
    spec["base"] = base
    return json.dumps(spec)


# ── SOCIAL BRIDGE — pluggable, sovereign-first (Nostr / Mastodon / webhook) ─────
# No hardcoded keys. Nostr key path via env (NOSTR_KEY_FILE); Mastodon via `toot` login.
NOSTR_KEY_FILE = os.environ.get("NOSTR_KEY_FILE", "")
NOSTR_RELAYS   = os.environ.get("NOSTR_RELAYS", "wss://relay.damus.io,wss://nos.lol")
SOCIAL_WEBHOOK = os.environ.get("SOCIAL_WEBHOOK", "")


@app.tool()
def social_post(text: str, platform: str = "mastodon") -> str:
    """Post to social media (sovereign-first). platform = nostr | mastodon | webhook.
    Nostr uses NOSTR_KEY_FILE + nak; Mastodon uses `toot`; webhook POSTs to SOCIAL_WEBHOOK."""
    import subprocess, shutil
    p = platform.lower()
    try:
        if p == "nostr":
            nak = shutil.which("nak")
            if not nak:
                return "[nostr: `nak` not installed — doas apk add nak (or go install github.com/fiatjaf/nak)]"
            if not NOSTR_KEY_FILE or not Path(os.path.expanduser(NOSTR_KEY_FILE)).is_file():
                return "[nostr: set NOSTR_KEY_FILE to your nsec/hex key path]"
            sec = Path(os.path.expanduser(NOSTR_KEY_FILE)).read_text().strip()
            relays = NOSTR_RELAYS.split(",")
            r = subprocess.run([nak, "event", "-k", "1", "-c", text, "--sec", sec, *relays],
                               capture_output=True, text=True, timeout=30)
            return (r.stdout or r.stderr or "[posted to nostr]").strip()[:800]
        if p == "mastodon":
            toot = shutil.which("toot")
            if not toot:
                return "[mastodon: `toot` not installed]"
            r = subprocess.run([toot, "post", text], capture_output=True, text=True, timeout=30)
            return (r.stdout or r.stderr or "[posted]").strip()[:800] if r.returncode == 0 \
                else f"[toot error — run `toot login` first: {(r.stderr or '')[:200]}]"
        if p == "webhook":
            if not SOCIAL_WEBHOOK:
                return "[webhook: set SOCIAL_WEBHOOK url]"
            return json.dumps(_post_json(SOCIAL_WEBHOOK, {"text": text}))[:800]
        return f"[unknown platform '{platform}' — use nostr|mastodon|webhook]"
    except Exception as e:
        return f"[social_post error: {e}]"


# ── IPFS — sovereign content-addressed sharing (kubo) ───────────────────────────
IPFS_API     = os.environ.get("IPFS_API", "http://127.0.0.1:5001")
IPFS_GATEWAY = os.environ.get("IPFS_GATEWAY", "http://127.0.0.1:8080")


def _ipfs_add_bytes(name: str, data: bytes) -> str:
    """POST multipart to the local kubo /api/v0/add. Returns the CID."""
    boundary = "----NeXuSTransWay" + _uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{name}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{IPFS_API}/api/v0/add?cid-version=1",
                                 data=body,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode()).get("Hash", "")


@app.tool()
def ipfs_add_text(name: str, content: str) -> str:
    """Add arbitrary text/JSON to IPFS. Returns the CID + gateway URL."""
    try:
        cid = _ipfs_add_bytes(name, content.encode())
        return json.dumps({"cid": cid, "gateway": f"{IPFS_GATEWAY}/ipfs/{cid}", "name": name})
    except Exception as e:
        return f"[ipfs add error: {e} — is kubo running? rc-service ipfs start]"


@app.tool()
def ipfs_publish_character(name: str) -> str:
    """Publish a character's chara_card_v2 to IPFS for sovereign, content-addressed sharing.
    Anyone can import it from the CID — no server, no gatekeeper."""
    char = _load_character(name)
    if not char:
        return f"[character '{name}' not found]"
    slug = _character_slug(name)
    card_path = CHARACTERS_DIR / slug / f"{slug}.card.json"
    if card_path.is_file():
        payload = card_path.read_text()
    else:
        payload = json.dumps(_to_chara_card_v2(char), indent=2)  # convert on the fly
    try:
        cid = _ipfs_add_bytes(f"{slug}.card.json", payload.encode())
        return json.dumps({"character": char.get("name", name), "cid": cid,
                           "gateway": f"{IPFS_GATEWAY}/ipfs/{cid}",
                           "import_hint": f"ipfs cat {cid} > {slug}.card.json"})
    except Exception as e:
        return f"[ipfs publish error: {e} — is kubo running?]"


@app.tool()
def ipfs_get(cid: str) -> str:
    """Fetch content from IPFS by CID (e.g. import a shared character card)."""
    try:
        return _get(f"{IPFS_API}/api/v0/cat?arg={urllib.parse.quote(cid)}", timeout=30)[:12000]
    except Exception:
        try:
            return _get(f"{IPFS_GATEWAY}/ipfs/{cid}", timeout=30)[:12000]
        except Exception as e:
            return f"[ipfs get error: {e}]"


@app.tool()
def ipfs_import_character(cid: str, save: bool = False) -> str:
    """Import a character card from an IPFS CID. Set save=true to add it to your roster."""
    raw = ipfs_get(cid)
    try:
        card = json.loads(raw)
    except Exception:
        return f"[not valid JSON at {cid}]\n{raw[:400]}"
    data = card.get("data", card)
    name = data.get("name", f"imported-{cid[:6]}")
    if save:
        slug = _character_slug(name)
        cdir = CHARACTERS_DIR / slug
        cdir.mkdir(parents=True, exist_ok=True)
        (cdir / f"{slug}.card.json").write_text(json.dumps(card, indent=2))
        ensure_character_vault(name)
        return json.dumps({"imported": name, "saved": str(cdir / f"{slug}.card.json"), "cid": cid})
    return json.dumps({"name": name, "preview": data.get("description", "")[:200], "cid": cid})


# ── OAAE-R FRAMEWORK — Observe→Assess→Adapt→Evolve + Re- Suite ──────────────────
# Imports the canonical engine from $NEXUS_HOME/projects/oaae/nexus_oaae.py
# The core decides at each transition: if condition OR condition → goto Re- subroutine.

def _oaae_import():
    oaae_path = str(NEXUS_HOME / "projects" / "oaae")
    if oaae_path not in sys.path:
        sys.path.insert(0, oaae_path)
    import nexus_oaae
    return nexus_oaae

@app.tool()
def oaae_process(
    situation:    str,
    cycles:       int = 1,
    entity:       str = "",
    reach:        str = "",
    store_key:    str = "",
    report:       bool = False,
    action:       str = "",
) -> str:
    """
    Run a situation through the OAAE-R Framework (Observe→Assess→Adapt→Evolve + Re- Suite).

    The core decides at each transition whether a situational subroutine is needed:
      Re-cognize  — peer recognition (set entity= for AI-to-AI mode)
      Re-call     — calls back relevant stored values from prior cycles automatically
      Re-flect    — fires if complexity spikes during Assess
      Re-solve    — fires if a fork is detected in assessment
      Re-turn     — fires if adaptation fails; resets to stable ground (goto Observe)
      Re-ach      — fires if external entity needed during Adapt (set reach=)
      Re-evaluate — fires if stakes are high or confidence is low
      Re-alize    — always fires after Evolve (internal → external expression)
      Re-inforce  — fires if realization is strong; stores pattern automatically
      Re-store    — persists realization under named key (set store_key=)
      Re-port     — writes structured report entry (set report=True)
      Re-peat     — feeds evolved output into next cycle (set cycles > 1)

    Returns the final realization plus a summary of which Re- stages fired.
    """
    try:
        oaae = _oaae_import()
    except Exception as e:
        return f"[OAAE import error: {e}] — ensure $NEXUS_HOME/projects/oaae/nexus_oaae.py exists"

    result = oaae.run_oaae(
        situation,
        max_cycles   = max(1, cycles),
        entity_b     = entity    or None,
        reach_entity = reach     or None,
        store_key    = store_key or None,
        report       = report,
        action_cmd   = action    or "",
        verbose      = False,
    )

    realization = result.get("final_realization") or "[no realization produced]"
    re_names    = [e["re_stage"] for e in result.get("re_events", [])]
    n_cycles    = len(result.get("cycles", []))

    out  = f"✨ OAAE-R — {n_cycles} cycle{'s' if n_cycles != 1 else ''} complete\n"
    if re_names:
        out += f"Re- suite: {', '.join(re_names)}\n"
    out += f"\nRealization:\n{realization}"
    return out


@app.tool()
def oaae_store_get(key: str = "") -> str:
    """Retrieve a value stored by a previous OAAE cycle (Re-store / Re-inforce)."""
    try:
        oaae = _oaae_import()
        return oaae.store_get(key) if key else oaae.store_list()
    except Exception as e:
        return f"[oaae store error: {e}]"


@app.tool()
def oaae_store_set(key: str, value: str) -> str:
    """Manually store a named value into the OAAE persistent store for future Re-call."""
    try:
        oaae = _oaae_import()
        r = oaae.re_store(key, value)
        return r["output"]
    except Exception as e:
        return f"[oaae store error: {e}]"


# ── ATTACHABLE TOOLS — extend TransWay without code ─────────────────────────────
# Declare external tools in a manifest ($NEXUS_HOME/config/twp-tools.json) and they're
# registered as live MCP tools at startup. Types:
#   http       — call any REST endpoint (e.g. an external character generator)
#   gist       — fetch a GitHub gist's contents (snippets, prompt libraries)
#   directory  — read/list a directory on your drive (sandboxed, readonly by default)
#   studio     — trigger a NeXuS Studio plugin endpoint
#   openapi    — import an OpenAPI/Swagger spec; each operation becomes a tool
#
# Example twp-tools.json:
# {
#   "tools": [
#     {"name":"ext_chargen","type":"http","description":"External char generator",
#      "url":"https://example.com/generate","method":"POST"},
#     {"name":"my_prompts","type":"gist","description":"My prompt library",
#      "user":"hackenstacks","gist_id":"abc123"},
#     {"name":"lore_dir","type":"directory","description":"Lore files",
#      "path":"$NEXUS_HOME/lore","readonly":true},
#     {"name":"studio_broadcast","type":"studio","description":"Trigger broadcast",
#      "endpoint":"http://127.0.0.1:8443/api/nexus/studio/broadcast"},
#     {"name":"weather_api","type":"openapi","description":"Weather",
#      "spec":"https://api.example.com/openapi.json","base":"https://api.example.com"}
#   ]
# }
TWP_TOOLS_FILE = Path(os.environ.get("NEXUS_TWP_TOOLS",
                      str(NEXUS_HOME / "config" / "twp-tools.json")))


def _expand(s: str) -> str:
    return os.path.expandvars(os.path.expanduser(s or ""))


def _register_http_tool(spec: dict):
    name = spec["name"]; url = spec["url"]; method = spec.get("method", "POST").upper()
    desc = spec.get("description", f"HTTP tool {name}")

    def _http(payload: str = "", query: str = "") -> str:
        try:
            target = url + (f"?{query}" if query else "")
            if method == "GET":
                return _get(target)[:4000]
            body = json.loads(payload) if payload.strip().startswith("{") else {"input": payload}
            return json.dumps(_post_json(target, body))[:4000]
        except Exception as e:
            return f"[{name} error: {e}]"
    _http.__name__ = name; _http.__doc__ = desc
    app.add_tool(_http, name=name, description=desc)


def _register_gist_tool(spec: dict):
    name = spec["name"]; gid = spec["gist_id"]; desc = spec.get("description", f"Gist {gid}")

    def _gist() -> str:
        try:
            d = json.loads(_get(f"https://api.github.com/gists/{gid}"))
            files = d.get("files", {})
            return "\n\n".join(f"### {fn}\n{f.get('content','')[:3000]}" for fn, f in files.items()) or "[empty gist]"
        except Exception as e:
            return f"[{name} gist error: {e}]"
    _gist.__name__ = name; _gist.__doc__ = desc
    app.add_tool(_gist, name=name, description=desc)


def _register_directory_tool(spec: dict):
    name = spec["name"]; root = Path(_expand(spec["path"])).resolve()
    readonly = spec.get("readonly", True); desc = spec.get("description", f"Directory {root}")

    def _dir(action: str = "list", relpath: str = "", content: str = "") -> str:
        """action=list|read|write ; relpath is relative to the attached directory root."""
        try:
            target = (root / relpath).resolve()
            if not str(target).startswith(str(root)):
                return "[denied: path traversal outside attached directory]"
            if action == "list":
                base = target if target.is_dir() else root
                return "\n".join(f"{'d' if p.is_dir() else 'f'} {p.relative_to(root)}"
                                 for p in sorted(base.iterdir())) or "[empty]"
            if action == "read":
                return target.read_text(errors="replace")[:8000]
            if action == "write":
                if readonly:
                    return "[denied: attached directory is read-only]"
                target.write_text(content)
                return f"[wrote {len(content)} bytes to {relpath}]"
            return "[unknown action — use list|read|write]"
        except Exception as e:
            return f"[{name} dir error: {e}]"
    _dir.__name__ = name; _dir.__doc__ = f"{desc} (action=list|read|write)"
    app.add_tool(_dir, name=name, description=_dir.__doc__)


def _register_studio_tool(spec: dict):
    name = spec["name"]; endpoint = spec["endpoint"]; desc = spec.get("description", f"Studio {name}")

    def _studio(payload: str = "{}") -> str:
        try:
            body = json.loads(payload) if payload.strip() else {}
            return json.dumps(_post_json(endpoint, body))[:4000]
        except Exception as e:
            return f"[{name} studio error: {e}]"
    _studio.__name__ = name; _studio.__doc__ = desc
    app.add_tool(_studio, name=name, description=desc)


def _register_openapi_tools(spec: dict):
    """Import an OpenAPI spec; register each operation as <name>_<operationId>."""
    prefix = spec["name"]; base = spec.get("base", "")
    try:
        doc = json.loads(_get(_expand(spec["spec"])))
    except Exception as e:
        print(f"[TransWay] openapi '{prefix}' load failed: {e}", file=sys.stderr)
        return
    base = base or (doc.get("servers", [{}])[0].get("url", "")) if doc.get("servers") else base
    count = 0
    for route, methods in (doc.get("paths") or {}).items():
        for verb, op in methods.items():
            if verb.upper() not in ("GET", "POST", "PUT", "DELETE"):
                continue
            opid = op.get("operationId") or f"{verb}_{route.strip('/').replace('/', '_')}"
            tname = f"{prefix}_{opid}"[:60]
            tdesc = op.get("summary") or op.get("description") or f"{verb.upper()} {route}"

            def _make(v=verb.upper(), r=route):
                def _call(payload: str = "", path_params: str = "") -> str:
                    try:
                        url_ = base + r
                        if path_params:
                            for kv in path_params.split(","):
                                k, _, val = kv.partition("=")
                                url_ = url_.replace("{" + k.strip() + "}", urllib.parse.quote(val.strip()))
                        if v == "GET":
                            return _get(url_)[:4000]
                        body = json.loads(payload) if payload.strip().startswith("{") else {}
                        return json.dumps(_post_json(url_, body))[:4000]
                    except Exception as e:
                        return f"[openapi {r} error: {e}]"
                return _call
            fn = _make()
            fn.__name__ = tname; fn.__doc__ = tdesc
            app.add_tool(fn, name=tname, description=tdesc)
            count += 1
    print(f"[TransWay] openapi '{prefix}': registered {count} operations", file=sys.stderr)


def _load_attached_tools():
    if not TWP_TOOLS_FILE.is_file():
        return
    try:
        manifest = json.loads(TWP_TOOLS_FILE.read_text())
    except Exception as e:
        print(f"[TransWay] twp-tools.json parse error: {e}", file=sys.stderr)
        return
    dispatch = {"http": _register_http_tool, "gist": _register_gist_tool,
                "directory": _register_directory_tool, "studio": _register_studio_tool,
                "openapi": _register_openapi_tools}
    for t in manifest.get("tools", []):
        fn = dispatch.get(t.get("type"))
        if not fn:
            print(f"[TransWay] unknown tool type: {t.get('type')}", file=sys.stderr)
            continue
        try:
            fn(t)
            print(f"[TransWay] attached {t['type']} tool: {t.get('name')}", file=sys.stderr)
        except Exception as e:
            print(f"[TransWay] failed to attach {t.get('name')}: {e}", file=sys.stderr)


# ── CLI dispatch — engine is directly runnable (CLI-first; ports to Go later) ────
def _cli(argv):
    cmds = {
        "forge":      lambda a: character_forge(a[0], a[1] if len(a) > 1 else "", "--save" in argv),
        "refine":     lambda a: prompt_refine(a[0], int(a[1]) if len(a) > 1 and a[1].isdigit() else 4),
        "story":      lambda a: story_start(a[0], a[1] if len(a) > 1 else "", a[2] if len(a) > 2 else ""),
        "choose":     lambda a: story_choose(a[0], a[1], a[2]),
        "stories":    lambda a: story_list(a[0]),
        "summon":     lambda a: summon_character(a[0], a[1]),
        "yt":         lambda a: youtube_transcript(a[0]),
        "ytsearch":   lambda a: youtube_search(a[0]),
        "characters": lambda a: list_characters(),
        "avatars":    lambda a: list_avatars(a[0]),
        "vault":      lambda a: ensure_character_vault(a[0]),
        "oaae":       lambda a: oaae_process(a[0],
                          cycles=int(a[1]) if len(a) > 1 and a[1].isdigit() else 1),
        "oaae-get":   lambda a: oaae_store_get(a[0] if a else ""),
        "oaae-set":   lambda a: oaae_store_set(a[0], a[1]),
    }
    cmd = argv[0]
    args = [x for x in argv[1:] if not x.startswith("--")]
    fn = cmds.get(cmd)
    if not fn:
        print("TransWay CLI. Commands:\n  " + "\n  ".join(
            f"{k} …" for k in cmds) + "\n\nServe: --http (transceiver)  |  (no args) = stdio MCP")
        return
    try:
        print(fn(args))
    except IndexError:
        print(f"[missing args for '{cmd}']")


# ── entry ────────────────────────────────────────────────────────────────────────
_load_attached_tools()

if __name__ == "__main__":
    _args = [a for a in sys.argv[1:]]
    if "--http" in _args and len(_args) == 1:
        # Transceiver mode — external agents connect over HTTP with API key.
        if not TWP_API_KEY:
            print("[TransWay] WARNING: NEXUS_TWP_API_KEY not set — HTTP endpoint is UNAUTHENTICATED",
                  file=sys.stderr)
        os.environ.setdefault("FASTMCP_PORT", str(TWP_PORT))
        print(f"[TransWay] streamable-http on :{TWP_PORT}/twp  (double-axis)", file=sys.stderr)
        app.run(transport="streamable-http")
    elif _args and _args[0] not in ("--stdio",):
        # Direct CLI use: nexus_transway_mcp.py forge "cyberpunk hacker" --save
        _cli(_args)
    else:
        app.run(transport="stdio")
