import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDbConnected } from '../config/db.js';
import { User } from '../models/User.js';
import { Charity } from '../models/Charity.js';
import { Campaign } from '../models/Campaign.js';
import { Donation } from '../models/Donation.js';
import { Evidence } from '../models/Evidence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'ledgercare_db.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const CHARITIES_FILE = path.join(DATA_DIR, 'charities.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EVIDENCE_FILE = path.join(DATA_DIR, 'evidence.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class DatabaseService {
  constructor() {
    this.records = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        this.records = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } else {
        this.records = [];
        this.save();
      }
    } catch (err) {
      console.warn('Failed to load DB file, initializing empty:', err);
      this.records = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.records, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save DB file:', err);
    }
  }

  // ==========================================
  // USERS
  // ==========================================
  getAllUsersLocal() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      }
    } catch {}
    return [
      {
        userId: 'usr_donor_default',
        name: 'Priya Patel',
        email: 'priya@example.com',
        walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        role: 'Donor',
      },
      {
        userId: 'usr_charity_default',
        name: 'LedgerCare Demo Charity',
        email: 'demo@ledgercare.org',
        walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        role: 'Charity',
      },
    ];
  }

  saveUsersLocal(list) {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed saving users.json:', err);
    }
  }

  async saveUser(userData) {
    const userId = userData.userId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const normalized = {
      userId,
      name: (userData.name || 'Anonymous User').trim(),
      email: (userData.email || '').trim().toLowerCase(),
      walletAddress: userData.walletAddress ? userData.walletAddress.trim().toLowerCase() : null,
      role: userData.role || 'Donor',
    };

    // Save to MongoDB if connected
    if (isDbConnected()) {
      try {
        const query = normalized.walletAddress
          ? { $or: [{ walletAddress: normalized.walletAddress }, { userId }] }
          : { userId };
        await User.findOneAndUpdate(query, normalized, { upsert: true, new: true });
      } catch (err) {
        console.warn('MongoDB User save note:', err.message);
      }
    }

    // Save to local JSON
    const list = this.getAllUsersLocal();
    const idx = list.findIndex(
      (u) =>
        u.userId === normalized.userId ||
        (normalized.walletAddress && u.walletAddress && u.walletAddress.toLowerCase() === normalized.walletAddress.toLowerCase())
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalized };
    } else {
      list.push(normalized);
    }
    this.saveUsersLocal(list);

    return normalized;
  }

  async getUserByWallet(wallet) {
    if (!wallet) return null;
    const lower = wallet.toLowerCase();

    if (isDbConnected()) {
      try {
        const doc = await User.findOne({ walletAddress: lower }).lean();
        if (doc) return doc;
      } catch {}
    }

    const list = this.getAllUsersLocal();
    return list.find((u) => u.walletAddress && u.walletAddress.toLowerCase() === lower) || null;
  }

  async getUserById(id) {
    if (!id) return null;

    if (isDbConnected()) {
      try {
        const doc = await User.findOne({ userId: id }).lean();
        if (doc) return doc;
      } catch {}
    }

    const list = this.getAllUsersLocal();
    return list.find((u) => u.userId === id || (u.walletAddress && u.walletAddress.toLowerCase() === id.toLowerCase())) || null;
  }

  async getAllUsers() {
    if (isDbConnected()) {
      try {
        const docs = await User.find().lean();
        if (docs && docs.length > 0) return docs;
      } catch {}
    }
    return this.getAllUsersLocal();
  }

  // ==========================================
  // DONATIONS & ORDERS
  // ==========================================
  async createOrder({ orderId, campaignId, amountInr, amountEth, donorName, donorEmail, donorPhone, donorWalletAddress }) {
    const existing = this.records.find((r) => r.orderId === orderId);
    if (existing) return existing;

    const newRecord = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      paymentId: null,
      signature: null,
      campaignId: Number(campaignId),
      donorName: donorName ? donorName.trim() : 'Anonymous Donor',
      donorEmail: donorEmail ? donorEmail.trim() : null,
      donorPhone: donorPhone ? donorPhone.trim() : null,
      donorWalletAddress: donorWalletAddress ? donorWalletAddress.trim().toLowerCase() : null,
      amountInr: Number(amountInr),
      donationAmountInr: Number(amountInr),
      amountEth: Number(amountEth || 0),
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING',
      blockchainStatus: 'NOT_STARTED',
      transactionHash: null,
      blockchainTransactionHash: null,
      blockchainDonationId: null,
      ipfsCid: null,
      errorMessage: null,
      createdAt: Date.now(),
      donationDate: new Date(),
      updatedAt: Date.now(),
    };

    this.records.push(newRecord);
    this.save();

    if (isDbConnected()) {
      try {
        await Donation.findOneAndUpdate(
          { donationId: orderId },
          {
            donationId: orderId,
            donorId: newRecord.donorId || null,
            donorWalletAddress: newRecord.donorWalletAddress,
            campaignId: newRecord.campaignId,
            donorName: newRecord.donorName,
            donorEmail: newRecord.donorEmail,
            donorPhone: newRecord.donorPhone,
            amountInr: newRecord.amountInr,
            donationAmountInr: newRecord.donationAmountInr,
            amountEth: newRecord.amountEth,
            paymentMethod: 'UPI',
            paymentStatus: 'PENDING',
            paymentOrderId: orderId,
            blockchainStatus: 'NOT_STARTED',
            blockchainTransactionReference: newRecord.transactionHash || null,
            blockchainTransactionHash: newRecord.transactionHash || null,
            donationTimestamp: newRecord.donationDate,
            donationDate: newRecord.donationDate,
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('MongoDB Donation create note:', err.message);
      }
    }

    return newRecord;
  }

  async updatePaymentStatus(orderId, paymentStatus, paymentId = null, signature = null) {
    const record = this.records.find((r) => r.orderId === orderId);
    if (!record) return null;

    record.paymentStatus = paymentStatus;
    if (paymentId) record.paymentId = paymentId;
    if (signature) record.signature = signature;
    record.updatedAt = Date.now();
    this.save();

    if (isDbConnected()) {
      try {
        await Donation.findOneAndUpdate(
          { $or: [{ donationId: orderId }, { paymentOrderId: orderId }] },
          { paymentStatus, paymentId }
        );
      } catch (err) {
        console.warn('MongoDB Donation update note:', err.message);
      }
    }

    return record;
  }

  async updateBlockchainStatus(orderId, { blockchainStatus, transactionHash, blockchainDonationId, errorMessage, ipfsCid }) {
    const record = this.records.find((r) => r.orderId === orderId);
    if (!record) return null;

    if (blockchainStatus !== undefined) record.blockchainStatus = blockchainStatus;
    if (transactionHash !== undefined) {
      record.transactionHash = transactionHash;
      record.blockchainTransactionHash = transactionHash;
    }
    if (blockchainDonationId !== undefined) record.blockchainDonationId = blockchainDonationId;
    if (errorMessage !== undefined) record.errorMessage = errorMessage;
    if (ipfsCid !== undefined) record.ipfsCid = ipfsCid;

    record.updatedAt = Date.now();
    this.save();

    if (isDbConnected()) {
      try {
        await Donation.findOneAndUpdate(
          { $or: [{ donationId: orderId }, { paymentOrderId: orderId }] },
          {
            blockchainStatus,
            blockchainTransactionHash: transactionHash,
            blockchainDonationId,
          }
        );
      } catch (err) {
        console.warn('MongoDB Donation blockchain update note:', err.message);
      }
    }

    return record;
  }

  getOrderByOrderId(orderId) {
    return this.records.find((r) => r.orderId === orderId) || null;
  }

  getPaymentByPaymentId(paymentId) {
    return this.records.find((r) => r.paymentId === paymentId) || null;
  }

  getRecordById(id) {
    return this.records.find((r) => r.id === id || r.orderId === id || r.paymentId === id) || null;
  }

  async getAllDonations(filter = {}) {
    if (isDbConnected()) {
      try {
        const query = {};
        if (filter.campaignId) query.campaignId = Number(filter.campaignId);
        if (filter.donorEmail) query.donorEmail = filter.donorEmail.toLowerCase();
        if (filter.paymentStatus) query.paymentStatus = filter.paymentStatus;
        if (filter.donorWalletAddress) query.donorWalletAddress = filter.donorWalletAddress.toLowerCase();

        const docs = await Donation.find(query).sort({ donationDate: -1 }).lean();
        if (docs && docs.length > 0) return docs;
      } catch {}
    }

    let list = [...this.records];
    if (filter.campaignId) {
      list = list.filter((r) => Number(r.campaignId) === Number(filter.campaignId));
    }
    if (filter.donorEmail) {
      list = list.filter((r) => r.donorEmail && r.donorEmail.toLowerCase() === filter.donorEmail.toLowerCase());
    }
    if (filter.paymentStatus) {
      list = list.filter((r) => r.paymentStatus === filter.paymentStatus);
    }
    if (filter.donorWalletAddress) {
      list = list.filter((r) => r.donorWalletAddress && r.donorWalletAddress.toLowerCase() === filter.donorWalletAddress.toLowerCase());
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  // ==========================================
  // CAMPAIGNS
  // ==========================================
  getAllCampaignsLocal() {
    try {
      if (fs.existsSync(CAMPAIGNS_FILE)) {
        return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
      }
    } catch {}
    return [];
  }

  async getAllCampaigns() {
    if (isDbConnected()) {
      try {
        const docs = await Campaign.find().sort({ campaignId: 1 }).lean();
        if (docs && docs.length > 0) return docs;
      } catch {}
    }
    return this.getAllCampaignsLocal();
  }

  async getCampaignById(id) {
    if (isDbConnected()) {
      try {
        const doc = await Campaign.findOne({ campaignId: Number(id) }).lean();
        if (doc) return doc;
      } catch {}
    }
    const list = this.getAllCampaignsLocal();
    return list.find((c) => Number(c.campaignId) === Number(id)) || null;
  }

  async saveCampaign(campaign) {
    const list = this.getAllCampaignsLocal();
    const idx = list.findIndex((c) => Number(c.campaignId) === Number(campaign.campaignId));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...campaign };
    } else {
      list.push(campaign);
    }
    try {
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed saving campaigns.json:', e);
    }

    if (isDbConnected()) {
      try {
        await Campaign.findOneAndUpdate(
          { campaignId: Number(campaign.campaignId) },
          {
            campaignId: Number(campaign.campaignId),
            charityId: Number(campaign.charityId || 1),
            charityWallet: campaign.charityWallet || '',
            charityName: campaign.charityName || 'Verified Charity',
            campaignTitle: campaign.title || campaign.campaignTitle || 'Charity Campaign',
            description: campaign.description || '',
            category: campaign.category || 'General',
            targetAmountInr: Number(campaign.targetAmountInr) || 250000,
            collectedAmountInr: Number(campaign.collectedAmountInr || campaign.amountCollectedInr || campaign.raisedAmountInr || 0),
            amountCollectedInr: Number(campaign.collectedAmountInr || campaign.amountCollectedInr || campaign.raisedAmountInr || 0),
            targetAmountEth: campaign.targetAmountEth || '1.0',
            raisedAmountEth: campaign.raisedAmountEth || '0',
            withdrawnAmountEth: campaign.withdrawnAmountEth || '0',
            campaignStatus: campaign.campaignStatus || (campaign.status === 0 ? 'Active' : 'Completed'),
            imageUrl: campaign.imageUrl || '',
            blockchainTransactionHash: campaign.transactionHash || campaign.blockchainTxHash || campaign.blockchainTransactionHash || null,
            blockchainTxHash: campaign.transactionHash || campaign.blockchainTxHash || null,
            creationTimestamp: campaign.creationTimestamp || campaign.creationDate || new Date(),
            creationDate: campaign.creationTimestamp || campaign.creationDate || new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('MongoDB Campaign save note:', err.message);
      }
    }

    return campaign;
  }

  // ==========================================
  // CHARITIES
  // ==========================================
  getAllCharitiesLocal() {
    try {
      if (fs.existsSync(CHARITIES_FILE)) {
        return JSON.parse(fs.readFileSync(CHARITIES_FILE, 'utf8'));
      }
    } catch {}
    return [];
  }

  async getAllCharities() {
    if (isDbConnected()) {
      try {
        const docs = await Charity.find().sort({ charityId: 1 }).lean();
        if (docs && docs.length > 0) return docs;
      } catch {}
    }
    return this.getAllCharitiesLocal();
  }

  async getCharityById(id) {
    if (isDbConnected()) {
      try {
        const doc = await Charity.findOne({ charityId: Number(id) }).lean();
        if (doc) return doc;
      } catch {}
    }
    const list = this.getAllCharitiesLocal();
    return list.find((c) => Number(c.charityId) === Number(id)) || null;
  }

  async saveCharity(charity) {
    const list = this.getAllCharitiesLocal();
    const charityId = charity.charityId || (list.length > 0 ? Math.max(...list.map((c) => Number(c.charityId) || 0)) + 1 : 1);
    const charityRecord = { ...charity, charityId };
    const idx = list.findIndex(
      (c) =>
        Number(c.charityId) === Number(charityId) ||
        (charity.registrationNumber && c.registrationNumber === charity.registrationNumber)
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...charityRecord };
    } else {
      list.push(charityRecord);
    }
    try {
      fs.writeFileSync(CHARITIES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed saving charities.json:', e);
    }

    if (isDbConnected()) {
      try {
        await Charity.findOneAndUpdate(
          {
            $or: [
              { charityId: Number(charityId) },
              { registrationNumber: charity.registrationNumber },
            ],
          },
          {
            charityId: Number(charityId),
            organizationName: charity.organizationName,
            registrationInformation: charity.registrationInformation || charity.registrationNumber || '',
            registrationDetails: {
              registrationNumber: charity.registrationNumber,
              email: charity.email,
              phone: charity.phone || '',
              address: charity.address || '',
            },
            registrationNumber: charity.registrationNumber,
            email: charity.email,
            walletAddress: charity.walletAddress,
            registrationHash: charity.registrationHash || charity.registrationDocumentHash || charity.credHash || '',
            registrationDocumentHash: charity.registrationDocumentHash || charity.credHash || '',
            verificationStatus: charity.verificationStatus || charity.blockchainVerificationStatus || (charity.verified ? 'VERIFIED' : 'PENDING'),
            blockchainVerificationStatus: charity.blockchainVerificationStatus || (charity.verified ? 'VERIFIED' : 'PENDING'),
            verified: Boolean(charity.verified),
            blockchainTransactionHash: charity.transactionHash || charity.blockchainTxHash || charity.blockchainTransactionHash || null,
            blockchainTxHash: charity.transactionHash || charity.blockchainTxHash || null,
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('MongoDB Charity save note:', err.message);
      }
    }

    return charityRecord;
  }

  // ==========================================
  // EVIDENCE (IPFS + SHA-256)
  // ==========================================
  getAllEvidenceLocal() {
    try {
      if (fs.existsSync(EVIDENCE_FILE)) {
        return JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8'));
      }
    } catch {}
    return [
      {
        evidenceId: 'ev_init_001',
        campaignId: 1,
        fileName: 'school_supplies_invoice.pdf',
        fileSizeBytes: 245000,
        mimeType: 'application/pdf',
        ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        originalSha256Hash: '0xd4563efb5a4e26f93de0d9e38d1226b09f0b0710c60f1c78799f981cdf5adbfa',
        calculatedSha256Hash: '0xd4563efb5a4e26f93de0d9e38d1226b09f0b0710c60f1c78799f981cdf5adbfa',
        uploadedWalletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        blockchainTransactionHash: '0x3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef012',
        blockchainUsageId: 1,
        purpose: 'Purchase of educational supplies and textbooks',
        amountInr: 50000,
        amountEth: '0.2',
        verificationStatus: 'VERIFIED',
        uploadTimestamp: new Date(),
      },
    ];
  }

  async getAllEvidence(filter = {}) {
    if (isDbConnected()) {
      try {
        const query = {};
        if (filter.campaignId) query.campaignId = Number(filter.campaignId);
        if (filter.uploadedWalletAddress) query.uploadedWalletAddress = filter.uploadedWalletAddress.toLowerCase();
        if (filter.verificationStatus) query.verificationStatus = filter.verificationStatus;

        const docs = await Evidence.find(query).sort({ uploadTimestamp: -1 }).lean();
        if (docs && docs.length > 0) return docs;
      } catch {}
    }

    let list = this.getAllEvidenceLocal();
    if (filter.campaignId) {
      list = list.filter((e) => Number(e.campaignId) === Number(filter.campaignId));
    }
    if (filter.uploadedWalletAddress) {
      list = list.filter((e) => e.uploadedWalletAddress && e.uploadedWalletAddress.toLowerCase() === filter.uploadedWalletAddress.toLowerCase());
    }
    if (filter.verificationStatus) {
      list = list.filter((e) => e.verificationStatus === filter.verificationStatus);
    }
    return list;
  }

  async getEvidenceById(id) {
    if (isDbConnected()) {
      try {
        const doc = await Evidence.findOne({ $or: [{ evidenceId: String(id) }, { ipfsCid: String(id) }] }).lean();
        if (doc) return doc;
      } catch {}
    }
    const list = this.getAllEvidenceLocal();
    return list.find((e) => String(e.evidenceId) === String(id) || e.ipfsCid === String(id)) || null;
  }

  async saveEvidence(evidenceData) {
    const evidenceId = evidenceData.evidenceId || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const normalized = {
      ...evidenceData,
      evidenceId,
      campaignId: Number(evidenceData.campaignId || 1),
      originalSha256Hash: (evidenceData.originalSha256Hash || '').toLowerCase(),
      calculatedSha256Hash: evidenceData.calculatedSha256Hash ? evidenceData.calculatedSha256Hash.toLowerCase() : null,
      uploadedByWalletAddress: (evidenceData.uploadedByWalletAddress || evidenceData.uploadedWalletAddress || '0x70997970c51812dc3a010c7d01b50e0d17dc79c8').toLowerCase(),
      uploadedWalletAddress: (evidenceData.uploadedByWalletAddress || evidenceData.uploadedWalletAddress || '0x70997970c51812dc3a010c7d01b50e0d17dc79c8').toLowerCase(),
      blockchainTransactionHash: evidenceData.blockchainTransactionHash || null,
      verificationStatus: evidenceData.verificationStatus || 'VERIFIED',
      uploadTimestamp: evidenceData.uploadTimestamp || new Date(),
    };

    // Save to local JSON
    const list = this.getAllEvidenceLocal();
    const idx = list.findIndex((e) => e.evidenceId === evidenceId || e.ipfsCid === normalized.ipfsCid);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalized };
    } else {
      list.push(normalized);
    }
    try {
      fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed saving evidence.json:', err);
    }

    // Save to MongoDB
    if (isDbConnected()) {
      try {
        await Evidence.findOneAndUpdate(
          { $or: [{ evidenceId }, { ipfsCid: normalized.ipfsCid }] },
          normalized,
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('MongoDB Evidence save note:', err.message);
      }
    }

    return normalized;
  }

  async updateEvidenceVerification(evidenceId, { verificationStatus, calculatedSha256Hash, lastVerifiedAt }) {
    const list = this.getAllEvidenceLocal();
    const idx = list.findIndex((e) => e.evidenceId === String(evidenceId) || e.ipfsCid === String(evidenceId));
    if (idx >= 0) {
      list[idx].verificationStatus = verificationStatus;
      if (calculatedSha256Hash) list[idx].calculatedSha256Hash = calculatedSha256Hash.toLowerCase();
      list[idx].lastVerifiedAt = lastVerifiedAt || new Date();
      try {
        fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(list, null, 2), 'utf8');
      } catch {}
    }

    if (isDbConnected()) {
      try {
        await Evidence.findOneAndUpdate(
          { $or: [{ evidenceId: String(evidenceId) }, { ipfsCid: String(evidenceId) }] },
          {
            verificationStatus,
            calculatedSha256Hash: calculatedSha256Hash ? calculatedSha256Hash.toLowerCase() : undefined,
            lastVerifiedAt: lastVerifiedAt || new Date(),
          }
        );
      } catch (err) {
        console.warn('MongoDB Evidence update note:', err.message);
      }
    }

    return idx >= 0 ? list[idx] : null;
  }
}

export const db = new DatabaseService();
export { DatabaseService, DatabaseService as DbService };
export default db;
