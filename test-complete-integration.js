import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('  LEDGERCARE: INTEGRATION & VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Helper for assert
  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. HEALTH CHECK & BLOCKCHAIN CONNECTIVITY
  try {
    const health = await axios.get(`${BASE_URL}/api/health`);
    assert(health.status === 200 && health.data.success === true, 'Server is running and healthy');
    assert(health.data.blockchain?.connected === true, 'Blockchain node connected on port 8545');
    assert(health.data.blockchain?.chainId === 31337, 'Chain ID is Hardhat 31337');
    assert(health.data.blockchain?.contracts?.CharityRegistry !== undefined, 'Smart contract addresses loaded');
  } catch (err) {
    assert(false, `Health Check failed: ${err.message}`);
  }

  // 2. MONGODB & CHARITY REGISTRATION TEST
  let registeredCharity = null;
  const testCharityWallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  try {
    const charityRes = await axios.post(`${BASE_URL}/api/charities/register`, {
      organizationName: `Global Hope Foundation ${Date.now().toString().slice(-4)}`,
      registrationNumber: `REG-${Date.now().toString().slice(-6)}`,
      email: `contact_${Date.now().toString().slice(-4)}@globalhope.org`,
      walletAddress: testCharityWallet,
    });
    assert(charityRes.status === 201 && charityRes.data.success === true, 'Charity registered successfully');
    assert(charityRes.data.status === 'VERIFIED', 'Charity verification status is VERIFIED');
    assert(Boolean(charityRes.data.hash), 'Cryptographic credential hash generated and stored');
    registeredCharity = charityRes.data.charity;
  } catch (err) {
    assert(false, `Charity registration failed: ${err.response?.data?.message || err.message}`);
  }

  // 3. CAMPAIGN CREATION WITH INR TARGET
  let createdCampaign = null;
  try {
    const campRes = await axios.post(`${BASE_URL}/api/campaigns`, {
      title: 'Clean Water Initiative for Rural Schools',
      description: 'Installing solar-powered water filtration units across 15 schools.',
      targetAmountInr: 300000,
      category: 'Healthcare',
      charityId: registeredCharity?.charityId || 1,
      charityName: registeredCharity?.organizationName || 'Verified Charity',
      charityWallet: testCharityWallet,
    });
    assert(campRes.status === 201 && campRes.data.success === true, 'Campaign created successfully in database');
    assert(campRes.data.campaign?.targetAmountInr === 300000, 'Campaign fundraising target recorded in INR (₹300,000)');
    assert(Boolean(campRes.data.campaign?.campaignId), 'Campaign ID assigned');
    createdCampaign = campRes.data.campaign;
  } catch (err) {
    assert(false, `Campaign creation failed: ${err.response?.data?.message || err.message}`);
  }

  // 4. INR / UPI DONATION TEST
  let recordedDonation = null;
  try {
    const orderRes = await axios.post(`${BASE_URL}/api/payment/create-order`, {
      campaignId: 1,
      amountInr: 5000,
      donorName: 'Rahul Sharma',
      donorEmail: 'rahul.sharma@example.com',
      donorPhone: '9876543210',
      donorWalletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    });
    assert(orderRes.status === 201 || orderRes.status === 200, 'UPI donation order initiated');

    // Confirm simulated payment
    const verifyRes = await axios.post(`${BASE_URL}/api/payment/verify`, {
      razorpay_order_id: orderRes.data.orderId,
      razorpay_payment_id: `pay_sim_${Date.now()}`,
      razorpay_signature: 'simulated_valid_signature',
      skipBlockchain: false,
    });
    assert(verifyRes.status === 200 && verifyRes.data.success === true, 'UPI payment verified and settled');
    assert(verifyRes.data.amountInr === 5000 || verifyRes.data.donation?.amountInr === 5000, 'Donation recorded in INR');
    assert(Boolean(verifyRes.data.transactionHash || verifyRes.data.donation?.donationId), 'Donation blockchain transaction confirmed');
    recordedDonation = verifyRes.data;
  } catch (err) {
    assert(false, `Donation flow failed: ${err.response?.data?.message || err.message}`);
  }

  // 5. IPFS UPLOAD & SHA-256 REGISTRATION
  let uploadedEvidence = null;
  const sampleInvoiceBytes = Buffer.from(
    `OFFICIAL INVOICE #INV-${Date.now()}\nVendor: AquaPure Technologies\nItems: 15x Water Purifiers\nTotal Amount: INR 45,000\nPayment Terms: Confirmed via LedgerCare`
  );
  const expectedOriginalHash = '0x' + crypto.createHash('sha256').update(sampleInvoiceBytes).digest('hex');

  try {
    const form = new FormData();
    form.append('file', sampleInvoiceBytes, {
      filename: 'invoice_water_filtration.pdf',
      contentType: 'application/pdf',
    });
    form.append('campaignId', String(createdCampaign?.campaignId || 1));
    form.append('purpose', 'Procurement of 15x water filtration units');
    form.append('amountInr', '45000');
    form.append('uploadedWalletAddress', testCharityWallet);

    const uploadRes = await axios.post(`${BASE_URL}/api/evidence/upload`, form, {
      headers: form.getHeaders(),
    });

    assert(uploadRes.status === 201 && uploadRes.data.success === true, 'Invoice uploaded and processed');
    assert(Boolean(uploadRes.data.cid), `IPFS CID obtained (${uploadRes.data.cid})`);
    assert(
      uploadRes.data.originalSha256Hash.toLowerCase() === expectedOriginalHash.toLowerCase(),
      'SHA-256 calculated correctly from original raw file bytes'
    );
    assert(Boolean(uploadRes.data.transactionHash), 'Evidence registered on FundEvidenceTracker blockchain');
    uploadedEvidence = uploadRes.data;
  } catch (err) {
    assert(false, `IPFS upload failed: ${err.response?.data?.message || err.message}`);
  }

  // 6. SHA-256 CRYPTOGRAPHIC VERIFICATION: AUTHENTIC TEST
  try {
    const verifyAuthentic = await axios.post(`${BASE_URL}/api/evidence/verify`, {
      evidenceId: uploadedEvidence?.evidence?.evidenceId || uploadedEvidence?.cid,
      cid: uploadedEvidence?.cid,
    });
    assert(verifyAuthentic.status === 200, 'Verification endpoint responded HTTP 200');
    assert(verifyAuthentic.data.verified === true, 'Authentic evidence verified as true');
    assert(verifyAuthentic.data.status === 'VERIFIED', 'Status returns VERIFIED');
    assert(
      verifyAuthentic.data.statusText === 'VERIFIED – Evidence is authentic and unchanged.',
      'Exact user message: VERIFIED – Evidence is authentic and unchanged.'
    );
    assert(Boolean(verifyAuthentic.data.campaignId), 'Campaign ID present in verification result');
    assert(Boolean(verifyAuthentic.data.evidenceId), 'Evidence ID present in verification result');
    assert(Boolean(verifyAuthentic.data.ipfsCid), 'IPFS CID present in verification result');
    assert(Boolean(verifyAuthentic.data.originalSha256Hash), 'Original SHA-256 hash present');
    assert(Boolean(verifyAuthentic.data.calculatedSha256Hash), 'Calculated SHA-256 hash present');
    assert(Boolean(verifyAuthentic.data.verificationTimestamp), 'Verification timestamp present');
  } catch (err) {
    assert(false, `Authentic verification failed: ${err.response?.data?.message || err.message}`);
  }

  // 7. SHA-256 CRYPTOGRAPHIC VERIFICATION: TAMPERED TEST
  try {
    const verifyTampered = await axios.post(`${BASE_URL}/api/evidence/verify`, {
      evidenceId: uploadedEvidence?.evidence?.evidenceId || uploadedEvidence?.cid,
      cid: uploadedEvidence?.cid,
      simulateTamper: true,
    });
    assert(verifyTampered.status === 200, 'Tampered test endpoint responded HTTP 200');
    assert(verifyTampered.data.verified === false, 'Tampered evidence correctly NOT marked verified');
    assert(verifyTampered.data.status === 'TAMPERED', 'Status returns TAMPERED');
    assert(
      verifyTampered.data.statusText ===
        'TAMPERED – Evidence has been modified or does not match the original registered evidence.',
      'Exact user message: TAMPERED – Evidence has been modified or does not match the original registered evidence.'
    );
    assert(
      verifyTampered.data.calculatedSha256Hash.toLowerCase() !==
        verifyTampered.data.originalSha256Hash.toLowerCase(),
      'Newly calculated hash differs from original hash'
    );
  } catch (err) {
    assert(false, `Tampered test failed: ${err.response?.data?.message || err.message}`);
  }

  // 8. SHA-256 CRYPTOGRAPHIC VERIFICATION: IPFS RETRIEVAL FAILURE TEST
  try {
    const verifyFailure = await axios.post(`${BASE_URL}/api/evidence/verify`, {
      evidenceId: 'ev_non_existent_fake_999999',
      cid: 'bafybeig_fake_non_existent_cid_that_does_not_exist_at_all_99999',
    });
    assert(verifyFailure.status === 200 || verifyFailure.status === 400 || verifyFailure.status === 404, 'Endpoint caught invalid CID');
    assert(verifyFailure.data.verified === false, 'Failed retrieval NEVER marked as verified');
    assert(
      verifyFailure.data.status === 'VERIFICATION FAILED',
      'Status returns VERIFICATION FAILED – Unable to verify evidence.'
    );
  } catch (err) {
    // If backend returns error response
    if (err.response?.data) {
      assert(err.response.data.verified !== true, 'Failed retrieval NEVER marked as verified');
      assert(
        err.response.data.status === 'VERIFICATION FAILED' || !err.response.data.verified,
        'Status indicates failure without false positive'
      );
    } else {
      assert(false, `Failure test error: ${err.message}`);
    }
  }

  // 9. ROLE RESTRICTION TEST: VALIDATION ERROR HANDLING
  try {
    const invalidCharity = await axios.post(
      `${BASE_URL}/api/charities/register`,
      { organizationName: '' },
      { validateStatus: () => true }
    );
    assert(invalidCharity.status === 400, 'Backend rejects invalid charity registration');
  } catch (err) {
    assert(false, `Validation test error: ${err.message}`);
  }

  // 10. FRONTEND DISTRIBUTION & 4 CORE MODULES
  try {
    const indexHtml = await axios.get(`${BASE_URL}/`);
    assert(indexHtml.status === 200, 'Unified server serves frontend HTML on port 5000');
    assert(indexHtml.data.includes('LedgerCare'), 'Frontend title contains LedgerCare');
  } catch (err) {
    assert(false, `Frontend check failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
