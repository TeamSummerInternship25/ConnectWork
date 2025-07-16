import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireRole, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Update quiz question (speaker/organizer only)
router.patch('/:id', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const questionId = req.params.id;
    const userId = req.user!.id;
    const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation } = req.body;

    // Verify the question exists and user has permission
    const existingQuestion = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: {
        quiz: {
          include: {
            presentation: {
              include: {
                organizer: { select: { id: true } },
                speaker: { select: { id: true } }
              }
            }
          }
        }
      }
    });

    if (!existingQuestion) {
      throw createError('Question not found', 404);
    }

    // Check if user has permission to edit this question
    const hasPermission = 
      existingQuestion.quiz.presentation.organizerId === userId ||
      existingQuestion.quiz.presentation.speakerId === userId;

    if (!hasPermission) {
      throw createError('Access denied', 403);
    }

    // Validate required fields
    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      throw createError('All question fields are required', 400);
    }

    // Validate correct answer
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      throw createError('Correct answer must be A, B, C, or D', 400);
    }

    // Update the question
    const updatedQuestion = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        explanation: explanation || null
      }
    });

    res.json({ question: updatedQuestion });
  } catch (error) {
    next(error);
  }
});

export default router;
