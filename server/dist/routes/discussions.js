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
router.get('/quiz/:quizId', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const { quizId } = req.params;
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
            throw (0, errorHandler_1.createError)('Quiz not found', 404);
        }
        const userId = req.user.id;
        const hasAccess = quiz.presentation.organizerId === userId ||
            quiz.presentation.speakerId === userId ||
            quiz.presentation.audience.some(a => a.userId === userId);
        if (!hasAccess) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
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
    }
    catch (error) {
        next(error);
    }
});
router.post('/quiz/:quizId/comments', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const { quizId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;
        if (!message || message.trim().length === 0) {
            throw (0, errorHandler_1.createError)('Message is required', 400);
        }
        if (message.length > 500) {
            throw (0, errorHandler_1.createError)('Message too long (max 500 characters)', 400);
        }
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
            throw (0, errorHandler_1.createError)('Quiz not found', 404);
        }
        const hasAccess = quiz.presentation.organizerId === userId ||
            quiz.presentation.speakerId === userId ||
            quiz.presentation.audience.some(a => a.userId === userId);
        if (!hasAccess) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
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
            throw (0, errorHandler_1.createError)('Discussion is closed', 403);
        }
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
        res.status(201).json({ comment });
    }
    catch (error) {
        next(error);
    }
});
router.put('/comments/:commentId', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;
        if (!message || message.trim().length === 0) {
            throw (0, errorHandler_1.createError)('Message is required', 400);
        }
        if (message.length > 500) {
            throw (0, errorHandler_1.createError)('Message too long (max 500 characters)', 400);
        }
        const comment = await prisma.discussionComment.findUnique({
            where: { id: commentId },
            include: {
                discussion: true
            }
        });
        if (!comment) {
            throw (0, errorHandler_1.createError)('Comment not found', 404);
        }
        if (comment.userId !== userId) {
            throw (0, errorHandler_1.createError)('You can only edit your own comments', 403);
        }
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (comment.createdAt < fifteenMinutesAgo) {
            throw (0, errorHandler_1.createError)('Comment can only be edited within 15 minutes', 403);
        }
        const updatedComment = await prisma.discussionComment.update({
            where: { id: commentId },
            data: { message: message.trim() },
            include: {
                user: {
                    select: { id: true, username: true, role: true }
                }
            }
        });
        res.json({ comment: updatedComment });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/comments/:commentId', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
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
            throw (0, errorHandler_1.createError)('Comment not found', 404);
        }
        const canDelete = comment.userId === userId ||
            userRole === 'ORGANIZER' ||
            comment.discussion.quiz.presentation.organizerId === userId ||
            comment.discussion.quiz.presentation.speakerId === userId;
        if (!canDelete) {
            throw (0, errorHandler_1.createError)('You do not have permission to delete this comment', 403);
        }
        await prisma.discussionComment.delete({
            where: { id: commentId }
        });
        res.json({ message: 'Comment deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/quiz/:quizId/toggle', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER']), async (req, res, next) => {
    try {
        const { quizId } = req.params;
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
        const hasPermission = quiz.presentation.organizerId === userId ||
            quiz.presentation.speakerId === userId;
        if (!hasPermission) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
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
        else {
            discussion = await prisma.discussion.update({
                where: { id: discussion.id },
                data: { isActive: !discussion.isActive }
            });
        }
        res.json({ discussion });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=discussions.js.map