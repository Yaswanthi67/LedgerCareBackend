import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    campaignId: { type: Number, required: true, unique: true, index: true },
    charityId: { type: Number, required: true, index: true },
    charityWallet: { type: String, required: true, lowercase: true, trim: true },
    charityName: { type: String, default: 'Verified Charity' },
    campaignTitle: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'General' },
    targetAmountInr: { type: Number, required: true },
    collectedAmountInr: { type: Number, default: 0 },
    amountCollectedInr: { type: Number, default: 0 },
    targetAmountEth: { type: String, default: '1.0' },
    raisedAmountEth: { type: String, default: '0' },
    withdrawnAmountEth: { type: String, default: '0' },
    campaignStatus: {
      type: String,
      enum: ['Active', 'Completed', 'Cancelled'],
      default: 'Active',
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    imageUrl: { type: String, default: '' },
    blockchainTransactionHash: { type: String, default: null },
    blockchainTxHash: { type: String, default: null },
    creationTimestamp: { type: Date, default: Date.now },
    creationDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model('Campaign', campaignSchema);
