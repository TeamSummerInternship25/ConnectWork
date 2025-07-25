import { CreateQuizQuestionRequest } from '../types';
interface QuizGenerationOptions {
    difficulty?: 'easy' | 'medium' | 'hard';
    questionCount?: number;
    timeLimit?: number;
    focusAreas?: string[];
}
interface GeneratedQuestion {
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    explanation: string;
    difficulty: string;
    topic: string;
}
interface QualityFeedback {
    score: number;
    issues: string[];
    suggestions: string[];
    isAcceptable: boolean;
}
interface QualityLoopResult {
    questions: GeneratedQuestion[];
    qualityHistory: QualityFeedback[];
    iterations: number;
    finalQuality: QualityFeedback;
}
declare class AIService {
    private anthropic;
    private isEnabled;
    constructor();
    generateQuizFromText(content: string, options?: QuizGenerationOptions): Promise<GeneratedQuestion[]>;
    evaluateQuizQuality(questions: GeneratedQuestion[], originalContent: string, userFeedback?: string): Promise<QualityFeedback>;
    improveQuizQuestions(questions: GeneratedQuestion[], qualityFeedback: QualityFeedback, originalContent: string): Promise<GeneratedQuestion[]>;
    generateQuizWithQualityLoop(content: string, options?: QuizGenerationOptions, maxIterations?: number): Promise<{
        questions: GeneratedQuestion[];
        qualityHistory: QualityFeedback[];
        iterations: number;
        finalQuality: QualityFeedback;
    }>;
    private buildQuizGenerationPrompt;
    private buildQualityEvaluationPrompt;
    private buildImprovementPrompt;
    private parseQuizResponse;
    private parseQualityFeedback;
    private generateMockQuestions;
    private generateMockQualityFeedback;
    private generateStrictQualityFeedback;
    private generateQuizFromLongContent;
    private splitContentIntoSegments;
    private processXfyunQuizResponse;
    convertToDbFormat(questions: GeneratedQuestion[]): CreateQuizQuestionRequest[];
    generateQuizWithStrictQualityLoop(content: string, options?: QuizGenerationOptions, maxIterations?: number): Promise<{
        questions: GeneratedQuestion[];
        qualityHistory: QualityFeedback[];
        iterations: number;
        finalQuality: QualityFeedback;
    }>;
    private performBasicQualityCheck;
    private combineQualityFeedback;
}
export declare const aiService: AIService;
export { GeneratedQuestion, QualityFeedback, QualityLoopResult, QuizGenerationOptions };
//# sourceMappingURL=aiService.d.ts.map