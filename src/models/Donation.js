import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
  {
    donationId: { type: String, required: true, unique: true, index: true },
    donorId: { type: String, default: null, index: true },
    donorWalletAddress: { type: String, lowercase: true, trim: true, default: null, index: true },
    campaignId: { type: Number, required: true, index: true },
    amountInr: { type: Number, required: true },
    donationAmountInr: { type: Number },
    amountEth: { type: Number, default: 0 },
    paymentMethod: { type: String, default: 'UPI' },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    paymentOrderId: { type: String, index: true },
    paymentId: { type: String, default: null },
    blockchainStatus: {
      type: String,
      enum: ['NOT_STARTED', 'SUBMITTED', 'CONFIRMING', 'CONFIRMED', 'FAILED'],
      default: 'NOT_STARTED',
    },
    blockchainTransactionReference: { type: String, default: null },
    blockchainTransactionHash: { type: String, default: null },
    blockchainDonationId: { type: Number, default: null },
    donorName: { type: String, default: 'Anonymous Donor', trim: true },
    donorEmail: { type: String, lowercase: true, trim: true },
    donorPhone: { type: String, trim: true },
    donationTimestamp: { type: Date, default: Date.now },
    donationDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Donation = mongoose.model('Donation', donationSchema);
