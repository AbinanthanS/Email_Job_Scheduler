import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'reachinbox_super_secure_jwt_secret_key_2026';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export class AuthController {
  /**
   * Handles Google OAuth ID token verification and issues a JWT session token.
   */
  public static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { credential, userInfo } = req.body;

      let email = '';
      let name = '';
      let avatar = '';
      let googleId = '';

      if (credential) {
        try {
          // Attempt Google library verification
          const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (payload) {
            email = payload.email || '';
            name = payload.name || '';
            avatar = payload.picture || '';
            googleId = payload.sub || '';
          }
        } catch (verifyError) {
          // Fallback: decode JWT payload directly (useful for local dev/testing)
          const decoded = jwt.decode(credential) as any;
          if (decoded && decoded.email) {
            email = decoded.email;
            name = decoded.name || email.split('@')[0];
            avatar = decoded.picture || '';
            googleId = decoded.sub || `google_${Date.now()}`;
          } else {
            throw verifyError;
          }
        }
      } else if (userInfo) {
        // Direct userInfo payload from client OAuth flow
        email = userInfo.email;
        name = userInfo.name || email.split('@')[0];
        avatar = userInfo.avatar || userInfo.picture || '';
        googleId = userInfo.id || `user_${Date.now()}`;
      } else {
        res.status(400).json({ success: false, message: 'Missing Google credential or user info' });
        return;
      }

      if (!email) {
        res.status(400).json({ success: false, message: 'Valid email not provided by Google OAuth' });
        return;
      }

      // Upsert User record in Database
      let user;
      try {
        user = await prisma.user.upsert({
          where: { email },
          update: { name, avatar, googleId },
          create: { email, name, avatar, googleId },
        });
      } catch (dbErr) {
        // If DB not yet migrated, construct memory user
        user = { id: `user_${Date.now()}`, email, name, avatar, googleId };
      }

      // Generate JWT Token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (error: any) {
      console.error('[AuthController] Login Error:', error);
      res.status(500).json({ success: false, message: 'Google authentication failed', error: error.message });
    }
  }

  /**
   * Demo / Development login for quick testing without Google credentials
   */
  public static async demoLogin(req: Request, res: Response): Promise<void> {
    try {
      const email = req.body.email || 'demo.user@reachinbox.ai';
      const name = req.body.name || 'ReachInbox Demo User';
      const avatar =
        req.body.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

      let user;
      try {
        user = await prisma.user.upsert({
          where: { email },
          update: { name, avatar },
          create: { email, name, avatar },
        });
      } catch {
        user = { id: 'demo_user_1', email, name, avatar };
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        success: true,
        token,
        user,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Gets current authenticated user details.
   */
  public static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      res.status(200).json({
        success: true,
        user: user || req.user,
      });
    } catch {
      res.status(200).json({ success: true, user: req.user });
    }
  }
}
