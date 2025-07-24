import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// 定义Quiz状态类型
interface QuizState {
  currentQuestionIndex: number;
  lastUpdated: Date;
}

// 扩展global类型
declare global {
  var quizStates: Map<string, QuizState> | undefined;
}

const prisma = new PrismaClient();

// 全局Socket.io实例
let socketIOInstance: Server | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  username?: string;
}

// 计算Quiz统计数据
export async function calculateQuizStats(quizId: string) {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            answers: true
          }
        },
        answers: true
      }
    });

    if (!quiz) {
      return { totalParticipants: 0, totalAnswers: 0, questionStats: [] };
    }

    // 计算总参与人数（有答案的用户数）
    const uniqueParticipants = new Set(quiz.answers.map(a => a.userId));
    const totalParticipants = uniqueParticipants.size;

    // 计算每个问题的统计
    const questionStats = quiz.questions.map(question => {
      const questionAnswers = question.answers;
      const totalAnswers = questionAnswers.length;
      const correctCount = questionAnswers.filter(a => a.isCorrect).length;

      // 计算选项分布
      const optionCounts = { A: 0, B: 0, C: 0, D: 0 };
      questionAnswers.forEach(answer => {
        if (answer.answer === 'A') optionCounts.A++;
        else if (answer.answer === 'B') optionCounts.B++;
        else if (answer.answer === 'C') optionCounts.C++;
        else if (answer.answer === 'D') optionCounts.D++;
        // TIMEOUT答案不计入选项统计
      });

      return {
        questionId: question.id,
        question: question.question,
        correctAnswer: question.correctAnswer,
        optionCounts,
        totalAnswers,
        correctCount,
        accuracy: totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0
      };
    });

    const totalAnswers = quiz.answers.length;
    const totalCorrect = quiz.answers.filter(a => a.isCorrect).length;
    const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

    return {
      totalParticipants,
      totalAnswers,
      averageScore: overallAccuracy, // 添加averageScore字段
      overallAccuracy,
      questionStats
    };
  } catch (error) {
    console.error('Error calculating quiz stats:', error);
    return { totalParticipants: 0, totalAnswers: 0, questionStats: [] };
  }
}

export const initializeSocket = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // 保存Socket.io实例
  socketIOInstance = io;

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return next(new Error('JWT secret not configured'));
      }

      const decoded = jwt.verify(token, jwtSecret) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, username: true }
      });

      if (!user) {
        return next(new Error('Authentication error'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.username = user.username;

      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`👤 User ${socket.username} (${socket.userRole}) connected`);

    // Join presentation room
    socket.on('join-presentation', (presentationId: string) => {
      const roomName = `presentation-${presentationId}`;
      socket.join(roomName);
      console.log(`👤 ${socket.username} (${socket.userRole}) joined room: ${roomName}`);

      // 获取房间内的用户数量
      const room = io.sockets.adapter.rooms.get(roomName);
      const userCount = room ? room.size : 0;
      console.log(`🏠 房间 ${roomName} 当前用户数: ${userCount}`);
    });

    // Leave presentation room
    socket.on('leave-presentation', (presentationId: string) => {
      socket.leave(`presentation-${presentationId}`);
      console.log(`👤 ${socket.username} left presentation ${presentationId}`);
    });

    // Quiz events
    socket.on('start-quiz', async (data: { quizId: string; presentationId: string; questionIndex?: number }) => {
      try {
        // Broadcast quiz start to all participants in the presentation
        const quiz = await prisma.quiz.findUnique({
          where: { id: data.quizId },
          include: { questions: { orderBy: { order: 'asc' } } }
        });

        if (quiz) {
          const startIndex = data.questionIndex || 0;

          // 初始化Quiz状态
          if (!global.quizStates) {
            global.quizStates = new Map();
          }
          global.quizStates.set(data.quizId, {
            currentQuestionIndex: startIndex,
            lastUpdated: new Date()
          });

          io.to(`presentation-${data.presentationId}`).emit('quiz-started', {
            quiz,
            timeLimit: quiz.timeLimit,
            questionIndex: startIndex
          });
          console.log(`🎯 Quiz ${data.quizId} started in presentation ${data.presentationId} at question ${startIndex}`);
        }
      } catch (error) {
        console.error('Failed to start quiz:', error);
      }
    });

    socket.on('end-quiz', (data: { quizId: string; presentationId: string }) => {
      // 清除Quiz状态
      if (global.quizStates) {
        global.quizStates.delete(data.quizId);
      }

      // Broadcast quiz end to all participants
      io.to(`presentation-${data.presentationId}`).emit('quiz-ended', { quizId: data.quizId });
      console.log(`🏁 Quiz ${data.quizId} ended in presentation ${data.presentationId}`);
    });

    // 获取Quiz当前状态
    socket.on('get-quiz-state', (data: { quizId: string }, callback) => {
      const state = global.quizStates?.get(data.quizId);
      if (state) {
        console.log(`📊 Quiz ${data.quizId} current state:`, state);
        callback({ success: true, state });
      } else {
        console.log(`❓ No state found for quiz ${data.quizId}`);
        callback({ success: false, state: null });
      }
    });

    // Sync question state (for audience to get current state without triggering navigation)
    socket.on('sync-question-state', (data: { quizId: string }, callback) => {
      const state = global.quizStates?.get(data.quizId);
      if (state) {
        console.log(`🔄 Syncing quiz state for ${socket.username}:`, {
          quizId: data.quizId,
          currentQuestionIndex: state.currentQuestionIndex
        });

        callback({
          success: true,
          questionIndex: state.currentQuestionIndex,
          quizId: data.quizId
        });
      } else {
        console.log(`❓ Quiz ${data.quizId} has no saved state for sync`);
        callback({
          success: false,
          message: 'No saved state found'
        });
      }
    });

    socket.on('next-question', (data: { presentationId: string; quizId: string; questionIndex: number }) => {
      console.log(`🔥🔥🔥 [服务器] 收到next-question事件:`, data);

      const eventData = {
        questionIndex: data.questionIndex,
        quizId: data.quizId
      };

      // 保存当前Quiz状态到内存中
      if (!global.quizStates) {
        global.quizStates = new Map();
      }
      global.quizStates.set(data.quizId, {
        currentQuestionIndex: data.questionIndex,
        lastUpdated: new Date()
      });

      const roomName = `presentation-${data.presentationId}`;
      const room = io.sockets.adapter.rooms.get(roomName);
      const userCount = room ? room.size : 0;

      console.log(`🔥🔥🔥 [服务器] 广播到房间 ${roomName}:`, eventData);
      console.log(`🔥🔥🔥 [服务器] 房间内用户数: ${userCount}`);

      io.to(roomName).emit('next-question', eventData);
      console.log(`🔥🔥🔥 [服务器] 广播完成`);
    });

    socket.on('submit-answer', async (data: { quizId: string; questionId: string; answer: string; presentationId: string }) => {
      try {
        console.log('📤 Received answer submission:', data);

        // 获取用户ID
        const userId = socket.userId;
        if (!userId) {
          socket.emit('answer-submitted', { success: false, error: 'User not authenticated' });
          return;
        }

        // 验证quiz是否存在且活跃
        const quiz = await prisma.quiz.findUnique({
          where: { id: data.quizId },
          include: { questions: true }
        });

        if (!quiz || quiz.status !== 'ACTIVE') {
          socket.emit('answer-submitted', { success: false, error: 'Quiz is not active' });
          return;
        }

        // 获取问题信息
        const question = await prisma.quizQuestion.findUnique({
          where: { id: data.questionId }
        });

        if (!question || question.quizId !== data.quizId) {
          socket.emit('answer-submitted', { success: false, error: 'Question not found' });
          return;
        }

        // 判断答案是否正确（空答案表示超时，算错误）
        const isCorrect = data.answer !== '' && question.correctAnswer === data.answer;

        // 保存答案到数据库
        const quizAnswer = await prisma.quizAnswer.upsert({
          where: {
            questionId_userId: {
              questionId: data.questionId,
              userId
            }
          },
          update: {
            answer: data.answer || 'TIMEOUT', // 超时答案标记为TIMEOUT
            isCorrect
          },
          create: {
            quizId: data.quizId,
            questionId: data.questionId,
            userId,
            answer: data.answer || 'TIMEOUT', // 超时答案标记为TIMEOUT
            isCorrect
          }
        });

        console.log('💾 Answer saved:', { questionId: data.questionId, userId, answer: data.answer || 'TIMEOUT', isCorrect });

        socket.emit('answer-submitted', { success: true });

        // 计算并广播更新的统计数据
        const stats = await calculateQuizStats(data.quizId);
        io.to(`presentation-${data.presentationId}`).emit('quiz-stats-updated', stats);
        console.log('📊 Broadcasted updated stats:', stats);

      } catch (error) {
        console.error('Failed to process answer:', error);
        socket.emit('answer-submitted', { success: false, error: 'Failed to submit answer' });
      }
    });

    socket.on('submit-feedback', async (data: { presentationId: string; type: string; message?: string }) => {
      try {
        console.log(`🔄 Processing feedback submission:`, {
          presentationId: data.presentationId,
          type: data.type,
          userId: socket.userId,
          username: socket.username
        });

        // Get user ID from socket
        const userId = socket.userId;
        if (!userId) {
          console.error('❌ No user ID found in socket for feedback submission');
          return;
        }

        // Validate feedback type
        const validTypes = ['TOO_FAST', 'TOO_SLOW', 'BORING', 'POOR_QUESTIONS', 'GENERAL'];
        if (!validTypes.includes(data.type)) {
          console.error('❌ Invalid feedback type:', data.type);
          return;
        }

        console.log(`💾 Saving feedback to database...`);

        // Save feedback to database
        const feedback = await prisma.feedback.create({
          data: {
            presentationId: data.presentationId,
            userId,
            type: data.type as any, // Cast to enum type
            message: data.message || null
          },
          include: {
            user: {
              select: { id: true, username: true, email: true, role: true }
            }
          }
        });

        console.log(`✅ Feedback saved to database with ID: ${feedback.id}`);

        // Broadcast feedback to organizers and speakers with complete data
        io.to(`presentation-${data.presentationId}`).emit('feedback-received', {
          id: feedback.id,
          type: feedback.type,
          message: feedback.message,
          createdAt: feedback.createdAt,
          user: feedback.user
        });

        console.log(`📡 Feedback broadcasted for presentation ${data.presentationId}: ${data.type} by user ${socket.username} (${userId})`);
      } catch (error) {
        console.error('❌ Failed to process feedback:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
          console.error('Stack trace:', error.stack);
        }
      }
    });

    // Discussion events
    socket.on('discussion-comment-added', (data: { quizId: string; comment: any }) => {
      console.log(`💬 New discussion comment for quiz ${data.quizId} by user ${socket.username}`);

      // Broadcast to all users in the presentation room
      // We need to get the presentation ID from the quiz
      prisma.quiz.findUnique({
        where: { id: data.quizId },
        select: { presentationId: true }
      }).then(quiz => {
        if (quiz) {
          const roomName = `presentation-${quiz.presentationId}`;
          io.to(roomName).emit('discussion-comment-added', {
            quizId: data.quizId,
            comment: data.comment
          });
          console.log(`📡 Discussion comment broadcasted to room ${roomName}`);
        }
      }).catch(error => {
        console.error('❌ Failed to broadcast discussion comment:', error);
      });
    });

    socket.on('discussion-comment-updated', (data: { quizId: string; comment: any }) => {
      console.log(`✏️ Discussion comment updated for quiz ${data.quizId} by user ${socket.username}`);

      prisma.quiz.findUnique({
        where: { id: data.quizId },
        select: { presentationId: true }
      }).then(quiz => {
        if (quiz) {
          const roomName = `presentation-${quiz.presentationId}`;
          io.to(roomName).emit('discussion-comment-updated', {
            quizId: data.quizId,
            comment: data.comment
          });
          console.log(`📡 Discussion comment update broadcasted to room ${roomName}`);
        }
      }).catch(error => {
        console.error('❌ Failed to broadcast discussion comment update:', error);
      });
    });

    socket.on('discussion-comment-deleted', (data: { quizId: string; commentId: string }) => {
      console.log(`🗑️ Discussion comment deleted for quiz ${data.quizId} by user ${socket.username}`);

      prisma.quiz.findUnique({
        where: { id: data.quizId },
        select: { presentationId: true }
      }).then(quiz => {
        if (quiz) {
          const roomName = `presentation-${quiz.presentationId}`;
          io.to(roomName).emit('discussion-comment-deleted', {
            quizId: data.quizId,
            commentId: data.commentId
          });
          console.log(`📡 Discussion comment deletion broadcasted to room ${roomName}`);
        }
      }).catch(error => {
        console.error('❌ Failed to broadcast discussion comment deletion:', error);
      });
    });

    socket.on('disconnect', () => {
      console.log(`👤 User ${socket.username} disconnected`);
    });
  });

  console.log('🔌 Socket.IO service initialized');
  return io;
};

// 导出Socket.io实例获取函数
export const getSocketIO = () => socketIOInstance;
