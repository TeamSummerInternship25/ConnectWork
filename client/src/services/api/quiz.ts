const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CreateQuizRequest {
  title: string;
  description: string;
  timeLimit: number;
}

export interface UpdateQuizRequest extends CreateQuizRequest {
  id: string;
}

export const quizAPI = {
  async getQuizzes() {
    const response = await fetch(${API_BASE_URL}/api/quizzes);
    return response.json();
  },

  async getQuizById(id: string) {
    const response = await fetch(${API_BASE_URL}/api/quizzes/);
    return response.json();
  },

  async createQuiz(data: CreateQuizRequest) {
    const response = await fetch(${API_BASE_URL}/api/quizzes, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async updateQuiz(data: UpdateQuizRequest) {
    const response = await fetch(${API_BASE_URL}/api/quizzes/, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async deleteQuiz(id: string) {
    const response = await fetch(${API_BASE_URL}/api/quizzes/, {
      method: 'DELETE'
    });
    return response.json();
  }
};
