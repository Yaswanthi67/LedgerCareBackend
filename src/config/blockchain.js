import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let deployedAddresses = {};
try {
  const localConfigPath = path.join(__dirname, 'deployed-addresses.json');
  const parentBlockchainPath = path.join(__dirname, '../../../LedgerCareBlockchain/deployed-addresses.json');
  if (fs.existsSync(localConfigPath)) {
    deployedAddresses = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  } else if (fs.existsSync(parentBlockchainPath)) {
    deployedAddresses = JSON.parse(fs.readFileSync(parentBlockchainPath, 'utf8'));
  }
} catch (_) {}

export const CHAIN_ID = Number(process.env.CHAIN_ID || 43113);
export const RPC_URL = process.env.FUJI_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
export const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.PRIVATE_KEY;

export const CONTRACT_ADDRESSES = {
  CharityRegistry: process.env.CHARITY_REGISTRY_ADDRESS || deployedAddresses.CharityRegistry || '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
  CampaignManager: process.env.CAMPAIGN_MANAGER_ADDRESS || deployedAddresses.CampaignManager || '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
  DonationLedger: process.env.DONATION_LEDGER_ADDRESS || deployedAddresses.DonationLedger || '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
  FundEvidenceTracker: process.env.FUND_EVIDENCE_TRACKER_ADDRESS || deployedAddresses.FundEvidenceTracker || '0x59b670e9fA9D0A427751Af201D676719a970857b',
};

export const CHARITY_REGISTRY_ABI = [
  'function addValidRegistrationCredential(bytes32 credentialHash) external',
  'function registerCharity(string memory organizationName, string memory registrationNumber, string memory email) external',
  'function getCharity(uint256 charityId) external view returns (tuple(uint256 charityId, string organizationName, string registrationNumber, string email, address walletAddress, bool verified, uint256 registeredAt))',
  'function isCharityVerified(uint256 charityId) external view returns (bool)',
  'function getCharityIdByWallet(address wallet) external view returns (uint256)',
  'function getCredentialHash(string memory organizationName, string memory registrationNumber, string memory email, address wallet) public pure returns (bytes32)',
  'function isCredentialValid(bytes32 credentialHash) external view returns (bool)',
  'function charities(uint256) external view returns (uint256 charityId, string organizationName, string registrationNumber, string email, address walletAddress, bool verified, uint256 registeredAt)',
  'function walletToCharityId(address) external view returns (uint256)',
  'event RegistrationCredentialAdded(bytes32 indexed credentialHash)',
  'event CharityRegistered(uint256 indexed charityId, string organizationName, address indexed walletAddress, uint256 timestamp)',
  'event CharityVerificationUpdated(uint256 indexed charityId, bool verified, uint256 timestamp)',
];

export const CAMPAIGN_MANAGER_ABI = [
  'function createCampaign(string memory title, string memory description, uint256 targetAmount, uint256 startDate, uint256 endDate) external returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (tuple(uint256 campaignId, uint256 charityId, address charityWallet, string title, string description, uint256 targetAmount, uint256 raisedAmount, uint256 withdrawnAmount, uint256 startDate, uint256 endDate, uint8 status))',
  'function getCampaignForDonation(uint256 campaignId) external view returns (uint256 targetAmount, uint256 raisedAmount, uint256 startDate, uint256 endDate, uint8 status)',
  'function getCampaignForWithdrawal(uint256 campaignId) external view returns (address charityWallet, uint256 raisedAmount, uint256 withdrawnAmount, uint8 status)',
  'function getCharityCampaigns(address charityWallet) external view returns (uint256[] memory)',
  'function completeCampaign(uint256 campaignId) external',
  'function cancelCampaign(uint256 campaignId) external',
  'function recordDonation(uint256 campaignId, uint256 amount) external',
  'function recordWithdrawal(uint256 campaignId, uint256 amount) external',
  'function setDonationLedger(address _donationLedger) external',
  'function donationLedger() external view returns (address)',
  'function charityRegistry() external view returns (address)',
  'function campaigns(uint256) external view returns (uint256 campaignId, uint256 charityId, address charityWallet, string title, string description, uint256 targetAmount, uint256 raisedAmount, uint256 withdrawnAmount, uint256 startDate, uint256 endDate, uint8 status)',
  'event CampaignCreated(uint256 indexed campaignId, uint256 indexed charityId, address indexed charityWallet, string title, uint256 targetAmount, uint256 startDate, uint256 endDate)',
  'event CampaignStatusUpdated(uint256 indexed campaignId, uint8 status)',
  'event RaisedAmountUpdated(uint256 indexed campaignId, uint256 amount, uint256 totalRaised)',
  'event FundsWithdrawn(uint256 indexed campaignId, address indexed charityWallet, uint256 amount, uint256 timestamp)',
];

export const DONATION_LEDGER_ABI = [
  'function recordDonation(uint256 campaignId, uint256 amountInPaise, string memory donationReference) external returns (uint256)',
  'function donate(uint256 campaignId) external payable',
  'function withdrawFunds(uint256 campaignId, uint256 amount) external',
  'function getDonationById(uint256 donationId) external view returns (tuple(uint256 donationId, uint256 campaignId, address donor, uint256 amountInPaise, string donationReference, uint256 timestamp))',
  'function getDonation(uint256 donationId) external view returns (tuple(uint256 donationId, uint256 campaignId, address donor, uint256 amountInPaise, string donationReference, uint256 timestamp))',
  'function getDonationsByDonor(address donor) external view returns (uint256[] memory)',
  'function getDonationsByCampaign(uint256 campaignId) external view returns (uint256[] memory)',
  'function getCampaignDonationTotal(uint256 campaignId) external view returns (uint256)',
  'function getBalance() external view returns (uint256)',
  'function usedReferences(string) external view returns (bool)',
  'function campaignManager() external view returns (address)',
  'event DonationRecorded(uint256 indexed donationId, uint256 indexed campaignId, address indexed donor, uint256 amountInPaise, string donationReference, uint256 timestamp)',
  'event FundsWithdrawn(uint256 indexed campaignId, address indexed charityWallet, uint256 amount, uint256 timestamp)',
];

export const FUND_EVIDENCE_TRACKER_ABI = [
  'function registerEvidence(uint256 campaignId, string memory ipfsCid, bytes32 sha256Hash) external returns (uint256)',
  'function getEvidenceRecord(uint256 evidenceId) external view returns (tuple(uint256 evidenceId, uint256 campaignId, address charityWallet, string ipfsCid, bytes32 sha256Hash, uint256 timestamp))',
  'function getCampaignEvidenceList(uint256 campaignId) external view returns (uint256[] memory)',
  'event EvidenceRegistered(uint256 indexed evidenceId, uint256 indexed campaignId, address indexed charityWallet, string ipfsCid, bytes32 sha256Hash, uint256 timestamp)',
  'function recordFundUsage(uint256 campaignId, uint256 amount, string memory purpose, bytes32 evidenceHash) external',
  'function getFundUsage(uint256 usageId) external view returns (tuple(uint256 usageId, uint256 campaignId, address charityWallet, uint256 amount, string purpose, bytes32 evidenceHash, uint256 timestamp))',
  'function getCampaignFundUsages(uint256 campaignId) external view returns (uint256[] memory)',
  'function getEvidenceHash(uint256 usageId) external view returns (bytes32)',
  'event FundUsageRecorded(uint256 indexed usageId, uint256 indexed campaignId, address indexed charityWallet, uint256 amount, string purpose, bytes32 evidenceHash, uint256 timestamp)',
];

export const provider = new ethers.JsonRpcProvider(RPC_URL);

export const getBackendSigner = () => {
  if (!PRIVATE_KEY) {
    throw new Error('BLOCKCHAIN_PRIVATE_KEY is not configured in backend environment.');
  }
  return new ethers.Wallet(PRIVATE_KEY, provider);
};

export const getContractWithSigner = (name) => {
  const signer = getBackendSigner();
  const address = CONTRACT_ADDRESSES[name];
  if (!address) throw new Error(`Unknown contract: ${name}`);

  let abi;
  switch (name) {
    case 'CharityRegistry': abi = CHARITY_REGISTRY_ABI; break;
    case 'CampaignManager': abi = CAMPAIGN_MANAGER_ABI; break;
    case 'DonationLedger': abi = DONATION_LEDGER_ABI; break;
    case 'FundEvidenceTracker': abi = FUND_EVIDENCE_TRACKER_ABI; break;
    default: throw new Error(`ABI not found for ${name}`);
  }

  return new ethers.Contract(address, abi, signer);
};

export const getReadOnlyContract = (name) => {
  const address = CONTRACT_ADDRESSES[name];
  if (!address) throw new Error(`Unknown contract: ${name}`);

  let abi;
  switch (name) {
    case 'CharityRegistry': abi = CHARITY_REGISTRY_ABI; break;
    case 'CampaignManager': abi = CAMPAIGN_MANAGER_ABI; break;
    case 'DonationLedger': abi = DONATION_LEDGER_ABI; break;
    case 'FundEvidenceTracker': abi = FUND_EVIDENCE_TRACKER_ABI; break;
    default: throw new Error(`ABI not found for ${name}`);
  }

  return new ethers.Contract(address, abi, provider);
};
