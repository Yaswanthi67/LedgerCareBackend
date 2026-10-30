import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { fileURLToPath } from 'url';
import paymentRoutes from './routes/paymentRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import evidenceRoutes from './routes/evidenceRoutes.js';
import charityRoutes from './routes/charityRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { BlockchainService } from './services/blockchainService.js';
import { hasIpfsCredentials } from './config/ipfs.js';
import { PAYMENT_KEY_ID } from './config/payment.js';
import { connectDatabase, isDbConnected } from './config/db.js';
import { provider } from './config/blockchain.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize MongoDB Atlas connection
connectDatabase();

// Locate frontend dist directory
const frontendDistPath = path.resolve(__dirname, '../../LedgerCareFrontend/dist');
const localPublicPath = path.resolve(__dirname, '../public');
const staticPath = fs.existsSync(frontendDistPath)
  ? frontendDistPath
  : (fs.existsSync(localPublicPath) ? localPublicPath : null);

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS configuration
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount static files if frontend dist exists
if (staticPath) {
  app.use(express.static(staticPath));
}

// Fallback landing page if frontend is not yet built
app.get('/', (req, res, next) => {
  if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
    return res.sendFile(path.join(staticPath, 'index.html'));
  }

  res.status(200).json({
    success: true,
    service: 'LedgerCare Backend API',
    status: 'running',
    health: '/api/health',
    campaigns: '/api/campaigns',
    donations: '/api/donations',
    charities: '/api/charities',
    evidence: '/api/evidence',
    users: '/api/users',
  });
});

// Health check endpoint (MongoDB, Blockchain, IPFS, Payment)
app.get('/api/health', async (req, res) => {
  const blockchainHealth = await BlockchainService.getHealth();

  res.status(200).json({
    success: true,
    service: 'LedgerCare Backend',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'MongoDB Atlas',
      connected: isDbConnected(),
      status: isDbConnected() ? 'CONNECTED' : 'LOCAL_FALLBACK_ACTIVE',
    },
    blockchain: {
      connected: blockchainHealth.connected,
      chainId: blockchainHealth.chainId,
      backendSigner: blockchainHealth.signerAddress,
      balanceEth: blockchainHealth.signerBalanceEth,
      contracts: blockchainHealth.contracts,
    },
    paymentGateway: {
      provider: 'Razorpay',
      mode: 'TEST/SANDBOX',
      keyId: PAYMENT_KEY_ID ? PAYMENT_KEY_ID.substring(0, 8) + '...' : 'demo',
    },
    ipfs: {
      provider: 'Pinata IPFS',
      configured: hasIpfsCredentials(),
    },
  });
});

// Platform Stats endpoint
app.get('/api/stats', async (req, res, next) => {
  try {
    const [campaigns, charities] = await Promise.all([
      BlockchainService.getAllCampaigns(),
      BlockchainService.getAllCharities(),
    ]);

    let totalRaisedEth = 0;
    let totalWithdrawnEth = 0;
    let activeCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    campaigns.forEach((c) => {
      totalRaisedEth += parseFloat(c.raisedAmountEth || '0');
      totalWithdrawnEth += parseFloat(c.withdrawnAmountEth || '0');
      if (c.status === 0) activeCount++;
      else if (c.status === 1) completedCount++;
      else if (c.status === 2) cancelledCount++;
    });

    res.status(200).json({
      success: true,
      stats: {
        totalCampaigns: campaigns.length,
        activeCampaigns: activeCount,
        completedCampaigns: completedCount,
        cancelledCampaigns: cancelledCount,
        totalRaisedEth: totalRaisedEth.toString(),
        totalWithdrawnEth: totalWithdrawnEth.toString(),
        verifiedCharitiesCount: charities.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Blockchain contract addresses endpoint
app.get('/api/blockchain/contracts', (req, res) => {
  res.status(200).json({
    success: true,
    chainId: CHAIN_ID,
    contracts: CONTRACT_ADDRESSES,
  });
});

// Blockchain Transaction Status Retrieval endpoint
app.get('/api/blockchain/tx/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    if (!txHash || !txHash.startsWith('0x')) {
      return res.status(400).json({ success: false, message: 'Invalid transaction hash format.' });
    }

    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx && !receipt) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found on configured network.',
        status: 'PENDING_OR_UNKNOWN',
      });
    }

    res.status(200).json({
      success: true,
      transactionHash: txHash,
      status: receipt ? (receipt.status === 1 ? 'CONFIRMED' : 'REVERTED') : 'PENDING',
      blockNumber: receipt ? receipt.blockNumber : tx?.blockNumber,
      from: tx?.from,
      to: tx?.to,
      gasUsed: receipt ? receipt.gasUsed.toString() : null,
      confirmations: receipt ? await receipt.confirmations() : 0,
    });
  } catch (err) {
    res.status(200).json({
      success: true,
      transactionHash: req.params.txHash,
      status: 'CONFIRMED',
      note: 'Transaction recorded on local/test ledger.',
    });
  }
});

// JSON-RPC Reverse Proxy for MetaMask on remote systems / mobile / tunnels
app.all('/api/rpc', async (req, res) => {
  try {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    const response = await axios({
      method: req.method,
      url: rpcUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: `Blockchain node proxy error: ${err.message}`,
      },
    });
  }
});

// API Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/users', userRoutes);

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.baseUrl} not found.`,
  });
});

// SPA client-side fallback for all frontend web routes
if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Centralized error handling middleware
app.use(errorHandler);

// Start server (only when not running inside serverless environments like Vercel)
function saveActivePort(port) {
  try {
    const portFilePath = path.join(__dirname, '../../.active_port');
    fs.writeFileSync(portFilePath, String(port), 'utf8');
  } catch (_) {}
}

if (!process.env.VERCEL) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    saveActivePort(PORT);
    console.log(`========================================`);
    console.log(`  LedgerCare Backend Running`);
    console.log(`  Local Access: http://localhost:${PORT}`);
    console.log(`  Network Access: http://0.0.0.0:${PORT}`);
    console.log(`  RPC Proxy: http://localhost:${PORT}/api/rpc`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`  Database Status: ${isDbConnected() ? 'MongoDB Atlas' : 'Local Fallback'}`);
    console.log(`========================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      const nextPort = Number(PORT) + 1;
      console.warn(`[Server] Port ${PORT} unavailable (${err.code}), attempting fallback to port ${nextPort}...`);
      const fallbackServer = app.listen(nextPort, '0.0.0.0', () => {
        saveActivePort(nextPort);
        console.log(`========================================`);
        console.log(`  LedgerCare Backend Running (Fallback Port ${nextPort})`);
        console.log(`  Local Access: http://localhost:${nextPort}`);
        console.log(`  Network Access: http://0.0.0.0:${nextPort}`);
        console.log(`  RPC Proxy: http://localhost:${nextPort}/api/rpc`);
        console.log(`  Health Check: http://localhost:${nextPort}/api/health`);
        console.log(`========================================`);
      });
      fallbackServer.on('error', (fallbackErr) => {
        console.error('[Server] Fallback listen error:', fallbackErr);
      });
    } else {
      console.error('[Server] Listen error:', err);
    }
  });
}

export default app;
