#!/usr/bin/env python3
"""
nexus_crypto.py — the NeXuS uniform crypto spine (web ⇄ python ⇄ go).

Three layers, one standard:

  1. SYMMETRIC ENCRYPTION (password IS the key — no key files)
       NXSV1|<b64 salt>|<b64 iv>|<b64 ct+tag>   ← password-derived (vault/master files)
       NXSK1|<b64 iv>|<b64 ct+tag>              ← raw-key (character/chat; key DERIVED from master)
       KDF: PBKDF2-HMAC-SHA256, 210000 iters, 16B salt → 256-bit key
       AEAD: AES-256-GCM, 12B iv, tag appended (Web Crypto convention)
       ↳ byte-identical to services/cryptoService.ts (encryptString/decryptString)

  2. KEY HIERARCHY (never locked out)
       master_key      = PBKDF2(master_password, user_salt)          32 bytes, the root
       character_key   = HKDF-SHA256(master_key, "nexus-character:"+slug)   deterministic
       ↳ any character key is RE-DERIVABLE from the master forever → user can always decrypt.

  3. PROVENANCE + ROYALTY (the NFT spine)
       Ed25519 master signing key (seed = HKDF(master_key, "nexus-sign"))
       CHARACTER LICENSE = signed manifest with royalty terms BAKED IN:
         { character_id, creator_pubkey, royalty_bps, transfer_terms, content_hash, issued }
       The signature IS the residual claim — it travels with the character on every handoff.

Deps: `cryptography` (in ~/.venv/nexus-mcp). NO HARDCODED paths.
"""

import os
import sys
import json
import base64
import hashlib
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

PBKDF2_ITERS = 210000
_SHA = hashes.SHA256()


def _b64e(b: bytes) -> str: return base64.b64encode(b).decode()
def _b64d(s: str) -> bytes: return base64.b64decode(s)


# ── layer 1: symmetric ──────────────────────────────────────────────────────────
def _derive_key(password: str, salt: bytes) -> bytes:
    return PBKDF2HMAC(algorithm=_SHA, length=32, salt=salt, iterations=PBKDF2_ITERS).derive(
        password.encode())


def encrypt_string(plaintext: str, password: str) -> str:
    """Password-derived AES-256-GCM → NXSV1 token (matches cryptoService.ts encryptString)."""
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = _derive_key(password, salt)
    ct = AESGCM(key).encrypt(iv, plaintext.encode(), None)  # ct includes 16B tag
    return "|".join(["NXSV1", _b64e(salt), _b64e(iv), _b64e(ct)])


def decrypt_string(token: str, password: str) -> str:
    parts = token.split("|")
    if len(parts) != 4 or parts[0] != "NXSV1":
        raise ValueError("Not an NXSV1 token")
    _, salt_b64, iv_b64, ct_b64 = parts
    key = _derive_key(password, _b64d(salt_b64))
    return AESGCM(key).decrypt(_b64d(iv_b64), _b64d(ct_b64), None).decode()


def encrypt_with_key(plaintext: str, key: bytes) -> str:
    """Raw 32-byte-key AES-256-GCM → NXSK1 token (for derived character/chat keys)."""
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, plaintext.encode(), None)
    return "|".join(["NXSK1", _b64e(iv), _b64e(ct)])


def decrypt_with_key(token: str, key: bytes) -> str:
    parts = token.split("|")
    if len(parts) != 3 or parts[0] != "NXSK1":
        raise ValueError("Not an NXSK1 token")
    _, iv_b64, ct_b64 = parts
    return AESGCM(key).decrypt(_b64d(iv_b64), _b64d(ct_b64), None).decode()


def is_encrypted(s: str) -> bool:
    return isinstance(s, str) and (s.startswith("NXSV1|") or s.startswith("NXSK1|"))


# ── layer 2: key hierarchy ──────────────────────────────────────────────────────
def derive_master_key(master_password: str, user_salt: bytes) -> bytes:
    """The root secret. Keep user_salt stable per user (store it, it's not secret)."""
    return _derive_key(master_password, user_salt)


def _hkdf(master_key: bytes, info: str, length: int = 32) -> bytes:
    return HKDF(algorithm=_SHA, length=length, salt=None, info=info.encode()).derive(master_key)


def derive_character_key(master_key: bytes, slug: str) -> bytes:
    """Deterministic per-character key. Re-derivable forever → user never locked out."""
    return _hkdf(master_key, "nexus-character:" + slug)


# ── layer 3: provenance + royalty (NFT spine) ───────────────────────────────────
def master_signing_key(master_key: bytes) -> Ed25519PrivateKey:
    """Ed25519 signing key deterministically derived from the master (aligns with Argus)."""
    seed = _hkdf(master_key, "nexus-sign", 32)
    return Ed25519PrivateKey.from_private_bytes(seed)


def _pub_hex(priv: Ed25519PrivateKey) -> str:
    return priv.public_key().public_bytes_raw().hex()


def sign_bytes(priv: Ed25519PrivateKey, data: bytes) -> str:
    return _b64e(priv.sign(data))


def verify_bytes(pub_hex: str, data: bytes, sig_b64: str) -> bool:
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub_hex)).verify(_b64d(sig_b64), data)
        return True
    except Exception:
        return False


def _canonical(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()


def content_hash(paths: list[str]) -> str:
    """SHA-256 over the character's signed artifact set (order-independent)."""
    h = hashlib.sha256()
    for p in sorted(paths):
        fp = Path(os.path.expanduser(os.path.expandvars(p)))
        if fp.is_file():
            h.update(fp.name.encode())
            h.update(fp.read_bytes())
    return h.hexdigest()


def mint_license(master_key: bytes, character_id: str, royalty_bps: int,
                 transfer_terms: str, artifact_paths: list[str], issued: str = "") -> dict:
    """
    Mint a CHARACTER LICENSE with royalty terms BAKED IN, signed by the creator's master key.
    royalty_bps: residual in basis points (e.g. 500 = 5% to creator on every transfer).
    The signature is the residual claim — carry this with the character (the 'NFT') on transfer.
    """
    priv = master_signing_key(master_key)
    claims = {
        "spec": "nexus-character-license-v1",
        "character_id": character_id,
        "creator_pubkey": _pub_hex(priv),
        "royalty_bps": int(royalty_bps),
        "transfer_terms": transfer_terms,
        "content_hash": content_hash(artifact_paths),
        "issued": issued or __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
    }
    sig = sign_bytes(priv, _canonical(claims))
    return {"claims": claims, "signature": sig}


def verify_license(license_obj: dict, artifact_paths: list[str] | None = None) -> dict:
    """Verify signature + (optionally) that artifacts still match the baked content_hash."""
    claims = license_obj.get("claims", {})
    sig = license_obj.get("signature", "")
    ok_sig = verify_bytes(claims.get("creator_pubkey", ""), _canonical(claims), sig)
    ok_content = True
    if artifact_paths is not None:
        ok_content = (content_hash(artifact_paths) == claims.get("content_hash"))
    return {"valid": ok_sig and ok_content, "signature_ok": ok_sig,
            "content_ok": ok_content, "creator": claims.get("creator_pubkey"),
            "royalty_bps": claims.get("royalty_bps")}


# ── layer 4: contracts + child keys (the credit-card model) ─────────────────────
# Master key = the card that never expires (creator's co-factor, baked into the contract).
# Contract = forged once, immutable terms. Child keys = one-time expiring cards, all carry
# the same terms, revocable per-serial without touching siblings. Unlock needs BOTH a valid
# child key AND the creator co-factor (creator pubkey verifies + content key is master-derived).
import time as _t
import hmac as _hmac
import struct as _struct


def forge_contract(master_key: bytes, character_id: str, *, royalty_bps: int = 500,
                   price_escalation_bps: int = 0, transferable: bool = True,
                   child_ttl_seconds: int = 86400, artifact_paths: list[str] | None = None,
                   max_supply: int = 0, access: str = "perpetual",
                   recoup_target_credits: int = 0, flat_credits_per_sale: int = 0,
                   royalty_bps_after: int | None = None, abi: dict | None = None,
                   extra_terms: dict | None = None) -> dict:
    """Forge an IMMUTABLE contract. Signed by the creator master key.
    max_supply: hard cap on child keys ever minted (0 = unlimited).
    access: 'one-time' (each child unlocks one item once) | 'perpetual'.
    price_escalation_bps: e.g. 1000 = +10% price per sale.
    Phased/vesting royalty: royalty_bps applies until recoup_target_credits is routed back,
      then royalty drops to royalty_bps_after. flat_credits_per_sale routed back during recoupment.
    Once forged the terms are locked — only child-key revocation is mutable afterward."""
    priv = master_signing_key(master_key)
    terms = {
        "spec": "nexus-contract-v1",
        "character_id": character_id,
        "creator_pubkey": _pub_hex(priv),                 # the co-factor / never-expiring card
        "royalty_bps": int(royalty_bps),
        "royalty_bps_after": int(royalty_bps if royalty_bps_after is None else royalty_bps_after),
        "recoup_target_credits": int(recoup_target_credits),
        "flat_credits_per_sale": int(flat_credits_per_sale),
        "price_escalation_bps": int(price_escalation_bps),
        "max_supply": int(max_supply),
        "access": access,
        "transferable": bool(transferable),
        "child_ttl_seconds": int(child_ttl_seconds),
        # ABI — Ads Built In. Free content, sponsor-funded, pays creator per ad impression.
        "abi": abi or {},   # {"sponsor":"Sony","credits_per_impression":2,"payout_to":<pubkey>}
        "content_hash": content_hash(artifact_paths or []),
        "forged": _t.strftime("%Y-%m-%dT%H:%M:%SZ", _t.gmtime()),
        "extra_terms": extra_terms or {},
    }
    cid = hashlib.sha256(_canonical(terms)).hexdigest()[:16]
    terms["contract_id"] = cid
    return {"terms": terms, "signature": sign_bytes(priv, _canonical(terms))}


def royalty_for_sale(contract: dict, cumulative_recouped: int) -> dict:
    """Phased royalty: during recoupment charge royalty_bps + flat credits; once the target is
    routed back, drop to royalty_bps_after (residual to future owners). Returns this sale's terms."""
    t = contract["terms"]
    target = t.get("recoup_target_credits", 0)
    recouped = cumulative_recouped >= target if target else True
    if recouped:
        return {"phase": "residual", "royalty_bps": t.get("royalty_bps_after", t["royalty_bps"]),
                "flat_credits": 0}
    return {"phase": "recoupment", "royalty_bps": t["royalty_bps"],
            "flat_credits": t.get("flat_credits_per_sale", 0),
            "remaining_to_recoup": max(0, target - cumulative_recouped)}


def describe_terms(contract: dict) -> str:
    """Plain-English rendering of a contract's terms — what a human buyer reads before a deal."""
    t = contract["terms"]
    L = [f"“{t['character_id']}” — sovereign license"]
    if t.get("max_supply"):
        L.append(f"• Supply: only {t['max_supply']} copies will EVER exist (hard cap).")
    else:
        L.append("• Supply: unlimited.")
    L.append(f"• Access: {'one-time unlock per key' if t.get('access')=='one-time' else 'perpetual'}.")
    if t.get("price_escalation_bps"):
        L.append(f"• Price rises {t['price_escalation_bps']/100:.1f}% on every resale.")
    if t.get("recoup_target_credits"):
        L.append(f"• Royalty {t['royalty_bps']/100:.1f}% + {t.get('flat_credits_per_sale',0)} "
                 f"credits/sale routed to creator until {t['recoup_target_credits']} credits recouped,")
        L.append(f"  then royalty drops to {t.get('royalty_bps_after')/100:.1f}% for all future owners.")
    else:
        L.append(f"• Royalty: {t['royalty_bps']/100:.1f}% to creator on every sale, perpetual.")
    abi = t.get("abi") or {}
    if abi:
        L.append(f"• FREE — Ads Built In: {abi.get('sponsor','sponsor')} sponsors; creator earns "
                 f"{abi.get('credits_per_impression',0)} credits per ad listen.")
    L.append(f"• Transferable: {'yes' if t.get('transferable') else 'no'}.")
    L.append(f"• Signed by creator {t['creator_pubkey'][:16]}… (contract {t['contract_id']}).")
    return "\n".join(L)


def verify_authentic(contract: dict, artifact_paths: list[str]) -> dict:
    """Real vs COUNTERFEIT. Authentic iff the creator's signature over the terms verifies AND
    the current artifacts still hash to the baked content_hash. A copy without a valid signature,
    or with altered content, is a counterfeit — easy to spot, and worthless (can't route ABI)."""
    t = contract.get("terms", {})
    sig_ok = verify_bytes(t.get("creator_pubkey", ""), _canonical(t), contract.get("signature", ""))
    content_ok = (content_hash(artifact_paths) == t.get("content_hash"))
    authentic = sig_ok and content_ok
    return {"authentic": authentic,
            "verdict": "AUTHENTIC" if authentic else "COUNTERFEIT",
            "signature_ok": sig_ok, "content_ok": content_ok,
            "reason": "" if authentic else ("bad/absent creator signature" if not sig_ok
                                            else "content altered (hash mismatch)")}


def mint_child_key(master_key: bytes, contract: dict, serial: str = "",
                   ttl_seconds: int | None = None) -> dict:
    """Mint a one-time, EXPIRING child key bound to a contract. Only the creator (master) can
    mint. Carries the contract's immutable terms by reference (contract_id + content_hash)."""
    priv = master_signing_key(master_key)
    terms = contract["terms"]
    serial = serial or os.urandom(8).hex()
    ttl = ttl_seconds if ttl_seconds is not None else terms.get("child_ttl_seconds", 86400)
    grant = {
        "spec": "nexus-childkey-v1",
        "contract_id": terms["contract_id"],
        "character_id": terms["character_id"],
        "creator_pubkey": terms["creator_pubkey"],
        "content_hash": terms["content_hash"],
        "serial": serial,
        "issued_at": int(_t.time()),
        "expires_at": int(_t.time()) + int(ttl),
    }
    return {"grant": grant, "signature": sign_bytes(priv, _canonical(grant))}


def verify_child_key(child: dict, contract: dict, revoked_serials: list[str] | None = None) -> dict:
    """A child key unlocks only if: signed by the creator (co-factor), not expired,
    serial not revoked, and it references this exact contract. Siblings are independent."""
    grant = child.get("grant", {})
    terms = contract.get("terms", {})
    creator = terms.get("creator_pubkey", "")
    now = int(_t.time())
    sig_ok = verify_bytes(creator, _canonical(grant), child.get("signature", ""))
    contract_sig_ok = verify_bytes(creator, _canonical(terms), contract.get("signature", ""))
    bound = (grant.get("contract_id") == terms.get("contract_id")
             and grant.get("creator_pubkey") == creator)
    not_expired = now < grant.get("expires_at", 0)
    not_revoked = grant.get("serial") not in set(revoked_serials or [])
    valid = all([sig_ok, contract_sig_ok, bound, not_expired, not_revoked])
    return {"valid": valid, "signature_ok": sig_ok, "contract_ok": contract_sig_ok,
            "bound": bound, "not_expired": not_expired, "not_revoked": not_revoked,
            "expires_in_s": max(0, grant.get("expires_at", 0) - now),
            "royalty_bps": terms.get("royalty_bps"),
            "price_escalation_bps": terms.get("price_escalation_bps")}


def next_sale_price(contract: dict, current_price: float) -> float:
    """Apply the contract's immutable price-escalation clause for the next transfer."""
    bps = contract.get("terms", {}).get("price_escalation_bps", 0)
    return round(current_price * (1 + bps / 10000.0), 8)


def totp(master_key: bytes, character_id: str, period: int = 30, digits: int = 6) -> str:
    """TPM/TOTP-style rotating code — only the creator's secret can produce it (RFC6238-ish)."""
    secret = _hkdf(master_key, "nexus-totp:" + character_id, 20)
    counter = int(_t.time() // period)
    mac = _hmac.new(secret, _struct.pack(">Q", counter), hashlib.sha1).digest()
    off = mac[-1] & 0x0F
    code = (_struct.unpack(">I", mac[off:off + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


# ── self-test / CLI ──────────────────────────────────────────────────────────────
def _selftest():
    pw = "correct horse battery staple"
    tok = encrypt_string("hello nexus", pw)
    assert decrypt_string(tok, pw) == "hello nexus", "NXSV1 roundtrip"
    salt = os.urandom(16)
    mk = derive_master_key(pw, salt)
    assert derive_master_key(pw, salt) == mk, "master key deterministic"
    ck = derive_character_key(mk, "a-i-m-e")
    assert derive_character_key(mk, "a-i-m-e") == ck, "character key deterministic (never locked out)"
    ktok = encrypt_with_key("secret chat", ck)
    assert decrypt_with_key(ktok, ck) == "secret chat", "NXSK1 roundtrip"
    lic = mint_license(mk, "aime", 500, "5% residual to creator on every transfer", [__file__])
    v = verify_license(lic, [__file__])
    assert v["valid"] and v["royalty_bps"] == 500, "license verifies with baked royalty"

    # ── contract + child-key lifecycle (the credit-card model) ──
    print("─" * 60)
    print("  CONTRACT LIFECYCLE DEMO")
    print("─" * 60)
    contract = forge_contract(mk, "aime", royalty_bps=500, price_escalation_bps=500,
                              child_ttl_seconds=3600, artifact_paths=[__file__])
    print(f"  Contract forged: id={contract['terms']['contract_id']}  "
          f"royalty=5%  escalation=+5%/sale")
    card_a = mint_child_key(mk, contract, serial="CARD-A")
    card_b = mint_child_key(mk, contract, serial="CARD-B")
    print(f"  Minted child cards: CARD-A, CARD-B (expire in "
          f"{verify_child_key(card_a, contract)['expires_in_s']}s)")

    va = verify_child_key(card_a, contract)
    vb = verify_child_key(card_b, contract)
    assert va["valid"] and vb["valid"], "both cards valid"
    print(f"  CARD-A valid: {va['valid']}   CARD-B valid: {vb['valid']}")

    # revoke ONE — sibling must survive
    revoked = ["CARD-A"]
    va2 = verify_child_key(card_a, contract, revoked)
    vb2 = verify_child_key(card_b, contract, revoked)
    assert (not va2["valid"]) and vb2["valid"], "revoke A only; B survives"
    print(f"  Revoke CARD-A → CARD-A valid: {va2['valid']}  |  CARD-B still valid: {vb2['valid']}")

    # expiry
    expired = mint_child_key(mk, contract, serial="OLD", ttl_seconds=-1)
    ve = verify_child_key(expired, contract)
    assert not ve["valid"] and not ve["not_expired"], "expired card rejected"
    print(f"  Expired card rejected: valid={ve['valid']} (not_expired={ve['not_expired']})")

    # forgery — a different master cannot mint a valid card for this contract
    other = derive_master_key("attacker", os.urandom(16))
    forged = mint_child_key(other, contract, serial="FAKE")
    vf = verify_child_key(forged, contract)
    assert not vf["valid"], "only the creator's gen can mint"
    print(f"  Attacker-minted card rejected: valid={vf['valid']}  (only creator's gen can mint)")

    # price escalation
    p0 = 100.0
    p1 = next_sale_price(contract, p0)
    p2 = next_sale_price(contract, p1)
    print(f"  Price escalation +5%/sale: ${p0:.2f} → ${p1:.2f} → ${p2:.2f}")

    # TOTP
    code = totp(mk, "aime")
    assert code == totp(mk, "aime"), "totp stable within window"
    print(f"  Creator TOTP (rotating): {code}")

    print("─" * 60)
    print("✓ all crypto self-tests passed")
    print("  NXSV1 sample:", tok[:48], "…")
    print("  license creator:", lic["claims"]["creator_pubkey"][:16], "… royalty:",
          lic["claims"]["royalty_bps"], "bps")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "selftest":
        _selftest()
    elif len(sys.argv) > 3 and sys.argv[1] == "encrypt":
        print(encrypt_string(sys.argv[2], sys.argv[3]))
    elif len(sys.argv) > 3 and sys.argv[1] == "decrypt":
        print(decrypt_string(sys.argv[2], sys.argv[3]))
    else:
        print("usage: nexus_crypto.py selftest | encrypt <text> <pw> | decrypt <token> <pw>")
