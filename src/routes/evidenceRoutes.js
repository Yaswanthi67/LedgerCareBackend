import express from 'express';
import { EvidenceController } from '../controllers/evidenceController.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = express.Router();

router.get('/', EvidenceController.getAllEvidence);
router.get('/:id', EvidenceController.getEvidenceById);
router.post('/prepare', uploadMiddleware.single('file'), EvidenceController.prepareEvidenceRegistration);
router.post('/confirm', EvidenceController.confirmEvidenceRegistration);
router.post('/upload', uploadMiddleware.single('file'), EvidenceController.uploadEvidence);
router.post('/verify', uploadMiddleware.single('file'), EvidenceController.verifyEvidence);

export default router;
