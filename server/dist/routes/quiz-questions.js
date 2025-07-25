"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.patch('/:id', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), async (req, res, next) => {
    try {
        const questionId = req.params.id;
        const userId = req.user.id;
        const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation } = req.body;
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
            throw (0, errorHandler_1.createError)('Question not found', 404);
        }
        const hasPermission = existingQuestion.quiz.presentation.organizerId === userId ||
            existingQuestion.quiz.presentation.speakerId === userId;
        if (!hasPermission) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
            throw (0, errorHandler_1.createError)('All question fields are required', 400);
        }
        if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
            throw (0, errorHandler_1.createError)('Correct answer must be A, B, C, or D', 400);
        }
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=quiz-questions.js.map