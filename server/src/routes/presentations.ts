import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import {
  CreatePresentationRequest,
  PresentationResponse,
  ApiResponse
} from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// 生成6位随机演讲代码
function generatePresentationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 确保生成的代码是唯一的
async function generateUniquePresentationCode(): Promise<string> {
  let code: string;
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

// Get all presentations for current user
router.get('/', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let presentations;

    if (role === 'ORGANIZER') {
      // Organizers can see all presentations
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
    } else if (role === 'SPEAKER') {
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
    } else {
      // AUDIENCE
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
  } catch (error) {
    next(error);
  }
});

// Get all active presentations (for audience to discover and join)
router.get('/active', requireRole(['AUDIENCE']), async (req: AuthRequest, res, next) => {
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
  } catch (error) {
    next(error);
  }
});

// Create new presentation (organizer only)
router.post('/', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { title, description, startTime, speakerEmail } = req.body;
    const organizer = req.user!;

    if (!title || !startTime || !speakerEmail) {
      throw createError('Title, start time, and speaker email are required', 400);
    }

    // 查找演讲者
    const speaker = await prisma.user.findUnique({
      where: { email: speakerEmail },
      select: { id: true, role: true }
    });

    if (!speaker) {
      throw createError('Speaker not found', 404);
    }

    if (speaker.role !== 'SPEAKER') {
      throw createError('Assigned user must have SPEAKER role', 400);
    }

    const organizerId = organizer.id;
    const speakerId = speaker.id;

    // 生成唯一的演讲代码
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
  } catch (error) {
    next(error);
  }
});

// Get specific presentation
router.get('/:id', requireRole(['ORGANIZER', 'SPEAKER', 'AUDIENCE']), async (req: AuthRequest, res, next) => {
  try {
    const presentationId = req.params.id;
    const userId = req.user!.id;

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
      throw createError('Presentation not found', 404);
    }

    // Check if user has access to this presentation
    const hasAccess =
      presentation.organizerId === userId ||
      presentation.speakerId === userId ||
      presentation.audience.some(a => a.userId === userId);

    if (!hasAccess) {
      console.log(`❌ Access denied for presentation ${presentationId}:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Organizer ID: ${presentation.organizerId}`);
      console.log(`   Speaker ID: ${presentation.speakerId}`);
      console.log(`   Audience IDs: [${presentation.audience.map(a => a.userId).join(', ')}]`);
      throw createError('Access denied', 403);
    }

    res.json({ presentation });
  } catch (error) {
    next(error);
  }
});

// Find presentation by code
router.get('/code/:code', requireRole(['AUDIENCE']), async (req: AuthRequest, res, next) => {
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
      throw createError('Presentation not found', 404);
    }

    res.json({ presentation });
  } catch (error) {
    next(error);
  }
});

// Join presentation by code
router.post('/code/:code/join', requireRole(['AUDIENCE']), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { code } = req.params;
    const userId = req.user!.id;
    const { nickname } = req.body;

    const presentation = await prisma.presentation.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    // Check if already joined
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
  } catch (error) {
    next(error);
  }
});

// Join presentation as audience (by ID - legacy)
router.post('/:id/join', requireRole(['AUDIENCE']), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const presentationId = req.params.id;
    const userId = req.user!.id;
    const { nickname } = req.body;

    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      throw createError('Presentation not found', 404);
    }

    // Check if already joined
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
  } catch (error) {
    next(error);
  }
});

// 组织者管理演讲 - 获取所有演讲进行管理
router.get('/manage', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
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
  } catch (error) {
    next(error);
  }
});

// 组织者更新演讲状态
router.patch('/:id/status', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
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
  } catch (error) {
    next(error);
  }
});

// Start presentation (speaker only)
router.post('/:id/start', requireRole(['SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const speaker = req.user!;

    // 验证演讲存在且属于该演讲者
    const presentation = await prisma.presentation.findFirst({
      where: {
        id,
        speakerId: speaker.id
      }
    });

    if (!presentation) {
      throw createError('Presentation not found or access denied', 404);
    }

    // 启动演讲
    const updatedPresentation = await prisma.presentation.update({
      where: { id },
      data: {
        isActive: true,
        startTime: new Date() // 更新实际开始时间
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
  } catch (error) {
    next(error);
  }
});

// End presentation (speaker only)
router.post('/:id/end', requireRole(['SPEAKER']), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const speaker = req.user!;

    // 验证演讲存在且属于该演讲者
    const presentation = await prisma.presentation.findFirst({
      where: {
        id,
        speakerId: speaker.id
      }
    });

    if (!presentation) {
      throw createError('Presentation not found or access denied', 404);
    }

    // 结束演讲并自动结束所有活跃测验
    const updatedPresentation = await prisma.$transaction(async (tx) => {
      // 首先结束所有活跃的测验
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

      // 然后结束演讲
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
  } catch (error) {
    next(error);
  }
});

// 删除演讲 (只有组织者可以删除演讲)
router.delete('/:id', requireRole(['ORGANIZER']), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const organizer = req.user!;

    // 验证演讲存在
    const presentation = await prisma.presentation.findUnique({
      where: { id }
    });

    if (!presentation) {
      res.status(404).json({ error: 'Presentation not found' });
      return;
    }

    // 删除相关数据 - 按照外键依赖顺序删除
    console.log(`开始删除演示 ${id} 的相关数据...`);

    // 1. 获取所有相关的测验ID
    const quizzes = await prisma.quiz.findMany({
      where: { presentationId: id },
      select: { id: true }
    });
    const quizIds = quizzes.map(q => q.id);

    if (quizIds.length > 0) {
      // 2. 保留讨论数据，但断开与测验的关联
      // 这样用户的讨论内容不会丢失
      await prisma.discussion.updateMany({
        where: { quizId: { in: quizIds } },
        data: {
          quizId: null as any, // 断开与测验的关联
          isActive: false // 设置为非活跃状态
        }
      });

      // 4. 删除测验答案
      await prisma.quizAnswer.deleteMany({
        where: { quizId: { in: quizIds } }
      });

      // 5. 删除测验题目
      await prisma.quizQuestion.deleteMany({
        where: { quizId: { in: quizIds } }
      });

      // 6. 删除测验
      await prisma.quiz.deleteMany({
        where: { presentationId: id }
      });
    }

    // 7. 删除反馈
    await prisma.feedback.deleteMany({
      where: { presentationId: id }
    });

    // 8. 删除演示听众关系
    await prisma.presentationAudience.deleteMany({
      where: { presentationId: id }
    });

    // 9. 删除演示内容
    await prisma.presentationContent.deleteMany({
      where: { presentationId: id }
    });

    // 10. 最后删除演示
    await prisma.presentation.delete({
      where: { id }
    });

    console.log(`演示 ${id} 及其所有相关数据已成功删除`);

    res.json({ message: 'Presentation deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
