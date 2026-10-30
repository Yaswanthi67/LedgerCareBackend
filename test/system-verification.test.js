import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeBufferSha256, computeStringSha256, toBytes32Hex } from '../src/utils/hash.js';
import { db } from '../src/services/dbService.js';
import { IpfsService } from '../src/services/ipfsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSystemVerification() {
  console.log('================================================================');
  console.log('   LEDGERCARE COMPREHENSIVE SYSTEM & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      if (details) console.log(`         -> ${details}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      if (details) console.error(`         -> ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: SHA-256 Cryptographic Primitives (Requirement #4)
    // -------------------------------------------------------------
    console.log('TEST 1: SHA-256 Hash Computation and Conversion');
    const testContent = 'LedgerCare Transparent Charity Audit Report 2026';
    const testBuffer = Buffer.from(testContent, 'utf-8');

    const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');
    const computedHash = computeBufferSha256(testBuffer);
    const computedStringHash = computeStringSha256(testContent);

    assert(computedHash === expectedHash, 'computeBufferSha256 produces exact SHA-256 hex', computedHash);
    assert(computedStringHash === expectedHash, 'computeStringSha256 matches buffer hash');

    const bytes32 = toBytes32Hex(computedHash);
    assert(bytes32.startsWith('0x') && bytes32.length === 66, 'Bytes32 conversion generates valid 0x + 64 hex chars', bytes32);

    // Mismatched file test
    const alteredBuffer = Buffer.from(testContent + ' [MODIFIED]', 'utf-8');
    const alteredHash = computeBufferSha256(alteredBuffer);
    assert(alteredHash !== computedHash, 'Altered content produces strictly different SHA-256 hash');
    console.log('');

    // -------------------------------------------------------------
    // Test 2: Database Dual-Persistence (Requirement #2 - MongoDB)
    // -------------------------------------------------------------
    console.log('TEST 2: Database Layer (Users, Charities, Campaigns, Donations, Evidence)');

    // 2.1 User model
    const testUser = await db.saveUser({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.org',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      role: 'Donor',
    });
    assert(Boolean(testUser?.userId), 'User created with valid userId', `User ID: ${testUser?.userId}`);

    const foundUser = await db.getUserByWallet('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    assert(foundUser?.email === 'rohan.sharma@example.org', 'User retrieved by wallet address');

    // 2.2 Charity model
    const testCharity = await db.saveCharity({
      organizationName: 'Pratham Shiksha Foundation',
      registrationNumber: 'CSR-IND-2026-009',
      registrationDetails: 'Registered under Section 8 of the Companies Act, 2013',
      email: 'contact@prathamshiksha.org',
      walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      registrationDocumentHash: '0x' + crypto.createHash('sha256').update('doc-proof').digest('hex'),
      verified: true,
      blockchainVerificationStatus: 'VERIFIED',
    });
    assert(Boolean(testCharity?.charityId), 'Charity registered with valid charityId', `Charity ID: ${testCharity?.charityId}`);

    // 2.3 Campaign model
    const testCampaign = await db.saveCampaign({
      campaignId: 101,
      charityId: testCharity.charityId,
      charityWallet: testCharity.walletAddress,
      campaignTitle: 'Rural Computer Literacy Lab 2026',
      description: 'Funding 50 laptops and solar power for remote school in Maharashtra',
      targetAmountInr: 250000,
      amountCollectedInr: 50000,
      targetAmountEth: '1.0',
      raisedAmountEth: '0.2',
      campaignStatus: 0,
    });
    assert(testCampaign?.targetAmountInr === 250000, 'Campaign created with INR target amount', `Target: ₹${testCampaign?.targetAmountInr}`);

    // 2.4 Donation model (strictly INR-based)
    const orderId = `order_test_${Date.now()}`;
    const testOrder = await db.createOrder({
      orderId,
      campaignId: 101,
      amountInr: 5000,
      amountEth: 0.02,
      donorName: testUser.name,
      donorEmail: testUser.email,
      donorPhone: '9876543210',
      donorWalletAddress: testUser.walletAddress,
    });
    assert(testOrder?.amountInr === 5000, 'Donation order recorded with INR denomination', `Amount: ₹${testOrder?.amountInr}`);
    assert(testOrder?.donorWalletAddress === testUser.walletAddress, 'Donation links donor wallet address');

    const updatedOrder = await db.updatePaymentStatus(orderId, 'paid', 'pay_test_12345');
    assert(updatedOrder?.paymentStatus === 'paid', 'Donation payment status updated to paid');
    console.log('');

    // -------------------------------------------------------------
    // Test 3: IPFS File Storage & Evidence Registration (Requirement #3)
    // -------------------------------------------------------------
    console.log('TEST 3: IPFS Evidence Upload & SHA-256 Storage');
    const invoiceFile = {
      buffer: Buffer.from('Dell Laptop Purchase Invoice #INV-2026-901 - Amount ₹50,000 for Classroom 4B', 'utf-8'),
      originalname: 'laptop_invoice_inv901.pdf',
      mimetype: 'application/pdf',
      size: 78,
    };

    const uploadRes = await IpfsService.uploadEvidence(invoiceFile, {
      campaignId: 101,
      charityWallet: testCharity.walletAddress,
      purpose: 'Procurement of 50 laptops',
      amountInr: 50000,
    });

    assert(Boolean(uploadRes.cid), 'File assigned IPFS CID', `CID: ${uploadRes.cid}`);
    assert(Boolean(uploadRes.originalSha256Hash), 'Original SHA-256 calculated on upload', `Hash: ${uploadRes.originalSha256Hash}`);
    assert(Boolean(uploadRes.evidence?.evidenceId), 'Evidence record saved with unique evidenceId', `Evidence ID: ${uploadRes.evidence?.evidenceId}`);
    console.log('');

    // -------------------------------------------------------------
    // Test 4: SHA-256 Verification & Tamper Detection (Requirement #4)
    // -------------------------------------------------------------
    console.log('TEST 4: SHA-256 Evidence Verification (Authentic vs Tampered)');

    // 4.1 Verification of Authentic File
    const cleanHash = (h) => (h || '').replace(/^0x/, '').toLowerCase();
    const authenticVerifyResult = await IpfsService.verifyEvidence({
      evidenceId: uploadRes.evidence.evidenceId,
      file: invoiceFile,
    });

    assert(authenticVerifyResult.verified === true, 'Authentic file matches registered hash -> verified: true');
    assert(authenticVerifyResult.status === 'VERIFIED', 'Status flag is VERIFIED');
    assert(authenticVerifyResult.statusText && authenticVerifyResult.statusText.startsWith('VERIFIED'), 'Verification returns exact VERIFIED string');
    assert(cleanHash(authenticVerifyResult.originalSha256Hash) === cleanHash(uploadRes.originalSha256Hash), 'Original registered hash is strictly preserved');
    assert(cleanHash(authenticVerifyResult.calculatedSha256Hash) === cleanHash(uploadRes.originalSha256Hash), 'Calculated hash equals original hash');
    assert(Boolean(authenticVerifyResult.verificationTimestamp), 'Verification timestamp is recorded');

    // 4.2 Verification of Tampered File
    const tamperedVerifyResult = await IpfsService.verifyEvidence({
      evidenceId: uploadRes.evidence.evidenceId,
      simulateTamper: true,
    });

    assert(tamperedVerifyResult.verified === false, 'Tampered file is detected -> verified: false');
    assert(tamperedVerifyResult.status === 'TAMPERED', 'Status flag is TAMPERED');
    assert(tamperedVerifyResult.statusText && tamperedVerifyResult.statusText.startsWith('TAMPERED'), 'Verification returns exact TAMPERED string');
    assert(cleanHash(tamperedVerifyResult.originalSha256Hash) === cleanHash(uploadRes.originalSha256Hash), 'Original registered hash remained strictly unmodified in database');
    assert(cleanHash(tamperedVerifyResult.calculatedSha256Hash) !== cleanHash(uploadRes.originalSha256Hash), 'Calculated hash reflects altered bytes');
    console.log('');

    // -------------------------------------------------------------
    // Test 5: Smart Contract Configuration & ABIs (Requirement #5)
    // -------------------------------------------------------------
    console.log('TEST 5: Smart Contract Integration & ABIs');
    const deployedAddressesPath = path.resolve(__dirname, '../../LedgerCareBlockchain/deployed-addresses.json');
    assert(fs.existsSync(deployedAddressesPath), 'deployed-addresses.json exists in blockchain directory');

    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, 'utf8'));
    assert(Boolean(deployedAddresses.CharityRegistry), 'CharityRegistry address configured', deployedAddresses.CharityRegistry);
    assert(Boolean(deployedAddresses.CampaignManager), 'CampaignManager address configured', deployedAddresses.CampaignManager);
    assert(Boolean(deployedAddresses.DonationLedger), 'DonationLedger address configured', deployedAddresses.DonationLedger);
    assert(Boolean(deployedAddresses.FundEvidenceTracker), 'FundEvidenceTracker address configured', deployedAddresses.FundEvidenceTracker);
    console.log('');

    // -------------------------------------------------------------
    // Test 6: MetaMask Preparation & Evidence Registration Workflow
    // -------------------------------------------------------------
    console.log('TEST 6: MetaMask Interaction & Evidence Registration Workflow');
    const billFile = {
      buffer: Buffer.from('Official Solar Panel Installation Invoice #INV-2026-SOLAR - Amount ₹75,000', 'utf-8'),
      originalname: 'solar_installation_invoice.pdf',
      mimetype: 'application/pdf',
      size: 89,
    };

    // Step 4 & 5: Backend generates SHA-256 hash & uploads to IPFS (obtains CID)
    const prepRes = await IpfsService.prepareEvidence(billFile, {
      campaignId: 101,
      uploadedWalletAddress: testCharity.walletAddress,
      purpose: 'Installation of solar inverter panels',
      amountInr: 75000,
    });

    assert(prepRes.success === true, 'prepareEvidence returns success');
    assert(Boolean(prepRes.cid), 'IPFS CID obtained', `CID: ${prepRes.cid}`);
    assert(Boolean(prepRes.originalSha256Hash), 'Raw SHA-256 hash computed in backend', `SHA-256: ${prepRes.originalSha256Hash}`);

    // Step 6: Prepared blockchain registration transaction contains all required fields
    const pTx = prepRes.preparedTx;
    assert(pTx.campaignId === 101, 'preparedTx contains Campaign ID', `Campaign ID: ${pTx.campaignId}`);
    assert(Boolean(pTx.evidenceId), 'preparedTx contains Evidence ID', `Evidence ID: ${pTx.evidenceId}`);
    assert(pTx.ipfsCid === prepRes.cid, 'preparedTx contains IPFS CID');
    assert(pTx.sha256Hash.startsWith('0x') && pTx.sha256Hash.length === 66, 'preparedTx contains bytes32 SHA-256 hash', pTx.sha256Hash);
    assert(pTx.charityWallet.toLowerCase() === testCharity.walletAddress.toLowerCase(), 'preparedTx contains charity wallet address');
    assert(Boolean(pTx.timestamp), 'preparedTx contains timestamp', `Timestamp: ${pTx.timestamp}`);

    // Step 8 & 9: Confirm registration with transaction hash and block number
    const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');
    const mockBlockNum = 142;
    const confirmRes = await IpfsService.confirmEvidence({
      evidenceId: pTx.evidenceId,
      campaignId: pTx.campaignId,
      fileName: billFile.originalname,
      fileSizeBytes: billFile.size,
      mimeType: billFile.mimetype,
      ipfsCid: pTx.ipfsCid,
      originalSha256Hash: pTx.sha256Hash,
      uploadedWalletAddress: pTx.charityWallet,
      blockchainTransactionHash: mockTxHash,
      blockNumber: mockBlockNum,
      blockchainUsageId: pTx.numericEvidenceId,
      purpose: pTx.purpose,
      amountInr: pTx.amountInr,
    });

    assert(confirmRes?.blockchainTransactionHash === mockTxHash, 'Confirmed record persists blockchain transaction hash');
    assert(confirmRes?.blockNumber === mockBlockNum, 'Confirmed record persists block number');
    assert(confirmRes?.verificationStatus === 'VERIFIED', 'Initial status set to VERIFIED');

    // Step 10 & 11: Verification flow (retrieves original hash, downloads from IPFS, calculates fresh hash, displays VERIFIED or TAMPERED)
    const verifyAuthentic = await IpfsService.verifyEvidence({
      evidenceId: confirmRes.evidenceId,
      cid: confirmRes.ipfsCid,
    });
    assert(verifyAuthentic.status === 'VERIFIED', 'Donor verification of authentic IPFS file returns VERIFIED');

    const verifyTampered = await IpfsService.verifyEvidence({
      evidenceId: confirmRes.evidenceId,
      cid: confirmRes.ipfsCid,
      simulateTamper: true,
    });
    assert(verifyTampered.status === 'TAMPERED', 'Donor verification of tampered file returns TAMPERED');
    console.log('');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('================================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during system verification:', err);
    process.exit(1);
  }
}

runSystemVerification();
