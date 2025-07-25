import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import {
  AnalyticsResponse,
  AudienceAnalyticsResponse,
  AnalyticsSummaryResponse
} from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Get analytics for organizer
router.get('/organizer', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const organizerId = req.user!.id;

    // Get all presentations organized by this user
    const presentations = await prisma.presentation.findMany({
      where: { organizerId },
      include: {
        speaker: { select: { username: true } },
        audience: true,
        quizzes: {
          include: {
            answers: true,
            questions: true
          }
        },
        feedbacks: true
      }
    });

    const analytics = presentations.map(presentation => {
      const totalAudience = presentation.audience.length;
      const totalQuizzes = presentation.quizzes.length;

      let totalQuestions = 0;
      let totalAnswers = 0;
      let correctAnswers = 0;

      presentation.quizzes.forEach(quiz => {
        totalQuestions += quiz.questions.length;
        totalAnswers += quiz.answers.length;
        correctAnswers += quiz.answers.filter(a => a.isCorrect).length;
      });

      const feedbackSummary = {
        TOO_FAST: presentation.feedbacks.filter(f => f.type === 'TOO_FAST').length,
        TOO_SLOW: presentation.feedbacks.filter(f => f.type === 'TOO_SLOW').length,
        BORING: presentation.feedbacks.filter(f => f.type === 'BORING').length,
        POOR_QUESTIONS: presentation.feedbacks.filter(f => f.type === 'POOR_QUESTIONS').length,
        GENERAL: presentation.feedbacks.filter(f => f.type === 'GENERAL').length
      };

      return {
        id: presentation.id,
        title: presentation.title,
        speaker: presentation.speaker.username,
        startTime: presentation.startTime,
        totalAudience,
        totalQuizzes,
        totalQuestions,
        participationRate: totalQuestions > 0 ? (totalAnswers / (totalQuestions * totalAudience)) * 100 : 0,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        feedbackSummary
      };
    });

    res.json({ analytics });
  } catch (error) {
    next(error);
  }
});

// Get analytics for speaker
router.get('/speaker', requireRole(['SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const speakerId = req.user!.id;

    const presentations = await prisma.presentation.findMany({
      where: { speakerId },
      include: {
        organizer: { select: { username: true } },
        audience: true,
        quizzes: {
          include: {
            answers: true,
            questions: true
          }
        },
        feedbacks: true
      }
    });

    const analytics = presentations.map(presentation => {
      const totalAudience = presentation.audience.length;
      const totalQuizzes = presentation.quizzes.length;

      let totalQuestions = 0;
      let totalAnswers = 0;
      let correctAnswers = 0;

      presentation.quizzes.forEach(quiz => {
        totalQuestions += quiz.questions.length;
        totalAnswers += quiz.answers.length;
        correctAnswers += quiz.answers.filter(a => a.isCorrect).length;
      });

      const feedbackSummary = {
        TOO_FAST: presentation.feedbacks.filter(f => f.type === 'TOO_FAST').length,
        TOO_SLOW: presentation.feedbacks.filter(f => f.type === 'TOO_SLOW').length,
        BORING: presentation.feedbacks.filter(f => f.type === 'BORING').length,
        POOR_QUESTIONS: presentation.feedbacks.filter(f => f.type === 'POOR_QUESTIONS').length,
        GENERAL: presentation.feedbacks.filter(f => f.type === 'GENERAL').length
      };

      return {
        id: presentation.id,
        title: presentation.title,
        organizer: presentation.organizer.username,
        startTime: presentation.startTime,
        totalAudience,
        totalQuizzes,
        totalQuestions,
        participationRate: totalQuestions > 0 ? (totalAnswers / (totalQuestions * totalAudience)) * 100 : 0,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        feedbackSummary
      };
    });

    res.json({ analytics });
  } catch (error) {
    next(error);
  }
});

// Get analytics for audience member
router.get('/audience', requireRole(['AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Get all presentations this user participated in
    const participations = await prisma.presentationAudience.findMany({
      where: { userId },
      include: {
        presentation: {
          include: {
            speaker: { select: { username: true } },
            organizer: { select: { username: true } },
            quizzes: {
              include: {
                questions: true,
                answers: {
                  where: { userId }
                }
              }
            }
          }
        }
      }
    });

    const analytics = participations.map(participation => {
      const presentation = participation.presentation;
      let totalQuestions = 0;
      let answeredQuestions = 0;
      let correctAnswers = 0;

      presentation.quizzes.forEach(quiz => {
        totalQuestions += quiz.questions.length;
        const userAnswers = quiz.answers.filter(a => a.userId === userId);
        answeredQuestions += userAnswers.length;
        correctAnswers += userAnswers.filter(a => a.isCorrect).length;
      });

      return {
        presentationId: presentation.id,
        title: presentation.title,
        speaker: presentation.speaker.username,
        organizer: presentation.organizer.username,
        joinedAt: participation.joinedAt,
        totalQuizzes: presentation.quizzes.length,
        totalQuestions,
        answeredQuestions,
        correctAnswers,
        participationRate: totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0,
        accuracy: answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0
      };
    });

    // Calculate overall statistics
    const totalPresentations = analytics.length;
    const totalQuestions = analytics.reduce((sum, a) => sum + a.totalQuestions, 0);
    const totalAnswered = analytics.reduce((sum, a) => sum + a.answeredQuestions, 0);
    const totalCorrect = analytics.reduce((sum, a) => sum + a.correctAnswers, 0);
    const overallAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

    // Calculate ranking among all audience members
    const allAudienceStats = await prisma.user.findMany({
      where: { role: 'AUDIENCE' },
      include: {
        audienceParticipations: {
          include: {
            presentation: {
              include: {
                quizzes: {
                  include: {
                    questions: true,
                    answers: {
                      where: { userId: { not: undefined } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Calculate accuracy for each audience member
    const audienceRankings = allAudienceStats.map(user => {
      let userTotalQuestions = 0;
      let userTotalAnswered = 0;
      let userTotalCorrect = 0;

      user.audienceParticipations.forEach(participation => {
        participation.presentation.quizzes.forEach(quiz => {
          userTotalQuestions += quiz.questions.length;
          const userAnswers = quiz.answers.filter(a => a.userId === user.id);
          userTotalAnswered += userAnswers.length;
          userTotalCorrect += userAnswers.filter(a => a.isCorrect).length;
        });
      });

      return {
        userId: user.id,
        username: user.username,
        accuracy: userTotalAnswered > 0 ? (userTotalCorrect / userTotalAnswered) * 100 : 0,
        totalAnswered: userTotalAnswered,
        totalCorrect: userTotalCorrect
      };
    }).filter(user => user.totalAnswered > 0) // Only include users who have answered questions
      .sort((a, b) => b.accuracy - a.accuracy); // Sort by accuracy descending

    // Find current user's ranking
    const currentUserRank = audienceRankings.findIndex(user => user.userId === userId) + 1;
    const totalRankedUsers = audienceRankings.length;

    res.json({
      analytics,
      summary: {
        totalPresentations,
        totalQuestions,
        totalAnswered,
        totalCorrect,
        overallParticipationRate: totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0,
        overallAccuracy,
        ranking: {
          currentRank: currentUserRank > 0 ? currentUserRank : null,
          totalUsers: totalRankedUsers,
          percentile: currentUserRank > 0 ? Math.round(((totalRankedUsers - currentUserRank + 1) / totalRankedUsers) * 100) : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get detailed analytics for a specific presentation
router.get('/presentation/:presentationId', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId } = req.params;
    const userId = req.user!.id;

    // Verify access to this presentation
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        organizer: true,
        speaker: true,
        audience: {
          include: {
            user: { select: { id: true, username: true, email: true } }
          }
        },
        quizzes: {
          include: {
            questions: { orderBy: { order: 'asc' } },
            answers: {
              include: {
                user: { select: { id: true, username: true } },
                question: true
              }
            }
          }
        },
        feedbacks: {
          include: {
            user: { select: { id: true, username: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    // Check access permissions
    const hasAccess =
      presentation.organizerId === userId ||
      presentation.speakerId === userId ||
      presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Calculate detailed statistics
    const audienceStats = presentation.audience.map(audienceMember => {
      const userAnswers = presentation.quizzes.flatMap(quiz =>
        quiz.answers.filter(answer => answer.userId === audienceMember.userId)
      );

      const totalQuestions = presentation.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
      const answeredQuestions = userAnswers.length;
      const correctAnswers = userAnswers.filter(a => a.isCorrect).length;

      return {
        user: audienceMember.user,
        joinedAt: audienceMember.joinedAt,
        totalQuestions,
        answeredQuestions,
        correctAnswers,
        participationRate: totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0,
        accuracy: answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0
      };
    });

    const quizStats = presentation.quizzes.map(quiz => {
      const questionStats = quiz.questions.map(question => {
        const questionAnswers = quiz.answers.filter(a => a.questionId === question.id);
        const optionCounts = { A: 0, B: 0, C: 0, D: 0 };

        questionAnswers.forEach(answer => {
          if (answer.answer in optionCounts) {
            optionCounts[answer.answer as keyof typeof optionCounts]++;
          }
        });

        return {
          question: question.question,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          optionCounts,
          totalAnswers: questionAnswers.length,
          correctCount: questionAnswers.filter(a => a.isCorrect).length,
          accuracy: questionAnswers.length > 0 ? (questionAnswers.filter(a => a.isCorrect).length / questionAnswers.length) * 100 : 0
        };
      });

      const totalAnswers = quiz.answers.length;
      const correctAnswers = quiz.answers.filter(a => a.isCorrect).length;

      return {
        id: quiz.id,
        title: quiz.title,
        status: quiz.status,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        totalQuestions: quiz.questions.length,
        totalAnswers,
        correctAnswers,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        questionStats
      };
    });

    const feedbackStats = {
      total: presentation.feedbacks.length,
      byType: {
        TOO_FAST: presentation.feedbacks.filter(f => f.type === 'TOO_FAST').length,
        TOO_SLOW: presentation.feedbacks.filter(f => f.type === 'TOO_SLOW').length,
        BORING: presentation.feedbacks.filter(f => f.type === 'BORING').length,
        POOR_QUESTIONS: presentation.feedbacks.filter(f => f.type === 'POOR_QUESTIONS').length,
        GENERAL: presentation.feedbacks.filter(f => f.type === 'GENERAL').length
      },
      recent: presentation.feedbacks.slice(0, 10)
    };

    const overallStats = {
      totalAudience: presentation.audience.length,
      totalQuizzes: presentation.quizzes.length,
      totalQuestions: presentation.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0),
      totalAnswers: presentation.quizzes.reduce((sum, quiz) => sum + quiz.answers.length, 0),
      overallAccuracy: presentation.quizzes.reduce((sum, quiz) => sum + quiz.answers.length, 0) > 0
        ? (presentation.quizzes.reduce((sum, quiz) => sum + quiz.answers.filter(a => a.isCorrect).length, 0) /
          presentation.quizzes.reduce((sum, quiz) => sum + quiz.answers.length, 0)) * 100
        : 0,
      averageParticipation: audienceStats.length > 0
        ? audienceStats.reduce((sum, stat) => sum + stat.participationRate, 0) / audienceStats.length
        : 0
    };

    res.json({
      presentation: {
        id: presentation.id,
        title: presentation.title,
        description: presentation.description,
        startTime: presentation.startTime,
        endTime: presentation.endTime,
        isActive: presentation.isActive,
        organizer: presentation.organizer,
        speaker: presentation.speaker
      },
      overallStats,
      audienceStats,
      quizStats,
      feedbackStats
    });
  } catch (error) {
    next(error);
  }
});

// Get engagement trends over time
router.get('/trends/:presentationId', requireRole(['ORGANIZER', 'SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId } = req.params;
    const userId = req.user!.id;

    // Verify access
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    const hasAccess =
      presentation.organizerId === userId ||
      presentation.speakerId === userId;

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Get quiz answers over time
    const answers = await prisma.quizAnswer.findMany({
      where: {
        quiz: { presentationId }
      },
      include: {
        quiz: { select: { title: true, startTime: true } },
        question: { select: { question: true } }
      },
      orderBy: { answeredAt: 'asc' }
    });

    // Get feedback over time
    const feedbacks = await prisma.feedback.findMany({
      where: { presentationId },
      orderBy: { createdAt: 'asc' }
    });

    // Group by time intervals (e.g., 5-minute intervals)
    const timeIntervals: { [key: string]: any } = {};

    answers.forEach(answer => {
      const interval = Math.floor(new Date(answer.answeredAt).getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
      const key = new Date(interval).toISOString();

      if (!timeIntervals[key]) {
        timeIntervals[key] = {
          timestamp: key,
          answers: 0,
          correctAnswers: 0,
          feedbacks: 0
        };
      }

      timeIntervals[key].answers++;
      if (answer.isCorrect) {
        timeIntervals[key].correctAnswers++;
      }
    });

    feedbacks.forEach(feedback => {
      const interval = Math.floor(new Date(feedback.createdAt).getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
      const key = new Date(interval).toISOString();

      if (!timeIntervals[key]) {
        timeIntervals[key] = {
          timestamp: key,
          answers: 0,
          correctAnswers: 0,
          feedbacks: 0
        };
      }

      timeIntervals[key].feedbacks++;
    });

    const trends = Object.values(timeIntervals).sort((a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    res.json({ trends });
  } catch (error) {
    next(error);
  }
});

export default router;
