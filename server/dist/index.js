"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const presentations_1 = __importDefault(require("./routes/presentations"));
const quizzes_1 = __importDefault(require("./routes/quizzes"));
const quiz_questions_1 = __importDefault(require("./routes/quiz-questions"));
const upload_1 = __importDefault(require("./routes/upload"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const admin_1 = __importDefault(require("./routes/admin"));
const discussions_1 = __importDefault(require("./routes/discussions"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_2 = require("./middleware/auth");
const socketService_1 = require("./services/socketService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'PopQuiz Backend',
        version: '1.0.0'
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/presentations', auth_2.authMiddleware, presentations_1.default);
app.use('/api/quizzes', auth_2.authMiddleware, quizzes_1.default);
app.use('/api/quiz-questions', auth_2.authMiddleware, quiz_questions_1.default);
app.use('/api/upload', auth_2.authMiddleware, upload_1.default);
app.use('/api/analytics', auth_2.authMiddleware, analytics_1.default);
app.use('/api/admin', auth_2.authMiddleware, admin_1.default);
app.use('/api/discussions', auth_2.authMiddleware, discussions_1.default);
app.use('/api/feedback', auth_2.authMiddleware, feedback_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
const io = (0, socketService_1.initializeSocket)(server);
exports.io = io;
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
//# sourceMappingURL=index.js.map