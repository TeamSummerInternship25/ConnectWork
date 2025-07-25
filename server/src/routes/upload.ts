import express from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { fileProcessingService } from '../services/fileProcessingService';
import { aiService } from '../services/aiService';

const router = express.Router();
const prisma = new PrismaClient();

// 修复中文文件名编码的函数
function fixChineseFilename(filename: string): string {
  if (!filename) return filename;

  try {
    // 如果文件名已经是正常的中文，直接返回
    if (/^[\u4e00-\u9fff\w\s\-_.()]+\.[a-zA-Z0-9]+$/.test(filename)) {
      return filename;
    }

    // 检测并修复常见的编码问题
    if (filename.includes('å') || filename.includes('è') || filename.includes('ä') ||
      filename.includes('â') || filename.includes('ã') || filename.includes('æ')) {
      console.log(`🔧 检测到编码问题，尝试修复: "${filename}"`);

      // 尝试不同的修复方案
      const fixes = [
        // 方案1: 直接从latin1转utf8
        () => Buffer.from(filename, 'latin1').toString('utf8'),
        // 方案2: 先转为二进制再转utf8
        () => {
          const bytes = [];
          for (let i = 0; i < filename.length; i++) {
            bytes.push(filename.charCodeAt(i) & 0xff);
          }
          return Buffer.from(bytes).toString('utf8');
        },
        // 方案3: URL解码
        () => {
          try {
            return decodeURIComponent(escape(filename));
          } catch {
            return filename;
          }
        },
        // 方案4: 处理特定的乱码模式
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
          // 检查修复结果
          if (fixed && fixed !== filename && /[\u4e00-\u9fff]/.test(fixed)) {
            console.log(`✅ 文件名修复成功: "${filename}" -> "${fixed}"`);
            return fixed;
          }
        } catch (e) {
          // 继续尝试下一种方案
        }
      }

      // 如果所有方案都失败，生成一个安全的文件名
      const ext = path.extname(filename);
      const safeName = `中文文件_${Date.now()}${ext}`;
      console.log(`⚠️ 无法修复文件名，使用安全名称: "${safeName}"`);
      return safeName;
    }

    return filename;
  } catch (error) {
    console.log('⚠️ 文件名编码修复失败:', error);
    return filename;
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '50000000') // 50MB default
  },
  fileFilter: (req, file, cb) => {
    // 修复中文文件名编码问题
    if (file.originalname) {
      file.originalname = fixChineseFilename(file.originalname);
    }

    // Allow specific file types
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
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

// Upload content for presentation
router.post('/:presentationId',
  requireRole(['SPEAKER', 'ORGANIZER']),
  upload.single('content'),
  async (req: AuthRequest, res, next) => {
    try {
      const presentationId = req.params.presentationId;
      const userId = req.user!.id;

      if (!req.file) {
        throw createError('No file uploaded', 400);
      }

      // 再次确保文件名编码正确（双重保险）
      if (req.file.originalname) {
        req.file.originalname = fixChineseFilename(req.file.originalname);
        console.log(`📁 处理文件: ${req.file.originalname}`);
      }

      // Verify user has access to this presentation
      const presentation = await prisma.presentation.findUnique({
        where: { id: presentationId }
      });

      if (!presentation) {
        throw createError('Presentation not found', 404);
      }

      if (presentation.organizerId !== userId && presentation.speakerId !== userId) {
        throw createError('Access denied', 403);
      }

      // TODO: Process file based on type and extract text
      // This is a placeholder - actual implementation would use:
      // - pdf-parse for PDFs
      // - mammoth for PowerPoint
      // - Whisper API for audio/video
      // - OCR for video with text content

      // Process file using file processing service
      const processingResult = await fileProcessingService.processFile(req.file);

      if (!processingResult.success) {
        // Clean up uploaded file
        fileProcessingService.cleanupFile(req.file.path);
        throw createError(processingResult.error || 'File processing failed', 400);
      }

      // 第一步：保存处理结果到数据库
      const savedContent = await fileProcessingService.saveProcessedContent(
        presentationId,
        processingResult.content!,
        req.file.path
      );

      console.log(`✅ 文件内容已保存到数据库: ${savedContent.id}`);

      // 第二步：异步处理AI生成题目（不阻塞响应）
      const extractedText = processingResult.content!.extractedText;

      // 立即返回文件上传成功的响应
      res.status(201).json({
        message: 'File uploaded and processed successfully',
        contentId: savedContent.id,
        content: {
          originalName: processingResult.content!.originalName,
          contentType: processingResult.content!.contentType,
          extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
          metadata: processingResult.content!.metadata
        },
        aiProcessing: {
          status: 'pending',
          message: 'AI quiz generation started in background'
        }
      });

      // 第三步：后台异步生成AI题目（使用质量反馈闭环）
      if (extractedText.length > 200) {
        setImmediate(async () => {
          try {
            console.log(`🤖 开始为内容 ${savedContent.id} 生成AI题目（质量反馈闭环）...`);

            // 使用质量反馈闭环生成高质量题目
            const result = await aiService.generateQuizWithQualityLoop(extractedText, {
              questionCount: 5,
              difficulty: 'medium',
              timeLimit: 10
            }, 3); // 最多3轮改进

            if (result.questions.length > 0) {
              // 创建测验
              const quiz = await prisma.quiz.create({
                data: {
                  presentationId,
                  title: `AI生成测验: ${processingResult.content!.originalName}`,
                  timeLimit: 15,
                  status: 'DRAFT'
                }
              });

              // 添加题目
              const dbQuestions = aiService.convertToDbFormat(result.questions);
              await Promise.all(
                dbQuestions.map((q, index) =>
                  prisma.quizQuestion.create({
                    data: {
                      ...q,
                      quizId: quiz.id,
                      order: index + 1  // 确保order字段正确设置
                    }
                  })
                )
              );

              console.log(`✅ AI题目生成完成 (质量反馈闭环):`);
              console.log(`   - 测验ID: ${quiz.id}`);
              console.log(`   - 题目数量: ${result.questions.length}`);
              console.log(`   - 迭代次数: ${result.iterations}`);
              console.log(`   - 最终质量评分: ${result.finalQuality.score}/10`);
              console.log(`   - 质量可接受: ${result.finalQuality.isAcceptable}`);

              if (result.finalQuality.issues.length > 0) {
                console.log(`   - 质量问题: ${result.finalQuality.issues.join(', ')}`);
              }

              // TODO: 可以将质量评估结果存储到数据库
              // TODO: 可以通过WebSocket通知前端AI处理完成，包含质量信息
              // 或者前端可以轮询获取最新的测验列表
            } else {
              console.log(`⚠️ 质量反馈闭环未能生成有效题目`);
            }
          } catch (error) {
            console.error(`❌ AI题目生成失败 (内容ID: ${savedContent.id}):`, error);

            // 降级：尝试使用简单生成方法
            try {
              console.log(`🔄 降级使用简单AI生成方法...`);
              const fallbackQuestions = await aiService.generateQuizFromText(extractedText, {
                questionCount: 5,
                difficulty: 'medium'
              });

              if (fallbackQuestions.length > 0) {
                const quiz = await prisma.quiz.create({
                  data: {
                    presentationId,
                    title: `AI生成测验(备用): ${processingResult.content!.originalName}`,
                    timeLimit: 15,
                    status: 'DRAFT'
                  }
                });

                const dbQuestions = aiService.convertToDbFormat(fallbackQuestions);
                await Promise.all(
                  dbQuestions.map(q =>
                    prisma.quizQuestion.create({
                      data: {
                        ...q,
                        quizId: quiz.id
                      }
                    })
                  )
                );

                console.log(`✅ 降级AI题目生成完成: ${quiz.id} (${fallbackQuestions.length}题)`);
              }
            } catch (fallbackError) {
              console.error(`❌ 降级AI生成也失败:`, fallbackError);
            }

            // TODO: 可以通过WebSocket通知前端AI处理失败
            // 或者在数据库中记录处理状态
          }
        });
      } else {
        console.log(`⚠️ 文本内容太短 (${extractedText.length}字符)，跳过AI题目生成`);
      }


    } catch (error) {
      next(error);
    }
  }
);

// Get uploaded content for a presentation
router.get('/:presentationId/contents', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const presentationId = req.params.presentationId;
    const userId = req.user!.id;

    // Verify access
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        audience: { select: { userId: true } }
      }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    const hasAccess =
      presentation.organizerId === userId ||
      presentation.speakerId === userId ||
      presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Get all content for this presentation using file processing service
    const contents = await fileProcessingService.getPresentationContents(presentationId);

    res.json({ contents });
  } catch (error) {
    next(error);
  }
});

// Delete uploaded content
router.delete('/content/:contentId', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { contentId } = req.params;
    const userId = req.user!.id;

    // Get content and verify access
    const content = await prisma.presentationContent.findUnique({
      where: { id: contentId },
      include: {
        presentation: true
      }
    });

    if (!content) {
      throw createError('Content not found', 404);
    }

    // Check if user has access to this presentation
    const hasAccess =
      content.presentation.organizerId === userId ||
      content.presentation.speakerId === userId;

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Delete the file from filesystem
    if (content.filePath) {
      fileProcessingService.cleanupFile(content.filePath);
    }

    // Delete from database
    await prisma.presentationContent.delete({
      where: { id: contentId }
    });

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// 获取演讲的AI处理状态
router.get('/ai-status/:presentationId', requireRole(['SPEAKER', 'ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { presentationId } = req.params;

    // 检查用户是否有权限访问这个演讲
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
      throw createError('Presentation not found', 404);
    }

    // 检查权限
    const hasAccess = req.user!.role === 'ORGANIZER' ||
      presentation.speakerId === req.user!.id ||
      presentation.organizerId === req.user!.id;

    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // 返回AI处理状态
    const aiStatus = presentation.contents.map(content => ({
      contentId: content.id,
      originalName: content.originalName,
      contentType: content.contentType,
      uploadTime: content.timestamp,
      hasAIQuiz: presentation.quizzes.some(quiz =>
        quiz.title.includes(content.originalName)
      ),
      aiQuizzes: presentation.quizzes.filter(quiz =>
        quiz.title.includes(content.originalName)
      ).map(quiz => ({
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

  } catch (error) {
    next(error);
  }
});

export default router;
