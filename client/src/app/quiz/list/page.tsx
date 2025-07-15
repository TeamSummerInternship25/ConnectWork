'use client'; 
import React, { useState, useEffect } from 'react'; 
import QuizCard from '@/components/quiz/QuizCard'; 
import { Quiz } from '@/types/quiz'; 
 
export default function QuizListPage() { 
  const [quizzes, setQuizzes] = useState<Quiz[]>([]); 
 
  useEffect(() => { 
    // Mock data for development 
    const mockQuizzes: Quiz[] = [ 
      { 
        id: '1', 
        title: 'JavaScript Basics', 
        description: 'Test your JavaScript knowledge', 
        timeLimit: 30, 
        questions: [], 
        createdAt: new Date(), 
        updatedAt: new Date() 
      } 
    ]; 
    setQuizzes(mockQuizzes); 
  }, []); 
 
  return ( 
    <div className="container mx-auto px-4 py-8"> 
      <h1 className="text-2xl font-bold mb-6">Quiz Management</h1> 
      <div className="grid gap-4"> 
        {quizzes.map(quiz => ( 
          <QuizCard key={quiz.id} title={quiz.title} description={quiz.description} /> 
        ))} 
      </div> 
    </div> 
  ); 
} 
