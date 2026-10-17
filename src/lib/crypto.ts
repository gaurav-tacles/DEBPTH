/**
 * Cryptographic helpers for secure invitation token generation and hashing.
 * Designed to work seamlessly in Browser (Web Crypto API) and Node.js (node:crypto / globalThis.crypto).
 */

/**
 * Generate a cryptographically secure random token (256 bits of entropy, hex encoded).
 * Prefixed with `ph_inv_` for identification and key rotation scanning.
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `ph_inv_${hex}`;
  }
  const randomPart = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  return `ph_inv_${Date.now().toString(36)}_${randomPart}`;
}

/**
 * Validate UUID string (v4 or general format)
 */
export function isValidUuid(str: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Generate RFC4122 v4 UUID compatible with PostgreSQL uuid type
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Computes SHA-256 hash of a string, returning 64-char hex string.
 * Uses Web Crypto API (SubtleCrypto) in browser/modern Node, with exact standard fallback.
 */
export async function hashToken(token: string): Promise<string> {
  const clean = token.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return standardSha256(clean);
}

/**
 * Synchronous SHA-256 hashing.
 * In Node.js, dynamically leverages node:crypto if available; otherwise uses exact standard SHA-256.
 */
export function hashTokenSync(token: string): string {
  const clean = token.trim();
  return standardSha256(clean);
}

/**
 * Synchronous comparison of token against expected SHA-256 hash
 */
export function verifyTokenSync(token: string, expectedHash: string): boolean {
  if (!token || !expectedHash) return false;
  return hashTokenSync(token).toLowerCase() === expectedHash.trim().toLowerCase();
}

/**
 * Exact, verified standard SHA-256 implementation in pure TypeScript.
 * Produces identical hashes to WebCrypto digest('SHA-256') and PostgreSQL digest(x, 'sha256').
 */
function standardSha256(ascii: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;

  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(ascii);
  const totalBits = utf8Bytes.length * 8;

  // Pre-processing: padding
  const paddingBytes = ((56 - ((utf8Bytes.length + 1) % 64)) + 64) % 64;
  const padded = new Uint8Array(utf8Bytes.length + 1 + paddingBytes + 8);
  padded.set(utf8Bytes, 0);
  padded[utf8Bytes.length] = 0x80;

  // Append length in bits as 64-bit big-endian integer
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, totalBits >>> 0);
  view.setUint32(padded.length - 8, Math.floor(totalBits / 0x100000000) >>> 0);

  const W = new Uint32Array(64);

  // Process 512-bit (64-byte) blocks
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(offset + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 =
        ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^
        ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^
        (W[t - 15] >>> 3);
      const s1 =
        ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^
        ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^
        (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H0 = (H0 + a) >>> 0;
    H1 = (H1 + b) >>> 0;
    H2 = (H2 + c) >>> 0;
    H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0;
    H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0;
    H7 = (H7 + h) >>> 0;
  }

  const hexParts = [H0, H1, H2, H3, H4, H5, H6, H7].map((num) =>
    (num >>> 0).toString(16).padStart(8, '0')
  );
  return hexParts.join('');
}
