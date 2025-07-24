// 前端统一类型定义文件
// 确保与后端类型定义完全一致

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

// 基础数据模型
export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Presentation {
  id: string;
  title: string;
  description?: string;
  code: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  organizerId: string;
  speakerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationAudience {
  id: string;
  presentationId: string;
  userId: string;
  nickname?: string;
  joinedAt: string;
  user?: User;
}

export interface PresentationContent {
  id: string;
  presentationId: string;
  contentType: string;
  originalName: string;
  filePath?: string;
  extractedText: string;
  timestamp: string;
}

export interface Quiz {
  id: string;
  presentationId: string;
  title: string;
  status: QuizStatus;
  timeLimit: number;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  currentQuestionIndex?: number;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation?: string;
  order: number;
}

export interface QuizAnswer {
  id: string;
  quizId: string;
  questionId: string;
  userId: string;
  answer: string;
  isCorrect: boolean;
  answeredAt: string;
}

export interface Feedback {
  id: string;
  presentationId: string;
  userId: string;
  type: FeedbackType;
  message?: string;
  createdAt: string;
  user?: User;
}

export interface Discussion {
  id: string;
  quizId: string;
  isActive: boolean;
  createdAt: string;
  comments: DiscussionComment[];
}

export interface DiscussionComment {
  id: string;
  discussionId: string;
  userId: string;
  message: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

// 带关联数据的复合类型
export interface PresentationWithRelations extends Presentation {
  organizer: User;
  speaker: User;
  audience: PresentationAudience[];
  contents: PresentationContent[];
  quizzes: QuizWithRelations[];
  feedbacks: Feedback[];
  _count?: {
    audience: number;
    quizzes: number;
    feedbacks: number;
  };
}

export interface QuizWithRelations extends Quiz {
  presentation: Presentation;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  discussion?: Discussion;
  _count?: {
    questions: number;
    answers: number;
  };
}

export interface FeedbackWithUser extends Feedback {
  user: User;
}

export interface DiscussionWithComments extends Discussion {
  quiz: Quiz;
  comments: DiscussionCommentWithUser[];
}

export interface DiscussionCommentWithUser extends DiscussionComment {
  user: User;
}

// API请求/响应类型
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

export interface RegisterApiData {
  email: string;
  username: string;
  password: string;
  role: UserRole;
}

export interface CreatePresentationData {
  title: string;
  description?: string;
  startTime: string;
  speakerEmail: string;
}

export interface CreateQuizData {
  title: string;
  timeLimit?: number;
  presentationId?: string;
  questions?: Array<{
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    explanation?: string;
    order?: number;
  }>;
}

export interface SubmitAnswerData {
  questionId: string;
  answer: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 统计分析类型
export interface QuizStats {
  totalQuestions: number;
  totalAnswers: number;
  correctAnswers: number;
  averageScore: number;
  participantCount: number;
  totalParticipants: number;
  questionStats: QuestionStats[];
}

export interface QuestionStats {
  questionId: string;
  question: string;
  totalAnswers: number;
  correctAnswers: number;
  correctCount: number;
  accuracy: number;
  optionStats: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  optionCounts: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  correctOption: string;
  correctAnswer: string;
}

export interface AudienceAnalytics {
  presentationId: string;
  title: string;
  speaker: string;
  joinedAt: string;
  answeredQuestions: number;
  totalQuestions: number;
  accuracy: number;
  participationRate: number;
  totalParticipants: number;
  activeParticipants: number;
  averageEngagement: number;
  feedbackSummary: {
    [key in FeedbackType]: number;
  };
}

export interface AnalyticsSummary {
  presentations: number;
  totalPresentations: number;
  quizzes: number;
  participants: number;
  totalAnswered: number;
  averageScore: number;
  overallAccuracy: number;
  overallParticipationRate: number;
  ranking: {
    currentRank: number;
    totalUsers: number;
    percentile: number;
  };
}

export interface Analytics {
  summary: AnalyticsSummary;
  recentActivity: any[];
  topPresentations: any[];
}

export interface PresentationAnalytics extends PresentationWithRelations {
  totalAudience: number;
  totalQuizzes: number;
  participationRate: number;
  accuracy: number;
  feedbackSummary: {
    [key in FeedbackType]: number;
  };
}

// Socket.IO 事件类型
export interface SocketQuizStartData {
  quizId: string;
  quiz: QuizWithRelations;
  questionIndex: number;
  timeLimit: number;
}

export interface SocketQuizEndData {
  quizId: string;
  stats: QuizStats;
}

export interface SocketQuestionData {
  questionId: string;
  question: QuizQuestion;
  timeLimit: number;
}

export interface SocketAnswerData {
  questionId: string;
  userId: string;
  answer: string;
  isCorrect: boolean;
}

export interface SocketFeedbackData {
  presentationId: string;
  feedback?: FeedbackWithUser;
  type?: FeedbackType;
  message?: string;
}

export interface SocketDiscussionData {
  discussionId: string;
  comment: DiscussionCommentWithUser;
}

// 文件上传类型
export interface FileUploadResponse {
  success: boolean;
  filename?: string;
  extractedText?: string;
  error?: string;
}

// 表单验证类型
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string;
}
