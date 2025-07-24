import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { calculateQuizStats } from '../services/socketService';

const router = express.Router();
const prisma = new PrismaClient();

// Create quiz (speaker/organizer only) - placeholder for AI generation
router.post('/', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId, title, questions, timeLimit = 10 } = req.body;

    if (!presentationId || !title || !questions || !Array.isArray(questions)) {
      throw createError('Presentation ID, title, and questions are required', 400);
    }

    // Verify user has access to this presentation
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    const userId = req.user!.id;
    if (presentation.organizerId !== userId && presentation.speakerId !== userId) {
      throw createError('Access denied', 403);
    }

    // Create quiz with questions
    const quiz = await prisma.quiz.create({
      data: {
        presentationId,
        title,
        timeLimit,
        questions: {
          create: questions.map((q: any, index: number) => ({
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            order: index + 1
          }))
        }
      },
      include: {
        questions: true
      }
    });

    res.status(201).json({ quiz });
  } catch (error) {
    next(error);
  }
});

// Get quiz details
router.get('/:id', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const quizId = req.params.id;
    const userId = req.user!.id;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true,
        presentation: {
          include: {
            organizer: { select: { id: true } },
            speaker: { select: { id: true } },
            audience: { select: { userId: true } }
          }
        }
      }
    });

    if (!quiz) {
      throw createError('Quiz not found', 404);
    }

    // Check access
    const hasAccess =
      quiz.presentation.organizerId === userId ||
      quiz.presentation.speakerId === userId ||
      quiz.presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    res.json({ quiz });
  } catch (error) {
    next(error);
  }
});

// Submit quiz answer
router.post('/:id/answer', requireRole(['AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const quizId = req.params.id;
    const { questionId, answer } = req.body;
    const userId = req.user!.id;

    if (!questionId) {
      throw createError('Question ID is required', 400);
    }

    // Verify quiz is active
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz || quiz.status !== 'ACTIVE') {
      throw createError('Quiz is not active', 400);
    }

    // Get question to check correct answer
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId }
    });

    if (!question || question.quizId !== quizId) {
      throw createError('Question not found', 404);
    }

    // 处理答案：空答案表示超时，算错误
    const finalAnswer = answer || 'TIMEOUT';
    const isCorrect = Boolean(answer && question.correctAnswer === answer);

    // Save answer
    const quizAnswer = await prisma.quizAnswer.upsert({
      where: {
        questionId_userId: {
          questionId,
          userId
        }
      },
      update: {
        answer: finalAnswer,
        isCorrect
      },
      create: {
        quizId,
        questionId,
        userId,
        answer: finalAnswer,
        isCorrect
      }
    });

    // 计算并广播更新的统计数据
    try {
      const stats = await calculateQuizStats(quizId);

      // 获取演示ID用于Socket广播
      const quizWithPresentation = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: { presentationId: true }
      });

      if (quizWithPresentation) {
        // 导入Socket.io实例进行广播
        const { getSocketIO } = require('../services/socketService');
        const io = getSocketIO();
        if (io) {
          io.to(`presentation-${quizWithPresentation.presentationId}`).emit('quiz-stats-updated', stats);
          console.log('📊 API route broadcasted updated stats:', stats);
        }
      }
    } catch (statsError) {
      console.error('❌ Failed to update quiz stats:', statsError);
      // 不影响答案提交的成功响应
    }

    res.json({
      message: 'Answer submitted successfully',
      isCorrect,
      correctAnswer: isCorrect ? undefined : question.correctAnswer
    });
  } catch (error) {
    next(error);
  }
});

// Get quiz results/statistics
router.get('/:id/results', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const quizId = req.params.id;
    const userId = req.user!.id;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        presentation: {
          include: {
            organizer: { select: { id: true } },
            speaker: { select: { id: true } },
            audience: { select: { userId: true } }
          }
        },
        questions: true,
        answers: {
          include: {
            user: { select: { id: true, username: true } }
          }
        }
      }
    });

    if (!quiz) {
      throw createError('Quiz not found', 404);
    }

    // Check access
    const hasAccess =
      quiz.presentation.organizerId === userId ||
      quiz.presentation.speakerId === userId ||
      quiz.presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Calculate statistics
    const totalQuestions = quiz.questions.length;
    const totalParticipants = quiz.presentation.audience.length;
    const answeredParticipants = new Set(quiz.answers.map(a => a.userId)).size;
    const correctAnswers = quiz.answers.filter(a => a.isCorrect).length;
    const totalAnswers = quiz.answers.length;

    const questionStats = quiz.questions.map(question => {
      const questionAnswers = quiz.answers.filter(a => a.questionId === question.id);
      const optionCounts = {
        A: questionAnswers.filter(a => a.answer === 'A').length,
        B: questionAnswers.filter(a => a.answer === 'B').length,
        C: questionAnswers.filter(a => a.answer === 'C').length,
        D: questionAnswers.filter(a => a.answer === 'D').length
      };

      return {
        question: question.question,
        correctAnswer: question.correctAnswer,
        optionCounts,
        totalAnswers: questionAnswers.length,
        correctCount: questionAnswers.filter(a => a.isCorrect).length
      };
    });

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        status: quiz.status
      },
      statistics: {
        totalQuestions,
        totalParticipants,
        answeredParticipants,
        participationRate: totalParticipants > 0 ? (answeredParticipants / totalParticipants) * 100 : 0,
        overallAccuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        questionStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update quiz status (speaker/organizer only)
router.patch('/:id/status', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const quizId = req.params.id;
    const { status } = req.body;
    const userId = req.user!.id;

    if (!status || !['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw createError('Valid status is required', 400);
    }

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

    // Additional checks for ACTIVE status
    if (status === 'ACTIVE') {
      // Prevent restarting completed quizzes
      if (quiz.status === 'COMPLETED') {
        throw createError('Cannot restart a completed quiz', 400);
      }

      // Check if presentation is active
      if (!quiz.presentation.isActive) {
        throw createError('Cannot start quiz: presentation is not active', 400);
      }

      // Check if there's already an active quiz in this presentation
      const activeQuiz = await prisma.quiz.findFirst({
        where: {
          presentationId: quiz.presentationId,
          status: 'ACTIVE',
          id: { not: quizId } // Exclude current quiz
        }
      });

      if (activeQuiz) {
        throw createError('Cannot start quiz: another quiz is already active', 400);
      }
    }

    // Update quiz status with timestamps
    const updateData: any = { status };

    if (status === 'ACTIVE') {
      updateData.startTime = new Date();
    } else if (status === 'COMPLETED' || status === 'CANCELLED') {
      updateData.endTime = new Date();
    }

    const updatedQuiz = await prisma.quiz.update({
      where: { id: quizId },
      data: updateData,
      include: {
        questions: true,
        presentation: true
      }
    });

    res.json({ quiz: updatedQuiz });
  } catch (error) {
    next(error);
  }
});

// Delete quiz (speaker/organizer only)
router.delete('/:id', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const quizId = req.params.id;
    const userId = req.user!.id;

    // Find the quiz and verify access
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        presentation: true
      }
    });

    if (!quiz) {
      throw createError('Quiz not found', 404);
    }

    // Check if user has access to this quiz
    if (quiz.presentation.organizerId !== userId && quiz.presentation.speakerId !== userId) {
      throw createError('Access denied', 403);
    }

    // Check if quiz is currently active
    if (quiz.status === 'ACTIVE') {
      throw createError('无法删除正在进行的测验。请先在演示页面点击"结束测验"按钮，然后再尝试删除。', 400);
    }

    // Delete the quiz (this will cascade delete questions and responses)
    await prisma.quiz.delete({
      where: { id: quizId }
    });

    res.json({
      message: 'Quiz deleted successfully',
      deletedQuizId: quizId
    });
  } catch (error) {
    next(error);
  }
});

export default router;
