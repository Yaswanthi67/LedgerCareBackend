import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    evidenceId: { type: String, required: true, unique: true, index: true },
    campaignId: { type: Number, required: true, index: true },
    fileName: { type: String, required: true },
    fileSizeBytes: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    ipfsCid: { type: String, required: true, index: true },
    originalSha256Hash: { type: String, required: true, trim: true, lowercase: true },
    calculatedSha256Hash: { type: String, trim: true, lowercase: true, default: null },
    uploadedByWalletAddress: { type: String, required: true, lowercase: true, trim: true, index: true },
    uploadedWalletAddress: { type: String, lowercase: true, trim: true, index: true },
    blockchainTransactionHash: { type: String, default: null },
    blockchainUsageId: { type: Number, default: null },
    purpose: { type: String, default: '' },
    amountInr: { type: Number, default: 0 },
    amountEth: { type: String, default: '0' },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'TAMPERED', 'PENDING', 'VERIFICATION FAILED'],
      default: 'VERIFIED',
    },
    lastVerifiedAt: { type: Date, default: null },
    uploadTimestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Evidence = mongoose.model('Evidence', evidenceSchema);
