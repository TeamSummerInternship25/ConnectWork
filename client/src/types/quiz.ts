export interface Quiz { 
  id: string; 
  title: string; 
  description: string; 
  timeLimit: number; 
  questions: Question[]; 
  createdAt: Date; 
  updatedAt: Date; 
} 
 
export interface Question { 
  id: string; 
  text: string; 
  type: 'multiple-choice' | 'true-false' | 'short-answer'; 
  options?: string[]; 
  correctAnswer: string; 
} 
