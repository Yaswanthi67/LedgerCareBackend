import { BlockchainService } from '../services/blockchainService.js';
import { db } from '../services/dbService.js';

export class CampaignController {
  /**
   * GET /api/campaigns
   * Returns all campaigns (on-chain + database)
   */
  static async getAllCampaigns(req, res, next) {
    try {
      const onChainCampaigns = await BlockchainService.getAllCampaigns();
      const dbCampaigns = await db.getAllCampaigns();

      // Merge campaigns by campaignId: prefer db metadata (category, image, inr amounts) + live on-chain balances
      const merged = onChainCampaigns.map((onChain) => {
        const dbMatch = dbCampaigns.find((dbc) => Number(dbc.campaignId) === Number(onChain.campaignId));
        if (dbMatch) {
          return {
            ...dbMatch,
            ...onChain,
            category: dbMatch.category || onChain.category || 'General',
            imageUrl: dbMatch.imageUrl || onChain.imageUrl || '',
            targetAmountInr: dbMatch.targetAmountInr || Math.round(parseFloat(onChain.targetAmountEth || '1') * 250000),
            raisedAmountInr: dbMatch.amountCollectedInr || dbMatch.raisedAmountInr || Math.round(parseFloat(onChain.raisedAmountEth || '0') * 250000),
            charityName: dbMatch.charityName || onChain.charityName || 'Verified Charity',
          };
        }
        return {
          ...onChain,
          category: onChain.category || 'General',
          targetAmountInr: Math.round(parseFloat(onChain.targetAmountEth || '1') * 250000),
          raisedAmountInr: Math.round(parseFloat(onChain.raisedAmountEth || '0') * 250000),
        };
      });

      for (const dbc of dbCampaigns) {
        const exists = merged.some((m) => Number(m.campaignId) === Number(dbc.campaignId));
        if (!exists) {
          merged.push(dbc);
        }
      }

      res.status(200).json({
        success: true,
        count: merged.length,
        campaigns: merged,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/campaigns
   * Deploys and registers a new charity campaign
   */
  static async createCampaign(req, res, next) {
    try {
      const {
        title,
        campaignTitle,
        description,
        targetAmount,
        targetAmountInr,
        targetAmountEth,
        startDate,
        endDate,
        category,
        imageUrl,
        charityId,
        charityName,
      } = req.body;

      const finalTitle = title || campaignTitle;

      if (!finalTitle || (!targetAmount && !targetAmountInr && !targetAmountEth)) {
        return res.status(400).json({
          success: false,
          message: 'Campaign title and target amount are required.',
        });
      }

      // 1. Deploy on-chain via BlockchainService
      const campaignRecord = await BlockchainService.createCampaign({
        title: finalTitle,
        description,
        targetAmount,
        targetAmountInr,
        targetAmountEth,
        startDate,
        endDate,
        category,
        imageUrl,
        charityId,
        charityName,
      });

      if (req.body.transactionHash) {
        campaignRecord.transactionHash = req.body.transactionHash;
        campaignRecord.blockchainTransactionHash = req.body.transactionHash;
      }
      if (req.body.campaignId) {
        campaignRecord.campaignId = Number(req.body.campaignId);
      }

      // 2. Persist in MongoDB database store
      await db.saveCampaign(campaignRecord);

      res.status(201).json({
        success: true,
        campaignId: campaignRecord.campaignId,
        campaign: campaignRecord,
        transactionHash: campaignRecord.transactionHash,
        message: 'Campaign created successfully and registered on CampaignManager.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/campaigns/:id
   * Returns a single campaign by ID
   */
  static async getCampaignById(req, res, next) {
    try {
      const { id } = req.params;
      let onChain = await BlockchainService.getCampaign(Number(id));
      const dbCamp = await db.getCampaignById(Number(id));

      if (!onChain && !dbCamp) {
        return res.status(404).json({
          success: false,
          message: `Campaign #${id} not found.`,
        });
      }

      let campaign;
      if (onChain && dbCamp) {
        campaign = {
          ...dbCamp,
          ...onChain,
          category: dbCamp.category || onChain.category || 'General',
          imageUrl: dbCamp.imageUrl || onChain.imageUrl || '',
          targetAmountInr: dbCamp.targetAmountInr || Math.round(parseFloat(onChain.targetAmountEth || '1') * 250000),
          raisedAmountInr: dbCamp.amountCollectedInr || dbCamp.raisedAmountInr || Math.round(parseFloat(onChain.raisedAmountEth || '0') * 250000),
          charityName: dbCamp.charityName || onChain.charityName || 'Verified Charity',
        };
      } else if (onChain) {
        campaign = {
          ...onChain,
          category: onChain.category || 'General',
          targetAmountInr: Math.round(parseFloat(onChain.targetAmountEth || '1') * 250000),
          raisedAmountInr: Math.round(parseFloat(onChain.raisedAmountEth || '0') * 250000),
        };
      } else {
        campaign = dbCamp;
      }

      res.status(200).json({
        success: true,
        campaign,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/campaigns/:id/donations
   * Returns donations for a campaign (on-chain + off-chain INR data)
   */
  static async getCampaignDonations(req, res, next) {
    try {
      const { id } = req.params;
      const campaignId = Number(id);

      // On-chain donations
      const onChainDonations = await BlockchainService.getCampaignDonations(campaignId);

      // Off-chain payment records from database
      const dbDonations = await db.getAllDonations({ campaignId });

      // Merge on-chain with payment metadata
      const merged = onChainDonations.map((d) => {
        const matched = dbDonations.find(
          (rec) =>
            rec.transactionHash &&
            (rec.blockchainDonationId === d.donationId ||
              Math.abs(Number(rec.amountEth) - Number(d.amountEth)) < 0.0001)
        );

        return {
          ...d,
          amountInr: matched ? matched.amountInr || matched.donationAmountInr : null,
          donorName: matched ? matched.donorName : 'Anonymous Donor',
          donorWalletAddress: matched ? matched.donorWalletAddress : null,
          paymentStatus: matched ? matched.paymentStatus : 'PAID',
          blockchainStatus: 'CONFIRMED',
          orderId: matched ? matched.orderId || matched.donationId : null,
        };
      });

      // Add any database donations that are confirmed but maybe not parsed in logs
      for (const don of dbDonations) {
        if (don.paymentStatus === 'PAID') {
          const exists = merged.some(
            (m) => m.donationId === don.blockchainDonationId || (don.transactionHash && m.transactionHash === don.transactionHash)
          );
          if (!exists) {
            merged.push({
              donationId: don.blockchainDonationId || merged.length + 1,
              campaignId,
              donor: don.donorWalletAddress || '0xBackendRelayer',
              amount: don.amountEth ? String(don.amountEth) : '0',
              amountEth: don.amountEth ? String(don.amountEth) : '0',
              amountInr: don.donationAmountInr || don.amountInr,
              donorName: don.donorName,
              donorWalletAddress: don.donorWalletAddress,
              paymentStatus: don.paymentStatus,
              blockchainStatus: don.blockchainStatus || 'CONFIRMED',
              orderId: don.orderId || don.donationId,
              timestamp: Math.floor(new Date(don.donationDate || don.createdAt).getTime() / 1000),
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        campaignId,
        count: merged.length,
        donations: merged,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/campaigns/:id/usages
   * Returns fund usages & evidence for a campaign (on-chain + MongoDB IPFS evidence)
   */
  static async getCampaignUsages(req, res, next) {
    try {
      const { id } = req.params;
      const campaignId = Number(id);

      const onChainUsages = await BlockchainService.getCampaignFundUsages(campaignId);
      const dbEvidence = await db.getAllEvidence({ campaignId });

      // Transform db evidence to unified format
      const evidenceUsages = dbEvidence.map((e) => ({
        usageId: e.blockchainUsageId || e.evidenceId,
        evidenceId: e.evidenceId,
        campaignId: Number(e.campaignId),
        charityWallet: e.uploadedWalletAddress,
        amount: e.amountEth || '0',
        amountEth: e.amountEth || '0',
        amountInr: e.amountInr || 0,
        purpose: e.purpose,
        evidenceHash: e.originalSha256Hash,
        originalSha256Hash: e.originalSha256Hash,
        cid: e.ipfsCid,
        ipfsCid: e.ipfsCid,
        fileName: e.fileName,
        transactionHash: e.blockchainTransactionHash,
        verificationStatus: e.verificationStatus,
        timestamp: Math.floor(new Date(e.uploadTimestamp).getTime() / 1000),
      }));

      // Combine and deduplicate
      const combined = [...evidenceUsages];
      for (const u of onChainUsages) {
        const exists = combined.some(
          (c) => c.usageId === u.usageId || (u.evidenceHash && c.evidenceHash.toLowerCase() === u.evidenceHash.toLowerCase())
        );
        if (!exists) {
          combined.push(u);
        }
      }

      res.status(200).json({
        success: true,
        campaignId,
        count: combined.length,
        usages: combined,
      });
    } catch (err) {
      next(err);
    }
  }
}
