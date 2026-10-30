import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    walletAddress: { type: String, trim: true, lowercase: true, index: true, default: null },
    role: { type: String, enum: ['Donor', 'Charity', 'Admin'], default: 'Donor' },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
