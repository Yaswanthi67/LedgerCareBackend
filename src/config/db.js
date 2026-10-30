import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[MongoDB] No MONGODB_URI configured in environment. Running with JSON database fallback.');
    return false;
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('[MongoDB] Connected to MongoDB Atlas successfully.');
    return true;
  } catch (err) {
    console.warn(`[MongoDB] MongoDB connection failed (${err.message}). Using local JSON fallback.`);
    return false;
  }
};

export const isDbConnected = () => mongoose.connection.readyState === 1;
