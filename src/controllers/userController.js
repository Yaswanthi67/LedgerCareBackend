import { db } from '../services/dbService.js';

export class UserController {
  /**
   * POST /api/users
   * Registers or updates a user profile with their connected MetaMask wallet
   */
  static async registerUser(req, res, next) {
    try {
      const { userId, name, email, walletAddress, role } = req.body;

      if (!name && !walletAddress && !email) {
        return res.status(400).json({
          success: false,
          message: 'At least one of name, email, or walletAddress is required.',
        });
      }

      const user = await db.saveUser({
        userId,
        name: name || 'Anonymous User',
        email: email || '',
        walletAddress,
        role: role || 'Donor',
      });

      res.status(200).json({
        success: true,
        message: 'User profile synchronized.',
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/users/:walletOrId
   */
  static async getUser(req, res, next) {
    try {
      const { walletOrId } = req.params;
      let user = null;

      if (walletOrId.startsWith('0x')) {
        user = await db.getUserByWallet(walletOrId);
      } else {
        user = await db.getUserById(walletOrId);
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User '${walletOrId}' not found.`,
        });
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/users
   */
  static async getAllUsers(req, res, next) {
    try {
      const users = await db.getAllUsers();
      res.status(200).json({
        success: true,
        count: users.length,
        users,
      });
    } catch (err) {
      next(err);
    }
  }
}
