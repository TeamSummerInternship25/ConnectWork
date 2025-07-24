import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireRole, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Submit feedback
router.post('/', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId, type, message } = req.body;
    const userId = req.user!.id;

    if (!presentationId || !type) {
      throw createError('Presentation ID and type are required', 400);
    }

    // Verify presentation exists and user has access
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        audience: true
      }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    // Check if user has access to this presentation
    const hasAccess =
      presentation.organizerId === userId ||
      presentation.speakerId === userId ||
      presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Validate feedback type (based on schema enum)
    const validTypes = ['TOO_FAST', 'TOO_SLOW', 'BORING', 'POOR_QUESTIONS', 'GENERAL'];
    if (!validTypes.includes(type)) {
      throw createError('Invalid feedback type', 400);
    }

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        presentationId,
        userId,
        type,
        message: message || null
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, role: true }
        }
      }
    });

    res.status(201).json({ feedback });
  } catch (error) {
    next(error);
  }
});

// Get feedback for a presentation
router.get('/:presentationId', requireRole(['ORGANIZER', 'SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId } = req.params;
    const userId = req.user!.id;

    // Verify presentation exists and user has permission to view feedback
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    // Only organizers and speakers can view feedback
    const hasPermission =
      presentation.organizerId === userId ||
      presentation.speakerId === userId;

    if (!hasPermission) {
      throw createError('Access denied', 403);
    }

    // Get all feedback for this presentation
    const feedbacks = await prisma.feedback.findMany({
      where: { presentationId },
      include: {
        user: {
          select: { id: true, username: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ feedbacks });
  } catch (error) {
    next(error);
  }
});

// Get feedback statistics
router.get('/:presentationId/stats', requireRole(['ORGANIZER', 'SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId } = req.params;
    const userId = req.user!.id;

    // Verify presentation exists and user has permission
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    const hasPermission =
      presentation.organizerId === userId ||
      presentation.speakerId === userId;

    if (!hasPermission) {
      throw createError('Access denied', 403);
    }

    // Get feedback statistics
    const feedbacks = await prisma.feedback.findMany({
      where: { presentationId },
      select: { type: true }
    });

    const stats = feedbacks.reduce((acc, feedback) => {
      acc[feedback.type] = (acc[feedback.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalFeedbacks = feedbacks.length;

    res.json({
      stats,
      totalFeedbacks,
      breakdown: Object.entries(stats).map(([type, count]) => ({
        type,
        count,
        percentage: totalFeedbacks > 0 ? Math.round((count / totalFeedbacks) * 100) : 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Delete feedback (admin only)
router.delete('/:feedbackId', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { feedbackId } = req.params;
    const userId = req.user!.id;

    // Get feedback with presentation info
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        presentation: true
      }
    });

    if (!feedback) {
      throw createError('Feedback not found', 404);
    }

    // Only organizer of the presentation can delete feedback
    if (feedback.presentation.organizerId !== userId) {
      throw createError('Access denied', 403);
    }

    await prisma.feedback.delete({
      where: { id: feedbackId }
    });

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
