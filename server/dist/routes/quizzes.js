"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const socketService_1 = require("../services/socketService");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.post('/', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), async (req, res, next) => {
    try {
        const { presentationId, title, questions, timeLimit = 10 } = req.body;
        if (!presentationId || !title || !questions || !Array.isArray(questions)) {
            throw (0, errorHandler_1.createError)('Presentation ID, title, and questions are required', 400);
        }
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const userId = req.user.id;
        if (presentation.organizerId !== userId && presentation.speakerId !== userId) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        const quiz = await prisma.quiz.create({
            data: {
                presentationId,
                title,
                timeLimit,
                questions: {
                    create: questions.map((q, index) => ({
                        question: q.question,
                        optionA: q.optionA,
                        optionB: q.optionB,
                        optionC: q.optionC,
                        optionD: q.optionD,
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation,
                        order: index
                    }))
                }
            },
            include: {
                questions: true
            }
        });
        res.status(201).json({ quiz });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const quizId = req.params.id;
        const userId = req.user.id;
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
            throw (0, errorHandler_1.createError)('Quiz not found', 404);
        }
        const hasAccess = quiz.presentation.organizerId === userId ||
            quiz.presentation.speakerId === userId ||
            quiz.presentation.audience.some(a => a.userId === userId);
        if (!hasAccess) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        res.json({ quiz });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/answer', (0, auth_1.requireRole)(['AUDIENCE']), async (req, res, next) => {
    try {
        const quizId = req.params.id;
        const { questionId, answer } = req.body;
        const userId = req.user.id;
        if (!questionId) {
            throw (0, errorHandler_1.createError)('Question ID is required', 400);
        }
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId }
        });
        if (!quiz || quiz.status !== 'ACTIVE') {
            throw (0, errorHandler_1.createError)('Quiz is not active', 400);
        }
        const question = await prisma.quizQuestion.findUnique({
            where: { id: questionId }
        });
        if (!question || question.quizId !== quizId) {
            throw (0, errorHandler_1.createError)('Question not found', 404);
        }
        const finalAnswer = answer || 'TIMEOUT';
        const isCorrect = Boolean(answer && question.correctAnswer === answer);
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
        try {
            const stats = await (0, socketService_1.calculateQuizStats)(quizId);
            const quizWithPresentation = await prisma.quiz.findUnique({
                where: { id: quizId },
                select: { presentationId: true }
            });
            if (quizWithPresentation) {
                const { getSocketIO } = require('../services/socketService');
                const io = getSocketIO();
                if (io) {
                    io.to(`presentation-${quizWithPresentation.presentationId}`).emit('quiz-stats-updated', stats);
                    console.log('📊 API route broadcasted updated stats:', stats);
                }
            }
        }
        catch (statsError) {
            console.error('❌ Failed to update quiz stats:', statsError);
        }
        res.json({
            message: 'Answer submitted successfully',
            isCorrect,
            correctAnswer: isCorrect ? undefined : question.correctAnswer
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/results', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const quizId = req.params.id;
        const userId = req.user.id;
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
            throw (0, errorHandler_1.createError)('Quiz not found', 404);
        }
        const hasAccess = quiz.presentation.organizerId === userId ||
            quiz.presentation.speakerId === userId ||
            quiz.presentation.audience.some(a => a.userId === userId);
        if (!hasAccess) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
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
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/status', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), async (req, res, next) => {
    try {
        const quizId = req.params.id;
        const { status } = req.body;
        const userId = req.user.id;
        if (!status || !['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
            throw (0, errorHandler_1.createError)('Valid status is required', 400);
        }
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                presentation: true
            }
        });
        if (!quiz) {
            throw (0, errorHandler_1.createError)('Quiz not found', 404);
        }
        const hasPermission = quiz.presentation.organizerId === userId ||
            quiz.presentation.speakerId === userId;
        if (!hasPermission) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        if (status === 'ACTIVE') {
            if (quiz.status === 'COMPLETED') {
                throw (0, errorHandler_1.createError)('Cannot restart a completed quiz', 400);
            }
            if (!quiz.presentation.isActive) {
                throw (0, errorHandler_1.createError)('Cannot start quiz: presentation is not active', 400);
            }
            const activeQuiz = await prisma.quiz.findFirst({
                where: {
                    presentationId: quiz.presentationId,
                    status: 'ACTIVE',
                    id: { not: quizId }
                }
            });
            if (activeQuiz) {
                throw (0, errorHandler_1.createError)('Cannot start quiz: another quiz is already active', 400);
            }
        }
        const updateData = { status };
        if (status === 'ACTIVE') {
            updateData.startTime = new Date();
        }
        else if (status === 'COMPLETED' || status === 'CANCELLED') {
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
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), async (req, res, next) => {
    try {
        const quizId = req.params.id;
        const userId = req.user.id;
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                presentation: true
            }
        });
        if (!quiz) {
            throw (0, errorHandler_1.createError)('Quiz not found', 404);
        }
        if (quiz.presentation.organizerId !== userId && quiz.presentation.speakerId !== userId) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        if (quiz.status === 'ACTIVE') {
            throw (0, errorHandler_1.createError)('Cannot delete an active quiz. Please end the quiz first.', 400);
        }
        await prisma.quiz.delete({
            where: { id: quizId }
        });
        res.json({
            message: 'Quiz deleted successfully',
            deletedQuizId: quizId
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=quizzes.js.map