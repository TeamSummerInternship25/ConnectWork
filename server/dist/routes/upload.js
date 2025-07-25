"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const fileProcessingService_1 = require("../services/fileProcessingService");
const aiService_1 = require("../services/aiService");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
function fixChineseFilename(filename) {
    if (!filename)
        return filename;
    try {
        if (/^[\u4e00-\u9fff\w\s\-_.()]+\.[a-zA-Z0-9]+$/.test(filename)) {
            return filename;
        }
        if (filename.includes('å') || filename.includes('è') || filename.includes('ä') ||
            filename.includes('â') || filename.includes('ã') || filename.includes('æ')) {
            console.log(`🔧 检测到编码问题，尝试修复: "${filename}"`);
            const fixes = [
                () => Buffer.from(filename, 'latin1').toString('utf8'),
                () => {
                    const bytes = [];
                    for (let i = 0; i < filename.length; i++) {
                        bytes.push(filename.charCodeAt(i) & 0xff);
                    }
                    return Buffer.from(bytes).toString('utf8');
                },
                () => {
                    try {
                        return decodeURIComponent(escape(filename));
                    }
                    catch {
                        return filename;
                    }
                },
                () => {
                    return filename
                        .replace(/â€œ/g, '"')
                        .replace(/â€/g, '"')
                        .replace(/â€™/g, "'")
                        .replace(/ä¸­/g, '中')
                        .replace(/æ–‡/g, '文')
                        .replace(/æ–‡ä»¶/g, '文件')
                        .replace(/æµ‹è¯•/g, '测试')
                        .replace(/æ–‡æ¡£/g, '文档')
                        .replace(/æ¼"ç¤º/g, '演示')
                        .replace(/æ–‡ç¨¿/g, '文稿')
                        .replace(/å°å¾/g, '地图')
                        .replace(/è¯­è¨/g, '语言')
                        .replace(/å°/g, '地')
                        .replace(/å¾/g, '图')
                        .replace(/è¯­/g, '语')
                        .replace(/è¨/g, '言');
                }
            ];
            for (const fix of fixes) {
                try {
                    const fixed = fix();
                    if (fixed && fixed !== filename && /[\u4e00-\u9fff]/.test(fixed)) {
                        console.log(`✅ 文件名修复成功: "${filename}" -> "${fixed}"`);
                        return fixed;
                    }
                }
                catch (e) {
                }
            }
            const ext = path_1.default.extname(filename);
            const safeName = `中文文件_${Date.now()}${ext}`;
            console.log(`⚠️ 无法修复文件名，使用安全名称: "${safeName}"`);
            return safeName;
        }
        return filename;
    }
    catch (error) {
        console.log('⚠️ 文件名编码修复失败:', error);
        return filename;
    }
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || './uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '50000000')
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname) {
            file.originalname = fixChineseFilename(file.originalname);
        }
        const allowedTypes = [
            'text/plain',
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'audio/mpeg',
            'audio/wav',
            'video/mp4',
            'video/avi',
            'video/quicktime'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Unsupported file type'));
        }
    }
});
router.post('/:presentationId', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), upload.single('content'), async (req, res, next) => {
    try {
        const presentationId = req.params.presentationId;
        const userId = req.user.id;
        if (!req.file) {
            throw (0, errorHandler_1.createError)('No file uploaded', 400);
        }
        if (req.file.originalname) {
            req.file.originalname = fixChineseFilename(req.file.originalname);
            console.log(`📁 处理文件: ${req.file.originalname}`);
        }
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        if (presentation.organizerId !== userId && presentation.speakerId !== userId) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        const processingResult = await fileProcessingService_1.fileProcessingService.processFile(req.file);
        if (!processingResult.success) {
            fileProcessingService_1.fileProcessingService.cleanupFile(req.file.path);
            throw (0, errorHandler_1.createError)(processingResult.error || 'File processing failed', 400);
        }
        const savedContent = await fileProcessingService_1.fileProcessingService.saveProcessedContent(presentationId, processingResult.content, req.file.path);
        console.log(`✅ 文件内容已保存到数据库: ${savedContent.id}`);
        const extractedText = processingResult.content.extractedText;
        res.status(201).json({
            message: 'File uploaded and processed successfully',
            contentId: savedContent.id,
            content: {
                originalName: processingResult.content.originalName,
                contentType: processingResult.content.contentType,
                extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
                metadata: processingResult.content.metadata
            },
            aiProcessing: {
                status: 'pending',
                message: 'AI quiz generation started in background'
            }
        });
        if (extractedText.length > 200) {
            setImmediate(async () => {
                try {
                    console.log(`🤖 开始为内容 ${savedContent.id} 生成AI题目（质量反馈闭环）...`);
                    const result = await aiService_1.aiService.generateQuizWithQualityLoop(extractedText, {
                        questionCount: 5,
                        difficulty: 'medium',
                        timeLimit: 10
                    }, 3);
                    if (result.questions.length > 0) {
                        const quiz = await prisma.quiz.create({
                            data: {
                                presentationId,
                                title: `AI生成测验: ${processingResult.content.originalName}`,
                                timeLimit: 15,
                                status: 'DRAFT'
                            }
                        });
                        const dbQuestions = aiService_1.aiService.convertToDbFormat(result.questions);
                        await Promise.all(dbQuestions.map((q, index) => prisma.quizQuestion.create({
                            data: {
                                ...q,
                                quizId: quiz.id,
                                order: index + 1
                            }
                        })));
                        console.log(`✅ AI题目生成完成 (质量反馈闭环):`);
                        console.log(`   - 测验ID: ${quiz.id}`);
                        console.log(`   - 题目数量: ${result.questions.length}`);
                        console.log(`   - 迭代次数: ${result.iterations}`);
                        console.log(`   - 最终质量评分: ${result.finalQuality.score}/10`);
                        console.log(`   - 质量可接受: ${result.finalQuality.isAcceptable}`);
                        if (result.finalQuality.issues.length > 0) {
                            console.log(`   - 质量问题: ${result.finalQuality.issues.join(', ')}`);
                        }
                    }
                    else {
                        console.log(`⚠️ 质量反馈闭环未能生成有效题目`);
                    }
                }
                catch (error) {
                    console.error(`❌ AI题目生成失败 (内容ID: ${savedContent.id}):`, error);
                    try {
                        console.log(`🔄 降级使用简单AI生成方法...`);
                        const fallbackQuestions = await aiService_1.aiService.generateQuizFromText(extractedText, {
                            questionCount: 5,
                            difficulty: 'medium'
                        });
                        if (fallbackQuestions.length > 0) {
                            const quiz = await prisma.quiz.create({
                                data: {
                                    presentationId,
                                    title: `AI生成测验(备用): ${processingResult.content.originalName}`,
                                    timeLimit: 15,
                                    status: 'DRAFT'
                                }
                            });
                            const dbQuestions = aiService_1.aiService.convertToDbFormat(fallbackQuestions);
                            await Promise.all(dbQuestions.map(q => prisma.quizQuestion.create({
                                data: {
                                    ...q,
                                    quizId: quiz.id
                                }
                            })));
                            console.log(`✅ 降级AI题目生成完成: ${quiz.id} (${fallbackQuestions.length}题)`);
                        }
                    }
                    catch (fallbackError) {
                        console.error(`❌ 降级AI生成也失败:`, fallbackError);
                    }
                }
            });
        }
        else {
            console.log(`⚠️ 文本内容太短 (${extractedText.length}字符)，跳过AI题目生成`);
        }
    }
    catch (error) {
        next(error);
    }
});
router.get('/:presentationId/contents', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), async (req, res, next) => {
    try {
        const presentationId = req.params.presentationId;
        const userId = req.user.id;
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId },
            include: {
                audience: { select: { userId: true } }
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
        const contents = await fileProcessingService_1.fileProcessingService.getPresentationContents(presentationId);
        res.json({ contents });
    }
    catch (error) {
        next(error);
    }
});
router.get('/ai-status/:presentationId', (0, auth_1.requireRole)(['SPEAKER', 'ORGANIZER']), async (req, res, next) => {
    try {
        const { presentationId } = req.params;
        const presentation = await prisma.presentation.findUnique({
            where: { id: presentationId },
            include: {
                quizzes: {
                    where: {
                        OR: [
                            {
                                title: {
                                    startsWith: 'AI生成测验:'
                                }
                            },
                            {
                                title: {
                                    startsWith: 'Auto-generated Quiz:'
                                }
                            }
                        ]
                    },
                    include: {
                        _count: {
                            select: { questions: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                contents: {
                    orderBy: { timestamp: 'desc' }
                }
            }
        });
        if (!presentation) {
            throw (0, errorHandler_1.createError)('Presentation not found', 404);
        }
        const hasAccess = req.user.role === 'ORGANIZER' ||
            presentation.speakerId === req.user.id ||
            presentation.organizerId === req.user.id;
        if (!hasAccess) {
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
        const aiStatus = presentation.contents.map(content => ({
            contentId: content.id,
            originalName: content.originalName,
            contentType: content.contentType,
            uploadTime: content.timestamp,
            hasAIQuiz: presentation.quizzes.some(quiz => quiz.title.includes(content.originalName)),
            aiQuizzes: presentation.quizzes.filter(quiz => quiz.title.includes(content.originalName)).map(quiz => ({
                quizId: quiz.id,
                title: quiz.title,
                questionCount: quiz._count.questions,
                status: quiz.status
            }))
        }));
        res.json({
            presentationId,
            aiStatus,
            totalContents: presentation.contents.length,
            totalAIQuizzes: presentation.quizzes.length
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map