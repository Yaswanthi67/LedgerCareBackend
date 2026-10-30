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

// Strict Evidence Immutability Enforcers
const rejectMutation = (req, res) => {
  res.status(403).json({
    success: false,
    error: 'IMMUTABLE_RECORD',
    message: 'Evidence on LedgerCare is cryptographically immutable once anchored to IPFS and smart contracts. Modification, correction, or deletion is prohibited.',
  });
};

router.put('/:id', rejectMutation);
router.patch('/:id', rejectMutation);
router.delete('/:id', rejectMutation);

export default router;
