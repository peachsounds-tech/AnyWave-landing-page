/**
 * Generate an Ed25519 entitlement signing keypair.
 *
 * The worker signs entitlement tokens with the private key (kept only as the
 * Cloudflare secret ENTITLEMENT_SIGNING_KEY); the desktop app verifies them
 * with the public key compiled into LicenseConfig.h. The private half must
 * never enter the repo or the binary.
 *
 * Usage:
 *   node scripts/gen_signing_key.mjs
 *
 * Then, to install the private key as the worker secret (the printed base64
 * PKCS8 is read from a file so the value never lands in shell history):
 *   printf '%s' '<PRIVATE_PKCS8_BASE64>' > /tmp/ent_key && \
 *     npx wrangler secret put ENTITLEMENT_SIGNING_KEY < /tmp/ent_key && \
 *     rm -f /tmp/ent_key
 *
 * and paste the printed C array into Source/Licensing/LicenseConfig.h.
 */

const KEY_ID = process.argv[2] || 'e1';

const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const hex = (bytes) => Buffer.from(bytes).toString('hex');

const cArray = (bytes) => {
    const lines = [];
    for (let i = 0; i < bytes.length; i += 12) {
        const chunk = [...bytes.slice(i, i + 12)].map(b => '0x' + b.toString(16).padStart(2, '0'));
        lines.push('    ' + chunk.join(', ') + ',');
    }
    return lines.join('\n');
};

console.log(`key_id: ${KEY_ID}`);
console.log(`public_key_len: ${rawPub.length}`);
console.log('');
console.log('# ── Cloudflare secret (private, base64 PKCS8) ──────────────────────────');
console.log('# Set with:  npx wrangler secret put ENTITLEMENT_SIGNING_KEY');
console.log(`ENTITLEMENT_SIGNING_KEY=${b64(pkcs8)}`);
console.log('');
console.log('# ── Client public key (paste into LicenseConfig.h) ─────────────────────');
console.log(`// key id "${KEY_ID}", raw Ed25519 public key (${rawPub.length} bytes)`);
console.log(`#define ENTITLEMENT_KEY_ID "${KEY_ID}"`);
console.log('static const unsigned char ENTITLEMENT_PUBLIC_KEY[32] = {');
console.log(cArray(rawPub));
console.log('};');
console.log('');
console.log(`# public_key_hex: ${hex(rawPub)}`);
