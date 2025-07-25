"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.get('/users', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                createdAt: true,
                updatedAt: true,
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
        const usersWithStats = users.map(user => ({
            ...user,
            presentationsAsOrganizer: user._count.organizedPresentations,
            presentationsAsSpeaker: user._count.speakerPresentations,
            presentationsAsAudience: user._count.audienceParticipations
        }));
        res.json({ users: usersWithStats });
    }
    catch (error) {
        next(error);
    }
});
router.get('/users/:id', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
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
            throw (0, errorHandler_1.createError)('User not found', 404);
        }
        res.json({ user });
    }
    catch (error) {
        next(error);
    }
});
router.put('/users/:id', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { email, username, role } = req.body;
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!existingUser) {
            throw (0, errorHandler_1.createError)('User not found', 404);
        }
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
            throw (0, errorHandler_1.createError)('Email or username already exists', 409);
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
    }
    catch (error) {
        next(error);
    }
});
router.post('/users', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const { email, username, password, role } = req.body;
        if (!email || !username || !password || !role) {
            throw (0, errorHandler_1.createError)('All fields are required', 400);
        }
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            }
        });
        if (existingUser) {
            throw (0, errorHandler_1.createError)('User with this email or username already exists', 409);
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
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
    }
    catch (error) {
        next(error);
    }
});
router.delete('/users/:id', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const userId = req.params.id;
        const currentUserId = req.user.id;
        if (userId === currentUserId) {
            throw (0, errorHandler_1.createError)('Cannot delete your own account', 400);
        }
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw (0, errorHandler_1.createError)('User not found', 404);
        }
        await prisma.user.delete({
            where: { id: userId }
        });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/stats', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const [totalUsers, totalPresentations, totalQuizzes, totalQuestions, usersByRole] = await Promise.all([
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
        }, {});
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/presentations', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
router.put('/presentations/:id/speaker', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const presentationId = req.params.id;
        const { speakerId } = req.body;
        const speaker = await prisma.user.findUnique({
            where: { id: speakerId }
        });
        if (!speaker) {
            throw (0, errorHandler_1.createError)('Speaker not found', 404);
        }
        if (speaker.role !== 'SPEAKER') {
            throw (0, errorHandler_1.createError)('User is not a speaker', 400);
        }
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
    }
    catch (error) {
        next(error);
    }
});
router.post('/presentations/:id/audience', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const presentationId = req.params.id;
        const { userId, nickname } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw (0, errorHandler_1.createError)('User not found', 404);
        }
        const existingParticipation = await prisma.presentationAudience.findUnique({
            where: {
                presentationId_userId: {
                    presentationId,
                    userId
                }
            }
        });
        if (existingParticipation) {
            throw (0, errorHandler_1.createError)('User is already in the audience', 409);
        }
        await prisma.presentationAudience.create({
            data: {
                userId,
                presentationId,
                nickname: nickname || user.username
            }
        });
        res.json({ message: 'User added to audience successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/presentations/:id/audience/:userId', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/relationships', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map