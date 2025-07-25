import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { RegisterRequest, LoginRequest, AuthResponse } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password, role }: RegisterRequest = req.body;
    console.log('📝 Registration attempt:', { email, username, role, passwordLength: password?.length });

    // Validate input
    if (!email || !username || !password || !role) {
      throw createError('All fields are required', 400);
    }

    if (!['ORGANIZER', 'SPEAKER', 'AUDIENCE'].includes(role)) {
      throw createError('Invalid role', 400);
    }

    // Check if user already exists
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
      throw createError('User with this email or username already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('🔐 Password hashed successfully');

    // Create user
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

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw createError('JWT_SECRET is not configured', 500);
    }

    const token = (jwt.sign as any)(
      { userId: user.id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      throw createError('Email and password are required', 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw createError('Invalid credentials', 401);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw createError('Invalid credentials', 401);
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw createError('JWT_SECRET is not configured', 500);
    }

    const token = (jwt.sign as any)(
      { userId: user.id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

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
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      throw createError('Access denied. No token provided.', 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw createError('Invalid token format. Expected "Bearer <token>".', 401);
    }

    const token = authHeader.replace('Bearer ', '');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (jwtError) {
      throw createError('Invalid token', 401);
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
      throw createError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
