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
function generatePresentationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
async function generateUniquePresentationCode() {
    let code;
    let attempts = 0;
    const maxAttempts = 10;
    do {
        code = generatePresentationCode();
        const existing = await prisma.presentation.findUnique({
            where: { code }
        });
        if (!existing) {
            return code;
        }
        attempts++;
    } while (attempts < maxAttempts);
    throw new Error('Failed to generate unique presentation code');
}
router.get('/', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        let presentations;
        if (role === 'ORGANIZER') {
            presentations = await prisma.presentation.findMany({
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
                            questions: {
                                orderBy: { order: 'asc' }
                            }
                        }
                    },
                    feedbacks: {
                        include: {
                            user: { select: { id: true, username: true, email: true } }
                        }
                    },
                    _count: { select: { audience: true, quizzes: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        else if (role === 'SPEAKER') {
            presentations = await prisma.presentation.findMany({
                where: { speakerId: userId },
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
                            questions: {
                                orderBy: { order: 'asc' }
                            }
                        }
                    },
                    feedbacks: {
                        include: {
                            user: { select: { id: true, username: true, email: true } }
                        }
                    },
                    _count: { select: { audience: true, quizzes: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        else {
            presentations = await prisma.presentation.findMany({
                where: {
                    audience: {
                        some: { userId }
                    }
                },
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
                            questions: {
                                orderBy: { order: 'asc' }
                            }
                        }
                    },
                    feedbacks: {
                        include: {
                            user: { select: { id: true, username: true, email: true } }
                        }
                    },
                    _count: { select: { audience: true, quizzes: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json({ presentations });
    }
    catch (error) {
        next(error);
    }
});
router.get('/active', (0, auth_1.requireRole)(['AUDIENCE']), async (req, res, next) => {
    try {
        const presentations = await prisma.presentation.findMany({
            where: { isActive: true },
            include: {
                organizer: { select: { id: true, username: true, email: true } },
                speaker: { select: { id: true, username: true, email: true } },
                _count: { select: { audience: true, quizzes: true } }
            },
            orderBy: { startTime: 'desc' }
        });
        res.json({ presentations });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const { title, description, startTime, speakerEmail } = req.body;
        const organizer = req.user;
        if (!title || !startTime || !speakerEmail) {
            throw (0, errorHandler_1.createError)('Title, start time, and speaker email are required', 400);
        }
        const speaker = await prisma.user.findUnique({
            where: { email: speakerEmail },
            select: { id: true, role: true }
        });
        if (!speaker) {
            throw (0, errorHandler_1.createError)('Speaker not found', 404);
        }
        if (speaker.role !== 'SPEAKER') {
            throw (0, errorHandler_1.createError)('Assigned user must have SPEAKER role', 400);
        }
        const organizerId = organizer.id;
        const speakerId = speaker.id;
        const code = await generateUniquePresentationCode();
        const presentation = await prisma.presentation.create({
            data: {
                title,
                description,
                code,
                startTime: new Date(startTime),
                organizerId,
                speakerId
            },
            include: {
                speaker: { select: { id: true, username: true, email: true } },
                organizer: { select: { id: true, username: true, email: true } }
            }
        });
        res.status(201).json({ presentation });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, auth_1.requireRole)(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req, res, next) => {
    try {
        const presentationId = req.params.id;
        const userId = req.user.id;
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId },
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
                        questions: {
                            orderBy: { order: 'asc' }
                        },
                        _count: { select: { answers: true } }
                    }
                },
                feedbacks: {
                    include: {
                        user: { select: { id: true, username: true, email: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                contents: true,
                _count: { select: { audience: true, quizzes: true } }
            }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const hasAccess = presentation.organizerId === userId ||
            presentation.speakerId === userId ||
            presentation.audience.some(a => a.userId === userId);
        if (!hasAccess) {
            console.log(`❌ Access denied for presentation ${presentationId}:`);
            console.log(`   User ID: ${userId}`);
            console.log(`   Organizer ID: ${presentation.organizerId}`);
            console.log(`   Speaker ID: ${presentation.speakerId}`);
            console.log(`   Audience IDs: [${presentation.audience.map(a => a.userId).join(', ')}]`);
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        res.json({ presentation });
    }
    catch (error) {
        next(error);
    }
});
router.get('/code/:code', (0, auth_1.requireRole)(['AUDIENCE']), async (req, res, next) => {
    try {
        const { code } = req.params;
        const presentation = await prisma.presentation.findUnique({
            where: { code: code.toUpperCase() },
            include: {
                speaker: { select: { id: true, username: true, email: true } },
                organizer: { select: { id: true, username: true, email: true } },
                _count: {
                    select: {
                        audience: true,
                        quizzes: true
                    }
                }
            }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        res.json({ presentation });
    }
    catch (error) {
        next(error);
    }
});
router.post('/code/:code/join', (0, auth_1.requireRole)(['AUDIENCE']), async (req, res, next) => {
    try {
        const { code } = req.params;
        const userId = req.user.id;
        const { nickname } = req.body;
        const presentation = await prisma.presentation.findUnique({
            where: { code: code.toUpperCase() }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const existingParticipation = await prisma.presentationAudience.findUnique({
            where: {
                presentationId_userId: {
                    presentationId: presentation.id,
                    userId
                }
            }
        });
        if (existingParticipation) {
            res.json({ message: 'Already joined this presentation', presentationId: presentation.id });
            return;
        }
        await prisma.presentationAudience.create({
            data: {
                presentationId: presentation.id,
                userId,
                nickname
            }
        });
        res.json({ message: 'Successfully joined presentation', presentationId: presentation.id });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/join', (0, auth_1.requireRole)(['AUDIENCE']), async (req, res, next) => {
    try {
        const presentationId = req.params.id;
        const userId = req.user.id;
        const { nickname } = req.body;
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
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
            res.json({ message: 'Already joined this presentation' });
            return;
        }
        await prisma.presentationAudience.create({
            data: {
                presentationId,
                userId,
                nickname
            }
        });
        res.json({ message: 'Successfully joined presentation' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/manage', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const presentations = await prisma.presentation.findMany({
            include: {
                speaker: { select: { id: true, username: true, email: true } },
                organizer: { select: { id: true, username: true, email: true } },
                _count: {
                    select: {
                        audience: true,
                        quizzes: true,
                        contents: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ presentations });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/status', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const presentation = await prisma.presentation.update({
            where: { id },
            data: { isActive },
            include: {
                speaker: { select: { id: true, username: true, email: true } },
                organizer: { select: { id: true, username: true, email: true } }
            }
        });
        res.json({ presentation });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/start', (0, auth_1.requireRole)(['SPEAKER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const speaker = req.user;
        const presentation = await prisma.presentation.findFirst({
            where: {
                id,
                speakerId: speaker.id
            }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found or access denied', 404);
        }
        const updatedPresentation = await prisma.presentation.update({
            where: { id },
            data: {
                isActive: true,
                startTime: new Date()
            },
            include: {
                organizer: true,
                speaker: true,
                _count: {
                    select: {
                        audience: true,
                        quizzes: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: { presentation: updatedPresentation },
            message: 'Presentation started successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/end', (0, auth_1.requireRole)(['SPEAKER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const speaker = req.user;
        const presentation = await prisma.presentation.findFirst({
            where: {
                id,
                speakerId: speaker.id
            }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found or access denied', 404);
        }
        const updatedPresentation = await prisma.$transaction(async (tx) => {
            await tx.quiz.updateMany({
                where: {
                    presentationId: id,
                    status: 'ACTIVE'
                },
                data: {
                    status: 'COMPLETED',
                    endTime: new Date()
                }
            });
            return await tx.presentation.update({
                where: { id },
                data: {
                    isActive: false,
                    endTime: new Date()
                },
                include: {
                    organizer: true,
                    speaker: true,
                    _count: {
                        select: {
                            audience: true,
                            quizzes: true
                        }
                    }
                }
            });
        });
        res.json({
            success: true,
            data: { presentation: updatedPresentation },
            message: 'Presentation ended successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, auth_1.requireRole)(['ORGANIZER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const organizer = req.user;
        const presentation = await prisma.presentation.findUnique({
            where: { id }
        });
        if (!presentation) {
            res.status(404).json({ error: 'Presentation not found' });
            return;
        }
        console.log(`开始删除演示 ${id} 的相关数据...`);
        const quizzes = await prisma.quiz.findMany({
            where: { presentationId: id },
            select: { id: true }
        });
        const quizIds = quizzes.map(q => q.id);
        if (quizIds.length > 0) {
            await prisma.discussionComment.deleteMany({
                where: {
                    discussion: {
                        quizId: { in: quizIds }
                    }
                }
            });
            await prisma.discussion.deleteMany({
                where: { quizId: { in: quizIds } }
            });
            await prisma.quizAnswer.deleteMany({
                where: { quizId: { in: quizIds } }
            });
            await prisma.quizQuestion.deleteMany({
                where: { quizId: { in: quizIds } }
            });
            await prisma.quiz.deleteMany({
                where: { presentationId: id }
            });
        }
        await prisma.feedback.deleteMany({
            where: { presentationId: id }
        });
        await prisma.presentationAudience.deleteMany({
            where: { presentationId: id }
        });
        await prisma.presentationContent.deleteMany({
            where: { presentationId: id }
        });
        await prisma.presentation.delete({
            where: { id }
        });
        console.log(`演示 ${id} 及其所有相关数据已成功删除`);
        res.json({ message: 'Presentation deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=presentations.js.map