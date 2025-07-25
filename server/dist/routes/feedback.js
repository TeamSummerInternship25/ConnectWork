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
router.post('/', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const { presentationId, type, message } = req.body;
        const userId = req.user.id;
        if (!presentationId || !type) {
            throw (0, errorHandler_1.createError)('Presentation ID and type are required', 400);
        }
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId },
            include: {
                audience: true
            }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const hasAccess = presentation.organizerId === userId ||
            presentation.speakerId === userId ||
            presentation.audience.some(a => a.userId === userId);
        if (!hasAccess) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        const validTypes = ['TOO_FAST', 'TOO_SLOW', 'BORING', 'POOR_QUESTIONS', 'GENERAL'];
        if (!validTypes.includes(type)) {
            throw (0, errorHandler_1.createError)('Invalid feedback type', 400);
        }
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/:presentationId', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER']), async (req, res, next) => {
    try {
        const { presentationId } = req.params;
        const userId = req.user.id;
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const hasPermission = presentation.organizerId === userId ||
            presentation.speakerId === userId;
        if (!hasPermission) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/:presentationId/stats', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER']), async (req, res, next) => {
    try {
        const { presentationId } = req.params;
        const userId = req.user.id;
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const hasPermission = presentation.organizerId === userId ||
            presentation.speakerId === userId;
        if (!hasPermission) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        const feedbacks = await prisma.feedback.findMany({
            where: { presentationId },
            select: { type: true }
        });
        const stats = feedbacks.reduce((acc, feedback) => {
            acc[feedback.type] = (acc[feedback.type] || 0) + 1;
            return acc;
        }, {});
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
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:feedbackId', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const { feedbackId } = req.params;
        const userId = req.user.id;
        const feedback = await prisma.feedback.findUnique({
            where: { id: feedbackId },
            include: {
                presentation: true
            }
        });
        if (!feedback) {
            throw (0, errorHandler_1.createError)('Feedback not found', 404);
        }
        if (feedback.presentation.organizerId !== userId) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        await prisma.feedback.delete({
            where: { id: feedbackId }
        });
        res.json({ message: 'Feedback deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=feedback.js.map