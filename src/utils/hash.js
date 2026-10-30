import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * Computes deterministic SHA-256 hash of a file buffer.
 * Returns lowercase 64-character hex string.
 * @param {Buffer | Uint8Array} buffer
 * @returns {string} SHA-256 hex string (64 characters)
 */
export const computeBufferSha256 = (buffer) => {
  if (!buffer) throw new Error('Cannot hash empty or null buffer');
  return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
};

/**
 * Computes deterministic SHA-256 hash of a string.
 * Returns lowercase 64-character hex string.
 * @param {string} str
 * @returns {string} SHA-256 hex string (64 characters)
 */
export const computeStringSha256 = (str) => {
  if (typeof str !== 'string') throw new Error('Expected string input');
  return crypto.createHash('sha256').update(str, 'utf-8').digest('hex').toLowerCase();
};

/**
 * Converts SHA-256 hex string into Solidity bytes32 hex representation (0x prefixed).
 * @param {string} sha256Hex
 * @returns {string} 0x-prefixed bytes32 hex string
 */
export const toBytes32Hex = (sha256Hex) => {
  const clean = sha256Hex.replace(/^0x/, '').toLowerCase();
  return `0x${clean.padStart(64, '0')}`;
};

/**
 * Computes deterministic Keccak-256 hash of a file buffer or Uint8Array.
 * Matches Solidity keccak256() exactly.
 * @param {Buffer | Uint8Array} buffer
 * @returns {string} bytes32 hex string starting with 0x
 */
export const computeBufferKeccak256 = (buffer) => {
  if (!buffer) throw new Error('Cannot hash empty or null buffer');
  const uint8 = new Uint8Array(buffer);
  return ethers.keccak256(uint8);
};

/**
 * Computes charity credential hash
 * keccak256(abi.encode(organizationName, registrationNumber, email, wallet))
 */
export const computeCredentialHash = (orgName, regNo, email, wallet) => {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['string', 'string', 'string', 'address'],
    [orgName.trim(), regNo.trim(), email.trim(), wallet.trim()]
  );
  return ethers.keccak256(encoded);
};
