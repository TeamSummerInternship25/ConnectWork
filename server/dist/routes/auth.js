"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.post('/register', async (req, res, next) => {
    try {
        const { email, username, password, role } = req.body;
        console.log('📝 Registration attempt:', { email, username, role, passwordLength: password?.length });
        if (!email || !username || !password || !role) {
            throw (0, errorHandler_1.createError)('All fields are required', 400);
        }
        if (!['ORGANIZER', 'SPEAKER', 'AUDIENCE'].includes(role)) {
            throw (0, errorHandler_1.createError)('Invalid role', 400);
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
            console.log('❌ User already exists:', existingUser.email);
            throw (0, errorHandler_1.createError)('User with this email or username already exists', 409);
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        console.log('🔐 Password hashed successfully');
        console.log('👤 Creating user in database...');
        const user = await prisma.user.create({
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
        console.log('✅ User created successfully:', user.id);
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw (0, errorHandler_1.createError)('JWT_SECRET is not configured', 500);
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.status(201).json({
            message: 'User created successfully',
            user,
            token
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw (0, errorHandler_1.createError)('Email and password are required', 400);
        }
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            throw (0, errorHandler_1.createError)('Invalid credentials', 401);
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw (0, errorHandler_1.createError)('Invalid credentials', 401);
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw (0, errorHandler_1.createError)('JWT_SECRET is not configured', 500);
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role
            },
            token
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/me', async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw (0, errorHandler_1.createError)('Access denied. No token provided.', 401);
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (jwtError) {
            throw (0, errorHandler_1.createError)('Invalid token', 401);
        }
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                createdAt: true
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
exports.default = router;
//# sourceMappingURL=auth.js.map