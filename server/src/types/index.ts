// 后端统一类型定义文件
// 确保与前端类型定义完全一致

// 枚举类型定义
export enum UserRole {
  ORGANIZER = 'ORGANIZER',
  SPEAKER = 'SPEAKER',
  AUDIENCE = 'AUDIENCE'
}

export enum QuizStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum FeedbackType {
  TOO_FAST = 'TOO_FAST',
  TOO_SLOW = 'TOO_SLOW',
  BORING = 'BORING',
  POOR_QUESTIONS = 'POOR_QUESTIONS',
  GENERAL = 'GENERAL'
}

// API请求类型
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  role: UserRole;
}

export interface CreatePresentationRequest {
  title: string;
  description?: string;
  startTime: string;
  speakerEmail: string;
}

export interface CreateQuizRequest {
  presentationId: string;
  title: string;
  questions: CreateQuizQuestionRequest[];
  timeLimit?: number;
}

export interface CreateQuizQuestionRequest {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation?: string;
  order: number;
}

export interface SubmitAnswerRequest {
  questionId: string;
  answer: string;
}

export interface SubmitFeedbackRequest {
  presentationId: string;
  type: FeedbackType;
  message?: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    avatar?: string;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
}

export interface PresentationResponse {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organizerId: string;
  speakerId: string;
  organizer: {
    id: string;
    username: string;
    email: string;
  };
  speaker: {
    id: string;
    username: string;
    email: string;
  };
  audience: Array<{
    id: string;
    presentationId: string;
    userId: string;
    nickname?: string;
    joinedAt: string;
    user: {
      id: string;
      username: string;
      email: string;
    };
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    status: QuizStatus;
    timeLimit: number;
    startTime?: string;
    endTime?: string;
    createdAt: string;
    questions: Array<{
      id: string;
      question: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctAnswer: string;
      explanation?: string;
      order: number;
    }>;
  }>;
  feedbacks: Array<{
    id: string;
    type: FeedbackType;
    message?: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
      email: string;
    };
  }>;
  _count?: {
    audience: number;
    quizzes: number;
  };
}

export interface QuizResponse {
  id: string;
  presentationId: string;
  title: string;
  status: QuizStatus;
  timeLimit: number;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  presentation: {
    id: string;
    title: string;
    organizerId: string;
    speakerId: string;
    organizer: { id: string };
    speaker: { id: string };
    audience: Array<{ userId: string }>;
  };
  questions: Array<{
    id: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    explanation?: string;
    order: number;
  }>;
  answers: Array<{
    id: string;
    quizId: string;
    questionId: string;
    userId: string;
    answer: string;
    isCorrect: boolean;
    answeredAt: string;
    user: {
      id: string;
      username: string;
    };
  }>;
}

export interface AnalyticsResponse {
  id: string;
  title: string;
  speaker?: string;
  organizer?: string;
  startTime: string;
  totalAudience: number;
  totalQuizzes: number;
  totalQuestions: number;
  participationRate: number;
  accuracy: number;
  feedbackSummary: {
    TOO_FAST: number;
    TOO_SLOW: number;
    BORING: number;
    POOR_QUESTIONS: number;
    GENERAL: number;
  };
}

export interface AudienceAnalyticsResponse extends AnalyticsResponse {
  presentationId: string;
  joinedAt: string;
  answeredQuestions: number;
  correctAnswers: number;
}

export interface AnalyticsSummaryResponse {
  totalPresentations: number;
  totalQuestions: number;
  totalAnswered: number;
  totalCorrect: number;
  overallParticipationRate: number;
  overallAccuracy: number;
}

export interface QuizStatsResponse {
  totalParticipants: number;
  totalAnswers: number;
  questionStats: Array<{
    question: string;
    correctAnswer: string;
    optionCounts: {
      A: number;
      B: number;
      C: number;
      D: number;
    };
    totalAnswers: number;
    correctCount: number;
  }>;
}

// Socket事件类型
export interface SocketQuizStartData {
  quiz: QuizResponse;
  timeLimit: number;
}

export interface SocketAnswerData {
  quizId: string;
  questionId: string;
  answer: string;
  presentationId: string;
}

export interface SocketFeedbackData {
  presentationId: string;
  type: FeedbackType;
  message?: string;
}

// 错误类型
export interface ApiError {
  message: string;
  status: number;
  code?: string;
}
