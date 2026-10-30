import { IpfsService } from '../services/ipfsService.js';
import { db } from '../services/dbService.js';

export class EvidenceController {
  /**
   * POST /api/evidence/prepare
   * Computes SHA-256 hash in backend, pins file to IPFS, and prepares
   * transaction parameters for MetaMask user approval.
   */
  static async prepareEvidenceRegistration(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No evidence file uploaded. Please select a valid invoice, bill, or receipt.',
        });
      }

      const { campaignId, purpose, amountInr, amount, uploadedWalletAddress } = req.body;

      const result = await IpfsService.prepareEvidence(req.file, {
        campaignId: campaignId || 1,
        purpose: purpose || 'Campaign expenditure proof',
        amountInr: amountInr || amount || 0,
        uploadedWalletAddress,
      });

      res.status(200).json({
        success: true,
        message: 'File hashed with SHA-256 and pinned to IPFS. Ready for MetaMask transaction approval.',
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/evidence/confirm
   * Confirms evidence registration and stores confirmed blockchain transaction details in database.
   */
  static async confirmEvidenceRegistration(req, res, next) {
    try {
      const savedRecord = await IpfsService.confirmEvidence(req.body);

      res.status(201).json({
        success: true,
        message: 'Blockchain registration confirmed and persisted in database.',
        evidence: savedRecord,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/evidence/upload
   * Receives an evidence file, computes its SHA-256 hash, pins it to IPFS,
   * registers it on the blockchain (backend relayer fallback), and saves it in MongoDB.
   */
  static async uploadEvidence(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No evidence file uploaded. Please select a valid invoice, bill, or receipt.',
        });
      }

      const { campaignId, purpose, amountInr, amount, uploadedWalletAddress } = req.body;

      const result = await IpfsService.uploadEvidence(req.file, {
        campaignId: campaignId || 1,
        purpose: purpose || 'Campaign expenditure proof',
        amountInr: amountInr || amount || 0,
        uploadedWalletAddress,
      });

      res.status(201).json({
        success: true,
        message: 'Evidence document pinned to IPFS, registered on blockchain, and stored in database.',
        evidence: result.evidence,
        cid: result.cid,
        url: result.url,
        originalSha256Hash: result.originalSha256Hash,
        transactionHash: result.transactionHash,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/evidence/verify
   * Performs SHA-256 cryptographic verification of evidence:
   * 1. Retrieves registered original SHA-256 hash from MongoDB.
   * 2. Fetches raw bytes from IPFS (or uploaded file).
   * 3. Calculates newly computed SHA-256 hash.
   * 4. Compares hashes and displays VERIFIED or TAMPERED.
   */
  static async verifyEvidence(req, res, next) {
    try {
      const { evidenceId, cid, simulateTamper, expectedHash } = req.body;

      const result = await IpfsService.verifyEvidence({
        evidenceId,
        cid,
        file: req.file,
        simulateTamper: Boolean(simulateTamper),
        expectedHash,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/evidence
   * Retrieves evidence records, optionally filtered by campaignId
   */
  static async getAllEvidence(req, res, next) {
    try {
      const { campaignId, uploadedWalletAddress, verificationStatus } = req.query;
      const filter = {};
      if (campaignId) filter.campaignId = campaignId;
      if (uploadedWalletAddress) filter.uploadedWalletAddress = uploadedWalletAddress;
      if (verificationStatus) filter.verificationStatus = verificationStatus;

      const evidenceList = await db.getAllEvidence(filter);

      res.status(200).json({
        success: true,
        count: evidenceList.length,
        evidence: evidenceList,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/evidence/:id
   * Looks up single evidence by evidenceId or CID
   */
  static async getEvidenceById(req, res, next) {
    try {
      const { id } = req.params;
      const record = await db.getEvidenceById(id);

      if (!record) {
        return res.status(404).json({
          success: false,
          message: `Evidence record '${id}' not found.`,
        });
      }

      res.status(200).json({
        success: true,
        evidence: record,
      });
    } catch (err) {
      next(err);
    }
  }
}
