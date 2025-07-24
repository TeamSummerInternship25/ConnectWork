import {
  LoginFormData,
  RegisterApiData,
  CreatePresentationData,
  CreateQuizData,
  SubmitAnswerData,
  User,
  PresentationWithRelations,
  QuizWithRelations,
  AudienceAnalytics,
  AnalyticsSummary,
  Analytics,
  PresentationAnalytics,
  ApiResponse
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  getToken() {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    // Don't set Content-Type for FormData - let browser set it automatically
    const isFormData = options.body instanceof FormData;

    const config: RequestInit = {
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!response.ok) {
        if (isJson) {
          const data = await response.json();
          throw new Error(data.error || 'An error occurred');
        } else {
          // If not JSON, it might be an HTML error page
          const text = await response.text();
          if (text.includes('<!DOCTYPE')) {
            throw new Error(`Server error (${response.status}): Please check if the server is running correctly`);
          }
          throw new Error(`Server error (${response.status}): ${text}`);
        }
      }

      if (isJson) {
        return await response.json();
      } else {
        // For non-JSON successful responses
        return { success: true };
      }
    } catch (error) {
      // Don't log user input errors to console (authentication, validation, etc.)
      if (error instanceof Error) {
        const userInputErrors = [
          'Invalid credentials',
          'User already exists',
          'Invalid email',
          'Password too weak',
          'Validation failed',
          'Access denied',
          'Not found'
        ];

        const isUserInputError = userInputErrors.some(msg =>
          error.message.includes(msg)
        );

        if (!isUserInputError) {
          console.error('API request failed:', error);
        }
      } else {
        console.error('API request failed:', error);
      }
      throw error;
    }
  }

  // Auth methods
  async register(userData: RegisterApiData): Promise<{ user: User; token: string }> {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async login(credentials: LoginFormData): Promise<{ user: User; token: string }> {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Presentation methods
  async getPresentations(): Promise<{ presentations: PresentationWithRelations[] }> {
    return this.request('/presentations');
  }

  async getActivePresentations(): Promise<{ presentations: PresentationWithRelations[] }> {
    return this.request('/presentations/active');
  }

  async createPresentation(presentationData: CreatePresentationData): Promise<{ presentation: PresentationWithRelations }> {
    return this.request('/presentations', {
      method: 'POST',
      body: JSON.stringify(presentationData),
    });
  }

  async getPresentation(id: string): Promise<{ presentation: PresentationWithRelations }> {
    return this.request(`/presentations/${id}`);
  }

  async joinPresentation(id: string, nickname?: string): Promise<ApiResponse<any>> {
    return this.request(`/presentations/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  }

  async joinPresentationByCode(code: string, nickname?: string): Promise<ApiResponse<any>> {
    return this.request(`/presentations/code/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  }

  async findPresentationByCode(code: string): Promise<ApiResponse<any>> {
    return this.request(`/presentations/code/${code}`);
  }

  // Quiz methods
  async createQuiz(quizData: CreateQuizData): Promise<{ quiz: QuizWithRelations }> {
    return this.request('/quizzes', {
      method: 'POST',
      body: JSON.stringify(quizData),
    });
  }

  async getQuiz(id: string) {
    return this.request(`/quizzes/${id}`);
  }

  async submitAnswer(quizId: string, answerData: SubmitAnswerData): Promise<ApiResponse<any>> {
    return this.request(`/quizzes/${quizId}/answer`, {
      method: 'POST',
      body: JSON.stringify(answerData),
    });
  }

  async getQuizResults(id: string): Promise<ApiResponse<any>> {
    return this.request(`/quizzes/${id}/results`);
  }

  // Upload methods
  async uploadContent(presentationId: string, file: File) {
    const formData = new FormData();
    formData.append('content', file);

    return this.request(`/upload/${presentationId}`, {
      method: 'POST',
      body: formData,
      // Don't set any headers - let browser set Content-Type for FormData
    });
  }

  async getPresentationContents(presentationId: string) {
    return this.request(`/upload/${presentationId}/contents`);
  }

  async deleteContent(contentId: string) {
    return this.request(`/upload/content/${contentId}`, {
      method: 'DELETE',
    });
  }

  // Analytics methods
  async getOrganizerAnalytics(): Promise<{ analytics: PresentationAnalytics[]; summary?: AnalyticsSummary }> {
    return this.request('/analytics/organizer');
  }

  async getSpeakerAnalytics(): Promise<{ analytics: PresentationAnalytics[]; summary?: AnalyticsSummary }> {
    return this.request('/analytics/speaker');
  }

  async getAudienceAnalytics(): Promise<{ analytics: AudienceAnalytics[]; summary: AnalyticsSummary }> {
    return this.request('/analytics/audience');
  }

  async getPresentationAnalytics(presentationId: string) {
    return this.request(`/analytics/presentation/${presentationId}`);
  }

  // Additional presentation methods
  async startPresentation(id: string) {
    return this.request(`/presentations/${id}/start`, {
      method: 'POST'
    });
  }

  async endPresentation(id: string) {
    return this.request(`/presentations/${id}/end`, {
      method: 'POST'
    });
  }

  async deletePresentation(id: string) {
    return this.request(`/presentations/${id}`, {
      method: 'DELETE'
    });
  }

  // Admin methods (ORGANIZER only)
  async getAllUsers() {
    return this.request('/admin/users');
  }

  async getUserById(id: string) {
    return this.request(`/admin/users/${id}`);
  }

  async updateUser(id: string, userData: any) {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async createUser(userData: any) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getAllPresentationsAdmin() {
    return this.request('/admin/presentations');
  }

  async assignSpeaker(presentationId: string, speakerId: string) {
    return this.request(`/admin/presentations/${presentationId}/speaker`, {
      method: 'PUT',
      body: JSON.stringify({ speakerId }),
    });
  }

  async addAudienceMember(presentationId: string, userId: string, nickname?: string) {
    return this.request(`/admin/presentations/${presentationId}/audience`, {
      method: 'POST',
      body: JSON.stringify({ userId, nickname }),
    });
  }

  async removeAudienceMember(presentationId: string, userId: string) {
    return this.request(`/admin/presentations/${presentationId}/audience/${userId}`, {
      method: 'DELETE',
    });
  }

  async getRelationships() {
    return this.request('/admin/relationships');
  }

  // Discussion methods
  async getDiscussion(quizId: string): Promise<{ discussion: any }> {
    return this.request(`/discussions/quiz/${quizId}`);
  }

  async postComment(quizId: string, message: string): Promise<{ comment: any }> {
    return this.request(`/discussions/quiz/${quizId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async editComment(commentId: string, message: string): Promise<{ comment: any }> {
    return this.request(`/discussions/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ message }),
    });
  }

  async deleteComment(commentId: string): Promise<{ message: string }> {
    return this.request(`/discussions/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  async toggleDiscussion(quizId: string): Promise<{ discussion: any }> {
    return this.request(`/discussions/quiz/${quizId}/toggle`, {
      method: 'PATCH',
    });
  }

  async updateQuizStatus(quizId: string, status: string): Promise<ApiResponse<any>> {
    return this.request(`/quizzes/${quizId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateQuizQuestion(questionId: string, questionData: any): Promise<ApiResponse<any>> {
    return this.request(`/quiz-questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(questionData),
    });
  }

  async deleteQuiz(quizId: string): Promise<ApiResponse<any>> {
    return this.request(`/quizzes/${quizId}`, {
      method: 'DELETE',
    });
  }

  // Feedback methods
  async submitFeedback(presentationId: string, feedbackData: { type: string; message?: string }): Promise<ApiResponse<any>> {
    return this.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        presentationId,
        ...feedbackData
      }),
    });
  }

  async getFeedback(presentationId: string): Promise<ApiResponse<any>> {
    return this.request(`/feedback/${presentationId}`);
  }

  async getFeedbackStats(presentationId: string): Promise<ApiResponse<any>> {
    return this.request(`/feedback/${presentationId}/stats`);
  }

  // File upload method
  async uploadFile(formData: FormData): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

export const apiService = new ApiService();
