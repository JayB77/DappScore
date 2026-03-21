#!/usr/bin/env node
/**
 * Builds a CRX3-format Chrome extension file.
 * CRX3 spec: https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx3.proto
 *
 * Format:
 *   magic (4 bytes)  "Cr24"
 *   version (4 bytes) 3 (little-endian)
 *   header_size (4 bytes) little-endian
 *   header (protobuf CrxFileHeader)
 *   zip contents
 *
 * We hand-encode the protobuf since it's small / no dependency needed.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const zipPath = path.join(__dirname, '..', 'dappscore-extension-v1.0.0.zip');
const outPath = path.join(__dirname, '..', 'dappscore-extension-v1.0.0.crx');

const zipData = fs.readFileSync(zipPath);

// Generate RSA-2048 key pair (ephemeral — for dev/beta use)
const { privateKey: privDer, publicKey: pubDer } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});

// Sign the zip data with SHA-256/RSA
const sign = crypto.createSign('SHA256');
sign.update(zipData);
const signature = sign.sign({ key: privDer, dsaEncoding: 'ieee-p1363', format: 'der', type: 'pkcs8' });

// --- Minimal protobuf encoding ---
function varint(n) {
  const out = [];
  while (n > 127) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return Buffer.from(out);
}
function ldelim(fieldNum, buf) {
  return Buffer.concat([varint((fieldNum << 3) | 2), varint(buf.length), buf]);
}

// AsymmetricKeyProof { public_key (field 1), signature (field 2) }
const asymProof = Buffer.concat([
  ldelim(1, pubDer),
  ldelim(2, signature),
]);

// CrxFileHeader { sha256_with_rsa (field 2), signed_header_data (field 10) }
// signed_header_data is a SignedData protobuf { crx_id (field 1) }
// crx_id = first 16 bytes of SHA-256 of the DER public key
const crxId = crypto.createHash('sha256').update(pubDer).digest().slice(0, 16);
const signedHeaderData = ldelim(1, crxId);
const header = Buffer.concat([
  ldelim(2,  asymProof),
  ldelim(10, signedHeaderData),
]);

// CRX3 file layout
const magic      = Buffer.from('Cr24');
const version    = Buffer.alloc(4); version.writeUInt32LE(3);
const headerSize = Buffer.alloc(4); headerSize.writeUInt32LE(header.length);

const crx = Buffer.concat([magic, version, headerSize, header, zipData]);
fs.writeFileSync(outPath, crx);
console.log(`CRX written to ${outPath} (${crx.length} bytes)`);
