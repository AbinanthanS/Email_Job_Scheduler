import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { optionalAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Schedule emails (supports single or bulk)
router.post('/schedule', optionalAuthMiddleware, EmailController.scheduleEmail);

// Scheduled emails list
router.get('/scheduled', optionalAuthMiddleware, EmailController.getScheduledEmails);

// Sent & Failed emails list
router.get('/sent', optionalAuthMiddleware, EmailController.getSentEmails);

// Cancel scheduled email
router.delete('/:id', optionalAuthMiddleware, EmailController.cancelEmail);

// Stats & Queue Health
router.get('/stats', optionalAuthMiddleware, EmailController.getStats);

// Senders list
router.get('/senders', optionalAuthMiddleware, EmailController.getSenders);

export default router;
