#!/usr/bin/env python3
"""
nexus_wallet.py — the NeXuS asset wallet (CLI-first; a fancy widget for the terminal).

A sovereign wallet for character assets: contracts, child keys ("cards"), and the ledger.
Two design pillars:

  • FLEXIBLE NAMESPACE — the user creates as many TLDs and as many nested subdirs as they
    want. Assets can live ANYWHERE in the tree. There is no fixed schema.
      → this is deliberate: a non-uniform, user-defined layout is HARDER TO TRIANGULATE.
        No predictable paths to correlate; the wallet discovers assets by walking the tree.

  • SIGNED + TERMED — every asset carries its contract terms (royalty, +%/sale, expiry).
    Verification uses nexus_crypto (creator co-factor + child-key + revocation).

Layout (all under $NEXUS_WALLET, default $NEXUS_VAULT/wallet):
    <WALLET>/<your-TLD>/<any>/<nesting>/<asset>.contract.json | .card.json | .char.json
    <WALLET>/ledger.jsonl        append-only statements (searchable)
    <WALLET>/revoked.json        revoked child-key serials

NO HARDCODED paths — env-first.
"""

import os
import sys
import json
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import nexus_crypto as nc

WALLET = Path(os.environ.get("NEXUS_WALLET",
              os.path.join(os.environ.get("NEXUS_VAULT", str(Path.home() / "NeXuS" / "vault")), "wallet")))
LEDGER = WALLET / "ledger.jsonl"
REVOKED = WALLET / "revoked.json"

C = {"cy": "\033[36m", "gn": "\033[32m", "yl": "\033[33m", "rd": "\033[31m",
     "mg": "\033[35m", "dim": "\033[2m", "b": "\033[1m", "n": "\033[0m"}


def _ensure():
    WALLET.mkdir(parents=True, exist_ok=True)
    if not REVOKED.is_file():
        REVOKED.write_text("[]")


# ── namespace (flexible TLDs + arbitrary subdirs) ───────────────────────────────
def mkpath(rel: str) -> Path:
    """Create an arbitrary TLD/subdir path inside the wallet. rel = 'crypto/personas/dark'."""
    _ensure()
    p = (WALLET / rel).resolve()
    if not str(p).startswith(str(WALLET.resolve())):
        raise ValueError("path escapes wallet")
    p.mkdir(parents=True, exist_ok=True)
    return p


def tld_of(rel: str) -> str:
    """The governing TLD (first path segment) of any wallet-relative path."""
    return Path(rel).parts[0] if Path(rel).parts else rel


# ── TLD terms + per-TLD chain (each TLD is a personal blockchain that mints tokens) ──
import hashlib as _hl


def set_tld_terms(tld: str, master_key: bytes, *, royalty_bps: int = 500,
                  price_escalation_bps: int = 0, description: str = "",
                  transferable: bool = True, max_supply: int = 0, access: str = "perpetual",
                  recoup_target_credits: int = 0, flat_credits_per_sale: int = 0,
                  royalty_bps_after: int | None = None) -> dict:
    """Publish a TLD's terms BEFORE any minting. Signed by the creator master key.
    A buyer reads these terms before making a deal. Supports scarcity (max_supply),
    access policy, and phased/vesting royalty. Returns the signed policy."""
    d = mkpath(tld)
    priv = nc.master_signing_key(master_key)
    policy = {
        "spec": "nexus-tld-terms-v1",
        "tld": tld,
        "creator_pubkey": nc._pub_hex(priv),
        "royalty_bps": int(royalty_bps),
        "royalty_bps_after": int(royalty_bps if royalty_bps_after is None else royalty_bps_after),
        "recoup_target_credits": int(recoup_target_credits),
        "flat_credits_per_sale": int(flat_credits_per_sale),
        "price_escalation_bps": int(price_escalation_bps),
        "max_supply": int(max_supply),
        "access": access,
        "transferable": bool(transferable),
        "description": description,
        "established": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    signed = {"terms": policy, "signature": nc.sign_bytes(priv, nc._canonical(policy))}
    (d / ".tld.json").write_text(json.dumps(signed, indent=2))
    _chain_append(tld, "establish", {"royalty_bps": royalty_bps,
                                     "price_escalation_bps": price_escalation_bps})
    return signed


def get_tld_terms(tld: str) -> dict | None:
    """Read a TLD's published terms (what a buyer inspects before a deal)."""
    fp = WALLET / tld / ".tld.json"
    if not fp.is_file():
        return None
    return json.loads(fp.read_text())


def _chain_path(tld: str) -> Path:
    return WALLET / tld / ".chain.jsonl"


def _chain_head(tld: str) -> str:
    cp = _chain_path(tld)
    if not cp.is_file():
        return "0" * 64
    last = cp.read_text().splitlines()[-1] if cp.read_text().strip() else ""
    return json.loads(last)["hash"] if last else "0" * 64


def _chain_append(tld: str, event: str, data: dict) -> str:
    """Append a hash-linked block to this TLD's personal chain. Returns the new block hash."""
    mkpath(tld)
    prev = _chain_head(tld)
    block = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "event": event, "prev": prev, **data}
    block["hash"] = _hl.sha256((prev + nc._canonical(block).decode()).encode()).hexdigest()
    with _chain_path(tld).open("a") as f:
        f.write(json.dumps(block) + "\n")
    return block["hash"]


def verify_chain(tld: str) -> dict:
    """Validate the TLD chain is unbroken (each block links to the prior hash)."""
    cp = _chain_path(tld)
    if not cp.is_file():
        return {"valid": True, "blocks": 0}
    prev = "0" * 64
    n = 0
    for line in cp.read_text().splitlines():
        b = json.loads(line)
        if b["prev"] != prev:
            return {"valid": False, "broken_at": n}
        recomputed = _hl.sha256((b["prev"] + nc._canonical({k: v for k, v in b.items() if k != "hash"}).decode()).encode()).hexdigest()
        if recomputed != b["hash"]:
            return {"valid": False, "tampered_at": n}
        prev = b["hash"]; n += 1
    return {"valid": True, "blocks": n, "head": prev}


def minted_count(tld: str, contract_id: str) -> int:
    """How many child keys have been minted under a contract (counts chain 'mint' blocks)."""
    cp = _chain_path(tld)
    if not cp.is_file():
        return 0
    n = 0
    for line in cp.read_text().splitlines():
        b = json.loads(line)
        if b.get("event") == "mint" and b.get("contract_id") == contract_id:
            n += 1
    return n


def mint_edition(tld: str, master_key: bytes, contract: dict, count: int) -> list:
    """Mint an edition of `count` numbered child keys under an existing contract, respecting
    max_supply. Each key is a one-of-N copy (e.g. 100 books). Returns the minted cards."""
    t = contract["terms"]
    cap = t.get("max_supply", 0)
    already = minted_count(tld, t["contract_id"])
    if cap and already + count > cap:
        raise ValueError(f"supply cap {cap} exceeded: {already} minted, requested {count}")
    cards = []
    for i in range(count):
        serial = f"{t['character_id'][:6].upper()}-{already + i + 1:04d}/{cap or '∞'}"
        card = nc.mint_child_key(master_key, contract, serial=serial)
        _chain_append(tld, "mint", {"character_id": t["character_id"], "serial": serial,
                                    "contract_id": t["contract_id"], "edition": f"{already+i+1}/{cap}"})
        cards.append(card)
    return cards


def mint_token(tld: str, master_key: bytes, character_id: str, serial: str = "",
               ttl_seconds: int | None = None) -> dict:
    """Mint a single token under a TLD's terms. REQUIRES TLD terms first + respects max_supply.
    Records the mint on the TLD's personal chain. Returns the signed child card."""
    terms = get_tld_terms(tld)
    if not terms:
        raise ValueError(f"TLD '{tld}' has no terms — set_tld_terms() before minting")
    t = terms["terms"]
    contract = nc.forge_contract(master_key, character_id,
                                 royalty_bps=t["royalty_bps"],
                                 price_escalation_bps=t["price_escalation_bps"],
                                 transferable=t["transferable"],
                                 max_supply=t.get("max_supply", 0),
                                 access=t.get("access", "perpetual"),
                                 recoup_target_credits=t.get("recoup_target_credits", 0),
                                 flat_credits_per_sale=t.get("flat_credits_per_sale", 0),
                                 royalty_bps_after=t.get("royalty_bps_after"))
    cap = t.get("max_supply", 0)
    if cap and minted_count(tld, contract["terms"]["contract_id"]) >= cap:
        raise ValueError(f"supply cap {cap} reached for {character_id}")
    card = nc.mint_child_key(master_key, contract, serial=serial, ttl_seconds=ttl_seconds)
    _chain_append(tld, "mint", {"character_id": character_id,
                                "serial": card["grant"]["serial"],
                                "contract_id": contract["terms"]["contract_id"]})
    return {"contract": contract, "card": card, "tld": tld}


def deposit(rel_dir: str, name: str, obj: dict, kind: str = "asset") -> str:
    """Place a signed asset anywhere in the tree. Contracts/cards REQUIRE their TLD to have
    published terms first (mint-guard). kind → suffix (contract|card|char|asset)."""
    if kind in ("contract", "card", "char") and not get_tld_terms(tld_of(rel_dir)):
        raise ValueError(f"TLD '{tld_of(rel_dir)}' has no terms — set_tld_terms() before minting into it")
    d = mkpath(rel_dir)
    suffix = {"contract": ".contract.json", "card": ".card.json",
              "char": ".char.json"}.get(kind, ".asset.json")
    fp = d / f"{name}{suffix}"
    fp.write_text(json.dumps(obj, indent=2))
    _log("deposit", {"path": str(fp.relative_to(WALLET)), "kind": kind, "name": name})
    return str(fp.relative_to(WALLET))


def walk_assets():
    """Discover every asset by WALKING the tree (no assumed layout → anti-triangulation)."""
    _ensure()
    for p in WALLET.rglob("*.json"):
        if p.name in ("revoked.json",) or p.suffix == ".jsonl":
            continue
        try:
            yield p, json.loads(p.read_text())
        except Exception:
            continue


# ── ledger ───────────────────────────────────────────────────────────────────────
def _log(event: str, data: dict):
    _ensure()
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **data}
    with LEDGER.open("a") as f:
        f.write(json.dumps(rec) + "\n")


def ledger_search(query: str = "") -> list:
    if not LEDGER.is_file():
        return []
    out = []
    for line in LEDGER.read_text().splitlines():
        if not query or query.lower() in line.lower():
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


def revoked_serials() -> list:
    _ensure()
    try:
        return json.loads(REVOKED.read_text())
    except Exception:
        return []


def revoke(serial: str):
    r = set(revoked_serials()); r.add(serial)
    REVOKED.write_text(json.dumps(sorted(r)))
    _log("revoke", {"serial": serial})


# ── the fancy widget: render an asset as a wallet card ──────────────────────────
def render_card(terms: dict, status: str = "", serial: str = "") -> str:
    W = 46
    cid = terms.get("contract_id", terms.get("character_id", "—"))[:18]
    name = terms.get("character_id", "asset")[:22]
    roy = terms.get("royalty_bps", 0) / 100
    esc = terms.get("price_escalation_bps", 0) / 100
    creator = (terms.get("creator_pubkey", "") or "")[:20]
    st = status or "ACTIVE"
    stc = C["gn"] if st == "ACTIVE" else (C["rd"] if st in ("REVOKED", "EXPIRED") else C["yl"])
    def row(s): return f"{C['cy']}│{C['n']} {s:<{W-2}}{C['cy']}│{C['n']}"
    top = f"{C['cy']}╭{'─'*W}╮{C['n']}"
    bot = f"{C['cy']}╰{'─'*W}╯{C['n']}"
    lines = [top,
             row(f"{C['b']}{C['mg']}⬢ NeXuS ASSET{C['n']}{C['dim']}  {cid}{C['n']}"),
             row(f"{C['b']}{name}{C['n']}"),
             row(""),
             row(f"royalty  {C['gn']}{roy:>5.2f}%{C['n']}    escalation {C['gn']}+{esc:.2f}%/sale{C['n']}"),
             row(f"serial   {serial or '—':<14} status {stc}{st}{C['n']}"),
             row(f"{C['dim']}creator  {creator}…{C['n']}"),
             bot]
    return "\n".join(lines)


def render_tree() -> str:
    _ensure()
    out = [f"{C['b']}{C['cy']}WALLET{C['n']} {C['dim']}{WALLET}{C['n']}"]
    tlds = sorted([d for d in WALLET.iterdir() if d.is_dir()])
    for d in tlds:
        assets = list(d.rglob("*.json"))
        out.append(f"  {C['mg']}▸ {d.name}{C['n']} {C['dim']}({len(assets)} assets){C['n']}")
        for a in sorted(assets)[:20]:
            out.append(f"      {C['dim']}{a.relative_to(d)}{C['n']}")
    if not tlds:
        out.append(f"  {C['dim']}(no TLDs yet — create one: nexus_wallet.py mkdir <tld>/<sub>){C['n']}")
    return "\n".join(out)


# ── CLI ───────────────────────────────────────────────────────────────────────────
def _demo():
    """Seed a demo wallet: publish TLD terms → mint tokens under them → show chain + widget."""
    mk = nc.derive_master_key("demo-pass", b"demo-salt-000000")

    # 1. Publish TLD terms FIRST (a buyer reads these before any deal)
    set_tld_terms("crypto", mk, royalty_bps=500, price_escalation_bps=500,
                  description="Sovereign personas — 5% royalty, +5%/sale")
    set_tld_terms("art", mk, royalty_bps=800, price_escalation_bps=250,
                  description="Dark deck art — 8% royalty, +2.5%/sale")

    # 2. Mint tokens UNDER the TLD terms (guard enforces terms-first)
    t1 = mint_token("crypto", mk, "aime", serial="CARD-7788")
    t2 = mint_token("art", mk, "shadowvault", serial="ART-0001")
    deposit("crypto/personas", "aime", t1["contract"], "contract")
    deposit("crypto/personas/issued", "aime-card-7788", t1["card"], "card")
    deposit("art/dark-deck/tier1", "shadowvault", t2["contract"], "contract")

    # 3. Guard proof — minting into a termless TLD is refused
    try:
        deposit("wildwest/loot", "x", {"foo": 1}, "contract")
        guard = "FAILED (should have blocked)"
    except ValueError:
        guard = "blocked ✓ (no terms → no mint)"

    # 4. Record a sale
    _chain_append("crypto", "sale", {"character": "aime", "price": 105.00, "royalty_paid": 5.25})

    print(render_tree()); print()
    print(render_card(t1["contract"]["terms"], "ACTIVE", "CARD-7788")); print()
    print(render_card(t2["contract"]["terms"], "ACTIVE", "ART-0001"))
    print(f"\n{C['b']}TLD 'crypto' — personal chain:{C['n']}  {C['dim']}(verify: {verify_chain('crypto')}){C['n']}")
    for line in (_chain_path("crypto").read_text().splitlines()):
        b = json.loads(line)
        print(f"  {C['dim']}{b['hash'][:10]}{C['n']} {C['cy']}{b['event']:<9}{C['n']} "
              f"{json.dumps({k:v for k,v in b.items() if k not in ('ts','event','prev','hash')})}")
    print(f"\n{C['b']}Mint-guard on termless TLD:{C['n']} {C['gn']}{guard}{C['n']}")


def record_impression(tld: str, contract: dict, listener: str = "") -> dict:
    """Log a verified ad impression (ABI). Routes the sponsor's per-impression credits to the
    creator, recorded on the TLD chain. Returns the accrual."""
    abi = contract["terms"].get("abi") or {}
    credits = int(abi.get("credits_per_impression", 0))
    _chain_append(tld, "impression", {"contract_id": contract["terms"]["contract_id"],
                                      "sponsor": abi.get("sponsor", ""), "credits": credits,
                                      "payout_to": contract["terms"]["creator_pubkey"][:16],
                                      "listener": listener})
    return {"sponsor": abi.get("sponsor"), "credits": credits}


def credits_balance(tld: str) -> int:
    """Sum credits accrued to the creator on a TLD chain (impressions + sale royalties)."""
    cp = _chain_path(tld)
    if not cp.is_file():
        return 0
    bal = 0
    for line in cp.read_text().splitlines():
        b = json.loads(line)
        bal += int(b.get("credits", 0)) + int(b.get("royalty_paid", 0))
    return bal


def _song_demo():
    """Free song with ABI (Ads Built In) + counterfeit detection."""
    mk = nc.derive_master_key("artist-pass", b"artist-salt-0000")
    set_tld_terms("my-music", mk, royalty_bps=0, price_escalation_bps=0,
                  description="Free single, sponsor-funded (ABI)")
    contract = nc.forge_contract(mk, "my-song", royalty_bps=0,
                                 abi={"sponsor": "Sony", "credits_per_impression": 2,
                                      "payout_to": nc._pub_hex(nc.master_signing_key(mk))},
                                 artifact_paths=[__file__])
    print(f"{C['b']}{C['cy']}HUMAN-READABLE TERMS:{C['n']}")
    print(nc.describe_terms(contract)); print()

    # authenticity: the real signed asset vs a counterfeit copy
    auth = nc.verify_authentic(contract, [__file__])
    print(f"{C['b']}Original:{C['n']} {C['gn']}{auth['verdict']}{C['n']} (sig={auth['signature_ok']}, content={auth['content_ok']})")
    fake = {"terms": {**contract["terms"], "royalty_bps": 9999}, "signature": contract["signature"]}
    fauth = nc.verify_authentic(fake, [__file__])
    print(f"{C['b']}Tampered copy:{C['n']} {C['rd']}{fauth['verdict']}{C['n']} — {fauth['reason']} {C['dim']}(worthless: no ABI payout){C['n']}\n")

    # ad impressions accrue credits to the creator
    print(f"{C['b']}ABI impressions (Sony ads, 2 credits each):{C['n']}")
    for i in range(1, 6):
        record_impression("my-music", contract, listener=f"user{i}")
    print(f"  5 ad listens → creator balance: {C['gn']}{credits_balance('my-music')} credits{C['n']}")
    print(f"  {C['dim']}(free song, sponsor pays, counterfeits earn nothing){C['n']}")


def _book_demo():
    """The book scenario: 100 copies max, one-time access, phased/vesting royalty."""
    mk = nc.derive_master_key("author-pass", b"author-salt-0000")
    # Publish TLD terms: 100 copies, one-time access, +10%/sale, 10%→5% after 100 credits recouped
    set_tld_terms("my-books", mk, royalty_bps=1000, royalty_bps_after=500,
                  price_escalation_bps=1000, max_supply=100, access="one-time",
                  recoup_target_credits=100, flat_credits_per_sale=100,
                  description="My novel — limited 100-copy sovereign edition")
    terms = get_tld_terms("my-books")["terms"]
    contract = nc.forge_contract(mk, "my-novel",
                                 royalty_bps=terms["royalty_bps"],
                                 royalty_bps_after=terms["royalty_bps_after"],
                                 price_escalation_bps=terms["price_escalation_bps"],
                                 max_supply=terms["max_supply"], access=terms["access"],
                                 recoup_target_credits=terms["recoup_target_credits"],
                                 flat_credits_per_sale=terms["flat_credits_per_sale"])
    print(f"{C['b']}{C['cy']}HUMAN-READABLE TERMS (what a buyer reads):{C['n']}")
    print(nc.describe_terms(contract)); print()

    # Mint the edition of 100 one-time keys
    cards = mint_edition("my-books", mk, contract, 100)
    for i, card in enumerate(cards[:3]):
        deposit(f"my-books/copies/{card['grant']['serial'].replace('/','-')}",
                f"copy-{i+1}", card, "card")
    print(f"{C['gn']}Minted {len(cards)} copies.{C['n']} e.g. serials: "
          f"{', '.join(c['grant']['serial'] for c in cards[:3])} …")

    # Try to mint #101 — must be refused
    try:
        mint_edition("my-books", mk, contract, 1)
        cap = "FAILED (should block)"
    except ValueError as e:
        cap = f"blocked ✓ ({e})"
    print(f"{C['b']}Supply cap:{C['n']} {C['gn']}{cap}{C['n']}\n")

    # Phased royalty across sales
    print(f"{C['b']}Vesting royalty across resales:{C['n']}")
    recouped = 0
    for sale in range(1, 4):
        r = nc.royalty_for_sale(contract, recouped)
        recouped += r["flat_credits"]
        print(f"  sale {sale}: phase={r['phase']:<10} royalty={r['royalty_bps']/100:.1f}%  "
              f"flat={r['flat_credits']} credits  (recouped→{recouped})")
    r = nc.royalty_for_sale(contract, 100)
    print(f"  after recoup: phase={r['phase']:<10} royalty={r['royalty_bps']/100:.1f}% "
          f"{C['dim']}(5% perpetual to future owners){C['n']}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "demo":
        _demo()
    elif a[0] == "book":
        _book_demo()
    elif a[0] == "song":
        _song_demo()
    elif a[0] == "mkdir" and len(a) > 1:
        print("created:", mkpath(a[1]))
    elif a[0] == "tree":
        print(render_tree())
    elif a[0] == "ledger":
        for r in ledger_search(a[1] if len(a) > 1 else ""):
            print(json.dumps(r))
    elif a[0] == "revoke" and len(a) > 1:
        revoke(a[1]); print("revoked:", a[1])
    else:
        print("usage: nexus_wallet.py demo | mkdir <tld/sub> | tree | ledger [query] | revoke <serial>")
