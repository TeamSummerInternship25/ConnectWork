import { Server } from 'socket.io';
interface QuizState {
    currentQuestionIndex: number;
    lastUpdated: Date;
}
declare global {
    var quizStates: Map<string, QuizState> | undefined;
}
export declare function calculateQuizStats(quizId: string): Promise<{
    totalParticipants: number;
    totalAnswers: number;
    questionStats: never[];
    averageScore?: undefined;
    overallAccuracy?: undefined;
} | {
    totalParticipants: number;
    totalAnswers: number;
    averageScore: number;
    overallAccuracy: number;
    questionStats: {
        questionId: string;
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
        accuracy: number;
    }[];
}>;
export declare const initializeSocket: (server: any) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getSocketIO: () => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any> | null;
export {};
//# sourceMappingURL=socketService.d.ts.map