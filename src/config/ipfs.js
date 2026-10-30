import dotenv from 'dotenv';
dotenv.config();

export const PINATA_API_KEY = process.env.PINATA_API_KEY || process.env.IPFS_API_KEY;
export const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY || process.env.IPFS_API_SECRET;
export const PINATA_JWT = process.env.PINATA_JWT || process.env.IPFS_JWT;
export const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

export const hasIpfsCredentials = () => {
  return Boolean(PINATA_JWT || (PINATA_API_KEY && PINATA_SECRET_API_KEY));
};
