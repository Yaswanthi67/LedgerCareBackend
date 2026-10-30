import express from 'express';
import { DonationController } from '../controllers/donationController.js';

const router = express.Router();

router.get('/', DonationController.getAllDonations);
router.post('/', DonationController.recordDonation);
router.get('/:id', DonationController.getDonationById);
router.post('/:id/retry', DonationController.retryDonation);

export default router;
