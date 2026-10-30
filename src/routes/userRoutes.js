import express from 'express';
import { UserController } from '../controllers/userController.js';

const router = express.Router();

router.get('/', UserController.getAllUsers);
router.get('/:walletOrId', UserController.getUser);
router.post('/', UserController.registerUser);
router.post('/register', UserController.registerUser);

export default router;
