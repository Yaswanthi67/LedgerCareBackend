import mongoose from 'mongoose';

const charitySchema = new mongoose.Schema(
  {
    charityId: { type: Number, required: true, unique: true, index: true },
    organizationName: { type: String, required: true, trim: true },
    registrationInformation: { type: String, default: '' },
    registrationNumber: { type: String, required: true, unique: true, trim: true },
    registrationDetails: {
      registrationNumber: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    walletAddress: { type: String, required: true, trim: true, lowercase: true, index: true },
    registrationHash: { type: String, default: null },
    registrationDocumentHash: { type: String, default: null },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'REJECTED'],
      default: 'VERIFIED',
    },
    blockchainVerificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'REJECTED'],
      default: 'VERIFIED',
    },
    verified: { type: Boolean, default: true },
    blockchainTransactionHash: { type: String, default: null },
    blockchainTxHash: { type: String, default: null },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Charity = mongoose.model('Charity', charitySchema);
