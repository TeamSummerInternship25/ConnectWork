import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';

const router = express.Router();
const prisma = new PrismaClient();

// Get all users (ORGANIZER only)
router.get('/users', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // Count related records
        _count: {
          select: {
            organizedPresentations: true,
            speakerPresentations: true,
            audienceParticipations: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform data to include relationship counts
    const usersWithStats = users.map(user => ({
      ...user,
      presentationsAsOrganizer: user._count.organizedPresentations,
      presentationsAsSpeaker: user._count.speakerPresentations,
      presentationsAsAudience: user._count.audienceParticipations
    }));

    res.json({ users: usersWithStats });
  } catch (error) {
    next(error);
  }
});

// Get user by ID (ORGANIZER only)
router.get('/users/:id', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        organizedPresentations: {
          select: {
            id: true,
            title: true,
            startTime: true,
            isActive: true,
            _count: { select: { audience: true, quizzes: true } }
          }
        },
        speakerPresentations: {
          select: {
            id: true,
            title: true,
            startTime: true,
            isActive: true,
            organizer: { select: { username: true } },
            _count: { select: { audience: true, quizzes: true } }
          }
        },
        audienceParticipations: {
          select: {
            presentation: {
              select: {
                id: true,
                title: true,
                startTime: true,
                organizer: { select: { username: true } },
                speaker: { select: { username: true } }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Update user (ORGANIZER only)
router.put('/users/:id', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.params.id;
    const { email, username, role } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw createError('User not found', 404);
    }

    // Check for email/username conflicts
    const conflicts = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { email },
              { username }
            ]
          }
        ]
      }
    });

    if (conflicts) {
      throw createError('Email or username already exists', 409);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        username,
        role
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Create new user (ORGANIZER only)
router.post('/users', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password || !role) {
      throw createError('All fields are required', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      throw createError('User with this email or username already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(201).json({ user: newUser });
  } catch (error) {
    next(error);
  }
});

// Delete user (ORGANIZER only)
router.delete('/users/:id', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user!.id;

    // Prevent self-deletion
    if (userId === currentUserId) {
      throw createError('Cannot delete your own account', 400);
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Delete user (this will cascade delete related records)
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get system statistics (ORGANIZER only)
router.get('/stats', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const [
      totalUsers,
      totalPresentations,
      totalQuizzes,
      totalQuestions,
      usersByRole
    ] = await Promise.all([
      prisma.user.count(),
      prisma.presentation.count(),
      prisma.quiz.count(),
      prisma.quizQuestion.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      })
    ]);

    const roleStats = usersByRole.reduce((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as Record<string, number>);

    // Get recent presentations
    const recentPresentations = await prisma.presentation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        organizer: { select: { username: true } },
        speaker: { select: { username: true } },
        _count: { select: { audience: true, quizzes: true } }
      }
    });

    res.json({
      stats: {
        totalUsers,
        totalPresentations,
        totalQuizzes,
        totalQuestions,
        usersByRole: roleStats,
        recentPresentations
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all presentations with relationships (ORGANIZER only)
router.get('/presentations', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const presentations = await prisma.presentation.findMany({
      include: {
        organizer: { select: { id: true, username: true, email: true } },
        speaker: { select: { id: true, username: true, email: true } },
        audience: {
          include: {
            user: { select: { id: true, username: true, email: true } }
          }
        },
        quizzes: {
          include: {
            questions: true
          }
        },
        _count: { select: { audience: true, quizzes: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ presentations });
  } catch (error) {
    next(error);
  }
});

// Assign speaker to presentation (ORGANIZER only)
router.put('/presentations/:id/speaker', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const presentationId = req.params.id;
    const { speakerId } = req.body;

    // Verify speaker exists and has SPEAKER role
    const speaker = await prisma.user.findUnique({
      where: { id: speakerId }
    });

    if (!speaker) {
      throw createError('Speaker not found', 404);
    }

    if (speaker.role !== 'SPEAKER') {
      throw createError('User is not a speaker', 400);
    }

    // Update presentation
    const updatedPresentation = await prisma.presentation.update({
      where: { id: presentationId },
      data: { speakerId },
      include: {
        organizer: { select: { id: true, username: true, email: true } },
        speaker: { select: { id: true, username: true, email: true } },
        _count: { select: { audience: true, quizzes: true } }
      }
    });

    res.json({ presentation: updatedPresentation });
  } catch (error) {
    next(error);
  }
});

// Add audience member to presentation (ORGANIZER only)
router.post('/presentations/:id/audience', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const presentationId = req.params.id;
    const { userId, nickname } = req.body;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Check if already in audience
    const existingParticipation = await prisma.presentationAudience.findUnique({
      where: {
        presentationId_userId: {
          presentationId,
          userId
        }
      }
    });

    if (existingParticipation) {
      throw createError('User is already in the audience', 409);
    }

    // Add to audience
    await prisma.presentationAudience.create({
      data: {
        userId,
        presentationId,
        nickname: nickname || user.username
      }
    });

    res.json({ message: 'User added to audience successfully' });
  } catch (error) {
    next(error);
  }
});

// Remove audience member from presentation (ORGANIZER only)
router.delete('/presentations/:id/audience/:userId', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const presentationId = req.params.id;
    const userId = req.params.userId;

    await prisma.presentationAudience.delete({
      where: {
        presentationId_userId: {
          presentationId,
          userId
        }
      }
    });

    res.json({ message: 'User removed from audience successfully' });
  } catch (error) {
    next(error);
  }
});

// Get presentation relationships overview (ORGANIZER only)
router.get('/relationships', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    // Get all users grouped by role
    const speakers = await prisma.user.findMany({
      where: { role: 'SPEAKER' },
      select: {
        id: true,
        username: true,
        email: true,
        speakerPresentations: {
          select: {
            id: true,
            title: true,
            isActive: true,
            _count: { select: { audience: true } }
          }
        }
      }
    });

    const audiences = await prisma.user.findMany({
      where: { role: 'AUDIENCE' },
      select: {
        id: true,
        username: true,
        email: true,
        audienceParticipations: {
          select: {
            presentation: {
              select: {
                id: true,
                title: true,
                speaker: { select: { username: true } }
              }
            }
          }
        }
      }
    });

    const presentations = await prisma.presentation.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        isActive: true,
        organizer: { select: { id: true, username: true } },
        speaker: { select: { id: true, username: true } },
        _count: { select: { audience: true, quizzes: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    res.json({
      relationships: {
        speakers,
        audiences,
        presentations
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
