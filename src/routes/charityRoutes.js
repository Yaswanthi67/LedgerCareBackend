import express from 'express';
import { CharityController } from '../controllers/charityController.js';

const router = express.Router();

router.get('/', CharityController.getAllCharities);
router.post('/register', CharityController.registerCharity);
router.get('/:id', CharityController.getCharityById);
router.get('/:id/verification', CharityController.getCharityVerification);

export default router;
