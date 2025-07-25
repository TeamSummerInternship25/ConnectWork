"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = exports.initializeSocket = void 0;
exports.calculateQuizStats = calculateQuizStats;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
let socketIOInstance = null;
async function calculateQuizStats(quizId) {
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
        const uniqueParticipants = new Set(quiz.answers.map(a => a.userId));
        const totalParticipants = uniqueParticipants.size;
        const questionStats = quiz.questions.map(question => {
            const questionAnswers = question.answers;
            const totalAnswers = questionAnswers.length;
            const correctCount = questionAnswers.filter(a => a.isCorrect).length;
            const optionCounts = { A: 0, B: 0, C: 0, D: 0 };
            questionAnswers.forEach(answer => {
                if (answer.answer === 'A')
                    optionCounts.A++;
                else if (answer.answer === 'B')
                    optionCounts.B++;
                else if (answer.answer === 'C')
                    optionCounts.C++;
                else if (answer.answer === 'D')
                    optionCounts.D++;
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
            averageScore: overallAccuracy,
            overallAccuracy,
            questionStats
        };
    }
    catch (error) {
        console.error('Error calculating quiz stats:', error);
        return { totalParticipants: 0, totalAnswers: 0, questionStats: [] };
    }
}
const initializeSocket = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    socketIOInstance = io;
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication token required'));
            }
            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                return next(new Error('JWT secret not configured'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
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
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`👤 User ${socket.username} (${socket.userRole}) connected`);
        socket.on('join-presentation', (presentationId) => {
            const roomName = `presentation-${presentationId}`;
            socket.join(roomName);
            console.log(`👤 ${socket.username} (${socket.userRole}) joined room: ${roomName}`);
            const room = io.sockets.adapter.rooms.get(roomName);
            const userCount = room ? room.size : 0;
            console.log(`🏠 房间 ${roomName} 当前用户数: ${userCount}`);
        });
        socket.on('leave-presentation', (presentationId) => {
            socket.leave(`presentation-${presentationId}`);
            console.log(`👤 ${socket.username} left presentation ${presentationId}`);
        });
        socket.on('start-quiz', async (data) => {
            try {
                const quiz = await prisma.quiz.findUnique({
                    where: { id: data.quizId },
                    include: { questions: { orderBy: { order: 'asc' } } }
                });
                if (quiz) {
                    const startIndex = data.questionIndex || 0;
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
            }
            catch (error) {
                console.error('Failed to start quiz:', error);
            }
        });
        socket.on('end-quiz', (data) => {
            if (global.quizStates) {
                global.quizStates.delete(data.quizId);
            }
            io.to(`presentation-${data.presentationId}`).emit('quiz-ended', { quizId: data.quizId });
            console.log(`🏁 Quiz ${data.quizId} ended in presentation ${data.presentationId}`);
        });
        socket.on('get-quiz-state', (data, callback) => {
            const state = global.quizStates?.get(data.quizId);
            if (state) {
                console.log(`📊 Quiz ${data.quizId} current state:`, state);
                callback({ success: true, state });
            }
            else {
                console.log(`❓ No state found for quiz ${data.quizId}`);
                callback({ success: false, state: null });
            }
        });
        socket.on('sync-question-state', (data, callback) => {
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
            }
            else {
                console.log(`❓ Quiz ${data.quizId} has no saved state for sync`);
                callback({
                    success: false,
                    message: 'No saved state found'
                });
            }
        });
        socket.on('next-question', async (data) => {
            console.log(`🔥🔥🔥 [服务器] 收到next-question事件:`, data);
            try {
                const quiz = await prisma.quiz.findUnique({
                    where: { id: data.quizId },
                    include: {
                        questions: {
                            orderBy: { order: 'asc' }
                        },
                        presentation: {
                            select: { id: true }
                        }
                    }
                });
                if (!quiz) {
                    console.error(`❌ Quiz不存在: ${data.quizId}`);
                    return;
                }
                if (quiz.presentation.id !== data.presentationId) {
                    console.error(`❌ PresentationId不匹配: quiz.presentationId=${quiz.presentation.id}, 请求的presentationId=${data.presentationId}`);
                    return;
                }
                const targetQuestion = quiz.questions.find(q => q.order === data.questionIndex);
                if (!targetQuestion) {
                    console.error(`❌ 题目不存在: quizId=${data.quizId}, order=${data.questionIndex}`);
                    return;
                }
                console.log(`✅ [服务器] 验证通过 - QuizId: ${data.quizId}, Order: ${data.questionIndex}, QuestionId: ${targetQuestion.id}`);
                if (!global.quizStates) {
                    global.quizStates = new Map();
                }
                global.quizStates.set(data.quizId, {
                    currentQuestionIndex: data.questionIndex,
                    lastUpdated: new Date()
                });
                console.log(`💾 Quiz状态已保存: questionIndex=${data.questionIndex}`);
                const eventData = {
                    questionIndex: data.questionIndex,
                    quizId: data.quizId,
                    questionId: targetQuestion.id
                };
                const roomName = `presentation-${data.presentationId}`;
                const room = io.sockets.adapter.rooms.get(roomName);
                const userCount = room ? room.size : 0;
                console.log(`🔥🔥🔥 [服务器] 广播到房间 ${roomName}:`, eventData);
                console.log(`🔥🔥🔥 [服务器] 房间内用户数: ${userCount}`);
                io.to(roomName).emit('next-question', eventData);
                console.log(`🔥🔥🔥 [服务器] 广播完成`);
            }
            catch (error) {
                console.error('❌ 处理next-question事件失败:', error);
            }
        });
        socket.on('submit-answer', async (data) => {
            try {
                console.log('📤 Received answer submission:', data);
                const userId = socket.userId;
                if (!userId) {
                    socket.emit('answer-submitted', { success: false, error: 'User not authenticated' });
                    return;
                }
                const quiz = await prisma.quiz.findUnique({
                    where: { id: data.quizId },
                    include: { questions: true }
                });
                if (!quiz || quiz.status !== 'ACTIVE') {
                    socket.emit('answer-submitted', { success: false, error: 'Quiz is not active' });
                    return;
                }
                const question = await prisma.quizQuestion.findUnique({
                    where: { id: data.questionId }
                });
                if (!question || question.quizId !== data.quizId) {
                    socket.emit('answer-submitted', { success: false, error: 'Question not found' });
                    return;
                }
                const isCorrect = data.answer !== '' && question.correctAnswer === data.answer;
                const quizAnswer = await prisma.quizAnswer.upsert({
                    where: {
                        questionId_userId: {
                            questionId: data.questionId,
                            userId
                        }
                    },
                    update: {
                        answer: data.answer || 'TIMEOUT',
                        isCorrect
                    },
                    create: {
                        quizId: data.quizId,
                        questionId: data.questionId,
                        userId,
                        answer: data.answer || 'TIMEOUT',
                        isCorrect
                    }
                });
                console.log('💾 Answer saved:', { questionId: data.questionId, userId, answer: data.answer || 'TIMEOUT', isCorrect });
                socket.emit('answer-submitted', { success: true });
                const stats = await calculateQuizStats(data.quizId);
                io.to(`presentation-${data.presentationId}`).emit('quiz-stats-updated', stats);
                console.log('📊 Broadcasted updated stats:', stats);
            }
            catch (error) {
                console.error('Failed to process answer:', error);
                socket.emit('answer-submitted', { success: false, error: 'Failed to submit answer' });
            }
        });
        socket.on('submit-feedback', async (data) => {
            try {
                console.log(`🔄 Processing feedback submission:`, {
                    presentationId: data.presentationId,
                    type: data.type,
                    userId: socket.userId,
                    username: socket.username
                });
                const userId = socket.userId;
                if (!userId) {
                    console.error('❌ No user ID found in socket for feedback submission');
                    return;
                }
                const validTypes = ['TOO_FAST', 'TOO_SLOW', 'BORING', 'POOR_QUESTIONS', 'GENERAL'];
                if (!validTypes.includes(data.type)) {
                    console.error('❌ Invalid feedback type:', data.type);
                    return;
                }
                console.log(`💾 Saving feedback to database...`);
                const feedback = await prisma.feedback.create({
                    data: {
                        presentationId: data.presentationId,
                        userId,
                        type: data.type,
                        message: data.message || null
                    },
                    include: {
                        user: {
                            select: { id: true, username: true, email: true, role: true }
                        }
                    }
                });
                console.log(`✅ Feedback saved to database with ID: ${feedback.id}`);
                io.to(`presentation-${data.presentationId}`).emit('feedback-received', {
                    id: feedback.id,
                    type: feedback.type,
                    message: feedback.message,
                    createdAt: feedback.createdAt,
                    user: feedback.user
                });
                console.log(`📡 Feedback broadcasted for presentation ${data.presentationId}: ${data.type} by user ${socket.username} (${userId})`);
            }
            catch (error) {
                console.error('❌ Failed to process feedback:', error);
                if (error instanceof Error) {
                    console.error('Error details:', error.message);
                    console.error('Stack trace:', error.stack);
                }
            }
        });
        socket.on('disconnect', () => {
            console.log(`👤 User ${socket.username} disconnected`);
        });
    });
    console.log('🔌 Socket.IO service initialized');
    return io;
};
exports.initializeSocket = initializeSocket;
const getSocketIO = () => socketIOInstance;
exports.getSocketIO = getSocketIO;
//# sourceMappingURL=socketService.js.map