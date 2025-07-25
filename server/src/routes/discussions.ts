import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { getSocketIO } from '../services/socketService';

const router = express.Router();
const prisma = new PrismaClient();

// Get discussion for a quiz
router.get('/quiz/:quizId', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;

    // Verify user has access to this quiz
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        presentation: {
          include: {
            audience: true,
            organizer: true,
            speaker: true
          }
        }
      }
    });

    if (!quiz) {
      throw createError('Quiz not found', 404);
    }

    // Check if user has access to this presentation
    const userId = req.user!.id;
    const hasAccess =
      quiz.presentation.organizerId === userId ||
      quiz.presentation.speakerId === userId ||
      quiz.presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Get or create discussion
    let discussion = await prisma.discussion.findUnique({
      where: { quizId },
      include: {
        comments: {
          include: {
            user: {
              select: { id: true, username: true, role: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!discussion) {
      // Create discussion if it doesn't exist
      discussion = await prisma.discussion.create({
        data: {
          quizId,
          isActive: true
        },
        include: {
          comments: {
            include: {
              user: {
                select: { id: true, username: true, role: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    }

    res.json({ discussion });
  } catch (error) {
    next(error);
  }
});

// Post a comment to discussion
router.post('/quiz/:quizId/comments', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message || message.trim().length === 0) {
      throw createError('Message is required', 400);
    }

    if (message.length > 500) {
      throw createError('Message too long (max 500 characters)', 400);
    }

    // Verify user has access to this quiz
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        presentation: {
          include: {
            audience: true
          }
        }
      }
    });

    if (!quiz) {
      throw createError('Quiz not found', 404);
    }

    // Check if user has access to this presentation
    const hasAccess =
      quiz.presentation.organizerId === userId ||
      quiz.presentation.speakerId === userId ||
      quiz.presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Get or create discussion
    let discussion = await prisma.discussion.findUnique({
      where: { quizId }
    });

    if (!discussion) {
      discussion = await prisma.discussion.create({
        data: {
          quizId,
          isActive: true
        }
      });
    }

    if (!discussion.isActive) {
      throw createError('Discussion is closed', 403);
    }

    // Create comment
    const comment = await prisma.discussionComment.create({
      data: {
        discussionId: discussion.id,
        userId,
        message: message.trim()
      },
      include: {
        user: {
          select: { id: true, username: true, role: true }
        }
      }
    });

    // Broadcast new comment via Socket.IO
    const io = getSocketIO();
    if (io) {
      const roomName = `presentation-${quiz.presentation.id}`;
      io.to(roomName).emit('discussion-comment-added', {
        quizId,
        comment
      });
      console.log(`📡 New discussion comment broadcasted to room ${roomName}`);
    }

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

// Edit a comment
router.put('/comments/:commentId', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const { commentId } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message || message.trim().length === 0) {
      throw createError('Message is required', 400);
    }

    if (message.length > 500) {
      throw createError('Message too long (max 500 characters)', 400);
    }

    // Find comment
    const comment = await prisma.discussionComment.findUnique({
      where: { id: commentId },
      include: {
        discussion: true
      }
    });

    if (!comment) {
      throw createError('Comment not found', 404);
    }

    // Check if user owns this comment
    if (comment.userId !== userId) {
      throw createError('You can only edit your own comments', 403);
    }

    // Check if comment is within edit time limit (15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (comment.createdAt < fifteenMinutesAgo) {
      throw createError('Comment can only be edited within 15 minutes', 403);
    }

    // Update comment
    const updatedComment = await prisma.discussionComment.update({
      where: { id: commentId },
      data: { message: message.trim() },
      include: {
        user: {
          select: { id: true, username: true, role: true }
        },
        discussion: {
          include: {
            quiz: {
              select: { presentationId: true }
            }
          }
        }
      }
    });

    // Broadcast comment update via Socket.IO
    const io = getSocketIO();
    if (io) {
      const roomName = `presentation-${updatedComment.discussion.quiz.presentationId}`;
      io.to(roomName).emit('discussion-comment-updated', {
        quizId: updatedComment.discussion.quizId,
        comment: {
          id: updatedComment.id,
          discussionId: updatedComment.discussionId,
          userId: updatedComment.userId,
          message: updatedComment.message,
          createdAt: updatedComment.createdAt,
          user: updatedComment.user
        }
      });
      console.log(`📡 Discussion comment update broadcasted to room ${roomName}`);
    }

    res.json({ comment: updatedComment });
  } catch (error) {
    next(error);
  }
});

// Delete a comment
router.delete('/comments/:commentId', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Find comment
    const comment = await prisma.discussionComment.findUnique({
      where: { id: commentId },
      include: {
        discussion: {
          include: {
            quiz: {
              include: {
                presentation: true
              }
            }
          }
        }
      }
    });

    if (!comment) {
      throw createError('Comment not found', 404);
    }

    // Check permissions
    const canDelete =
      comment.userId === userId || // Own comment
      userRole === 'ORGANIZER' || // Organizer can delete any comment
      comment.discussion.quiz.presentation.organizerId === userId || // Presentation organizer
      comment.discussion.quiz.presentation.speakerId === userId; // Presentation speaker

    if (!canDelete) {
      throw createError('You do not have permission to delete this comment', 403);
    }

    // Broadcast comment deletion via Socket.IO before deleting
    const io = getSocketIO();
    if (io) {
      const roomName = `presentation-${comment.discussion.quiz.presentation.id}`;
      io.to(roomName).emit('discussion-comment-deleted', {
        quizId: comment.discussion.quizId,
        commentId: commentId
      });
      console.log(`📡 Discussion comment deletion broadcasted to room ${roomName}`);
    }

    // Delete comment
    await prisma.discussionComment.delete({
      where: { id: commentId }
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Toggle discussion active status (organizer/speaker only)
router.patch('/quiz/:quizId/toggle', requireRole(['ORGANIZER', 'SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;

    // Verify user has permission to manage this quiz
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        presentation: true
      }
    });

    if (!quiz) {
      throw createError('Quiz not found', 404);
    }

    const hasPermission =
      quiz.presentation.organizerId === userId ||
      quiz.presentation.speakerId === userId;

    if (!hasPermission) {
      throw createError('Access denied', 403);
    }

    // Get or create discussion
    let discussion = await prisma.discussion.findUnique({
      where: { quizId }
    });

    if (!discussion) {
      discussion = await prisma.discussion.create({
        data: {
          quizId,
          isActive: true
        }
      });
    } else {
      // Toggle active status
      discussion = await prisma.discussion.update({
        where: { id: discussion.id },
        data: { isActive: !discussion.isActive }
      });
    }

    res.json({ discussion });
  } catch (error) {
    next(error);
  }
});

export default router;
