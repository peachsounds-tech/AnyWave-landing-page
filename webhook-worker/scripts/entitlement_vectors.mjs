/**
 * Cross-language entitlement test vectors.
 *
 * The single real risk in this design is that the C++ verifier and the JS
 * signer disagree about the exact bytes that get signed. A fixed vector file,
 * generated here by the *same* signing code the worker ships, and checked by the
 * C++ EntitlementToken in a CMake test, turns that risk into a build failure
 * instead of a field incident.
 *
 * Tokens are built through worker.js's exported __entitlement helpers so the
 * format can't drift from production. The keypair is fresh each run and the
 * private half is discarded; only the public key (safe to publish) is written,
 * so nothing secret lands in the repo.
 *
 * Run:
 *   node scripts/entitlement_vectors.mjs
 *
 * Writes: Source/Licensing/test/entitlement_vectors.json (path is relative to
 * the repo root, resolved from this file's location).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const workerSource = readFileSync(join(here, '..', 'worker.js'), 'utf8');
const { __entitlement: E } = await import(
    'data:text/javascript;base64,' + Buffer.from(workerSource, 'utf8').toString('base64')
);

// ─── Keys ─────────────────────────────────────────────────────────────────────
const kp      = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const wrongKp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

const pkcs8   = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
const rawPub  = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));

const env = { ENTITLEMENT_SIGNING_KEY: pkcs8 };

const hex = (bytes) => Buffer.from(bytes).toString('hex');

// ─── Fixed inputs the C++ side will assert against ─────────────────────────────
const DEVICE_ID  = 'a'.repeat(64);
const MACHINE_ID = 'b'.repeat(32);
const NONCE      = 'client-nonce-0001';
const NOW        = 1_787_000_000_000;      // fixed so `iat`/`exp` are deterministic

function proPayload(overrides = {}) {
    const p = E.entitlementBase(DEVICE_ID, MACHINE_ID, 'pro', NONCE, NOW);
    p.license = { status: 'active', ends_at: 0, email: 'a@b.co', order_id: '123', instance_id: 'inst-1' };
    return Object.assign(p, overrides);
}

// base64url decode/encode for building the tampered variant.
function b64uToBuf(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Buffer.from(s, 'base64');
}

const cases = [];

// 1. valid, in-date pro token
cases.push({
    name: 'valid_pro',
    token: await E.signEntitlement(env, proPayload()),
    expect_valid: true,
});

// 2. valid free-tier token (quota shape)
{
    const p = E.entitlementBase(DEVICE_ID, MACHINE_ID, 'free', NONCE, NOW);
    p.quota = { used: 2, limit: 5, remaining: 3, period_start: NOW, period_end: NOW + 2_592_000_000 };
    p.owned = ['c'.repeat(64), 'd'.repeat(64)];
    p.owned_truncated = false;
    cases.push({ name: 'valid_free', token: await E.signEntitlement(env, p), expect_valid: true });
}

// 3. tampered payload: signature no longer matches the bytes
{
    const good = await E.signEntitlement(env, proPayload());
    const [h, pl, sig] = good.split('.');
    const obj = JSON.parse(b64uToBuf(pl).toString('utf8'));
    obj.license.status = 'active';
    obj.tier = 'pro';
    obj.device_id = 'f'.repeat(64);          // grant themselves a different device
    const tampered = h + '.' + E.strToB64u(JSON.stringify(obj)) + '.' + sig;
    cases.push({ name: 'tampered_payload', token: tampered, expect_valid: false });
}

// 4. corrupted signature
{
    const good = await E.signEntitlement(env, proPayload());
    const parts = good.split('.');
    const sig = b64uToBuf(parts[2]);
    sig[0] ^= 0xff;                          // flip a byte
    parts[2] = E.bytesToB64u(sig);
    cases.push({ name: 'bad_signature', token: parts.join('.'), expect_valid: false });
}

// 5. expired: valid signature, exp in the past
cases.push({
    name: 'expired',
    token: await E.signEntitlement(env, proPayload({ iat: NOW - 20 * 86400000, exp: NOW - 13 * 86400000 })),
    expect_valid: false,
});

// 6. wrong nonce: token nonce differs from what the client will pass as expected
cases.push({
    name: 'wrong_nonce',
    token: await E.signEntitlement(env, proPayload({ nonce: 'server-issued-other' })),
    expect_valid: false,
});

// 7. wrong device_id vs expected
cases.push({
    name: 'wrong_device',
    token: await E.signEntitlement(env, proPayload({ device_id: 'e'.repeat(64) })),
    expect_valid: false,
});

// 8. signed by a different key. Signed directly with the wrong keypair rather
//    than via signEntitlement(wrongEnv, ...): worker.js caches the imported
//    signing key at module scope keyed to the first env it sees, so a second
//    env would be silently ignored and this token would end up signed by the
//    *good* key. (That footgun is exactly why this vector exists.)
{
    const p = proPayload();
    const header = { alg: 'EdDSA', typ: 'JWT', kid: E.ENTITLEMENT_KEY_ID };
    const signingInput = E.strToB64u(JSON.stringify(header)) + '.' + E.strToB64u(JSON.stringify(p));
    const sig = new Uint8Array(await crypto.subtle.sign(
        { name: 'Ed25519' }, wrongKp.privateKey, new TextEncoder().encode(signingInput)));
    cases.push({ name: 'wrong_key', token: signingInput + '.' + E.bytesToB64u(sig), expect_valid: false });
}

// 9. unknown kid in header — correct signature, but a key id the client can't
//    resolve, so it must refuse rather than fall back to a default key.
{
    const p = proPayload();
    const header = { alg: 'EdDSA', typ: 'JWT', kid: 'zz' };
    const signingInput = E.strToB64u(JSON.stringify(header)) + '.' + E.strToB64u(JSON.stringify(p));
    const signKey = await crypto.subtle.importKey(
        'pkcs8', Buffer.from(pkcs8, 'base64'), { name: 'Ed25519' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign(
        { name: 'Ed25519' }, signKey, new TextEncoder().encode(signingInput)));
    cases.push({ name: 'unknown_kid', token: signingInput + '.' + E.bytesToB64u(sig), expect_valid: false });
}

const out = {
    generated_at: new Date().toISOString(),
    key_id: E.ENTITLEMENT_KEY_ID,
    public_key_hex: hex(rawPub),
    expected: {
        device_id: DEVICE_ID,
        machine_id: MACHINE_ID,
        nonce: NONCE,
        now_ms: NOW,
    },
    cases,
};

const outDir  = join(repoRoot, 'Source', 'Licensing', 'test');
const outPath = join(outDir, 'entitlement_vectors.json');
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

console.log(`wrote ${cases.length} vectors → ${outPath}`);
console.log(`public_key_hex: ${out.public_key_hex}`);
