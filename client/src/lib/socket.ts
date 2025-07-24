import io from 'socket.io-client';

class SocketService {
  private socket: any = null;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    this.socket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000', {
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  // Presentation methods
  joinPresentation(presentationId: string) {
    this.socket?.emit('join-presentation', presentationId);
  }

  leavePresentation(presentationId: string) {
    this.socket?.emit('leave-presentation', presentationId);
  }

  // Quiz methods
  startQuiz(quizId: string, presentationId: string) {
    this.socket?.emit('start-quiz', { quizId, presentationId });
  }

  submitAnswer(data: {
    quizId: string;
    questionId: string;
    answer: string;
    presentationId: string;
  }) {
    this.socket?.emit('submit-answer', data);
  }

  // Feedback methods
  submitFeedback(data: {
    presentationId: string;
    type: string;
    message?: string;
  }) {
    this.socket?.emit('submit-feedback', data);
  }

  // Event listeners
  onQuizStarted(callback: (data: any) => void) {
    this.socket?.on('quiz-started', callback);
  }

  onQuizEnded(callback: (data: any) => void) {
    this.socket?.on('quiz-ended', callback);
  }

  onAnswerSubmitted(callback: (data: any) => void) {
    this.socket?.on('answer-submitted', callback);
  }

  onQuizStatsUpdated(callback: (data: any) => void) {
    this.socket?.on('quiz-stats-updated', callback);
  }

  onFeedbackReceived(callback: (data: any) => void) {
    this.socket?.on('feedback-received', callback);
  }

  // Generic event methods
  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  // Remove listeners
  off(event: string, callback?: any) {
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();
