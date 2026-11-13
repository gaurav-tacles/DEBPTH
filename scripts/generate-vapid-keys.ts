/**
 * DEBPTH - VAPID Key Pair Generator & Mathematical Verifier
 * Generates standards-compliant NIST P-256 (prime256v1) ECDSA keys for Native Browser Web Push.
 * 100% Free, zero third-party recurring costs.
 * 
 * Usage:
 *   npx tsx scripts/generate-vapid-keys.ts
 */

import crypto from 'node:crypto';

export function generateVapidKeyPair() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const publicKeyBase64Url = ecdh.getPublicKey('base64url');
  const privateKeyBase64Url = ecdh.getPrivateKey('base64url');

  // Verify derivation
  const verifier = crypto.createECDH('prime256v1');
  verifier.setPrivateKey(Buffer.from(privateKeyBase64Url, 'base64url'));
  const derivedPublic = verifier.getPublicKey('base64url');

  if (publicKeyBase64Url !== derivedPublic) {
    throw new Error('Fatal: Mathematical key pair mismatch detected during generation.');
  }

  const rawPubBytes = Buffer.from(publicKeyBase64Url, 'base64url');
  if (rawPubBytes.length !== 65 || rawPubBytes[0] !== 0x04) {
    throw new Error('Fatal: Generated public key does not conform to uncompressed NIST P-256 format.');
  }

  return {
    publicKey: publicKeyBase64Url,
    privateKey: privateKeyBase64Url,
  };
}

if (process.argv[1]?.endsWith('generate-vapid-keys.ts')) {
  console.log('================================================================');
  console.log('   DEBPTH NATIVE WEB PUSH - VAPID KEY PAIR GENERATOR (RFC 8292)');
  console.log('================================================================\n');

  const keys = generateVapidKeyPair();

  console.log('Generated Cryptographically Verified NIST P-256 Key Pair:\n');
  console.log(`Public Key  (Vercel & Supabase VAPID_PUBLIC_KEY):\n${keys.publicKey}\n`);
  console.log(`Private Key (Supabase Secret VAPID_PRIVATE_KEY - KEEP SECRET):\n${keys.privateKey}\n`);
  console.log('----------------------------------------------------------------');
  console.log('Setup Commands:');
  console.log(`supabase secrets set VAPID_PUBLIC_KEY="${keys.publicKey}" VAPID_PRIVATE_KEY="${keys.privateKey}" VAPID_SUBJECT="mailto:realgauravpatel@gmail.com"`);
  console.log(`In Vercel Project Settings -> Environment Variables:`);
  console.log(`VITE_VAPID_PUBLIC_KEY = "${keys.publicKey}"`);
  console.log('================================================================\n');
}
