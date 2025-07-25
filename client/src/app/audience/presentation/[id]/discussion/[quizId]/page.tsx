'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { QuizWithRelations, PresentationWithRelations } from '@/types';
import DiscussionPanel from '@/components/DiscussionPanel';

export default function QuizDiscussionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const presentationId = params.id as string;
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<QuizWithRelations | null>(null);
  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !authLoading) {
      loadData();
    }
  }, [presentationId, quizId, user, authLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 加载测验数据
      const quizResponse = await apiService.getQuiz(quizId);
      setQuiz(quizResponse.quiz);
      
      // 加载演示数据
      const presentationResponse = await apiService.getPresentation(presentationId);
      setPresentation(presentationResponse.presentation);
      
    } catch (error) {
      console.error('加载数据失败:', error);
      alert('加载数据失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.push(`/audience/presentation/${presentationId}`);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="modern-card p-8 max-w-md mx-auto animate-fade-in-up">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              正在加载讨论数据...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz || !presentation) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="modern-card p-8 max-w-md mx-auto animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              未找到测验或演示
            </h2>
            <button onClick={goBack} className="btn-secondary">
              返回演示
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                测验讨论
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {presentation.title} - {quiz.title}
              </p>
            </div>
            <button onClick={goBack} className="btn-secondary animate-slide-in-right">
              返回演示
            </button>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* 测验结果总结 */}
          <div className="modern-card p-6 animate-fade-in-up">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
                  boxShadow: '0 4px 15px rgba(52, 199, 89, 0.25)'
                }}>
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  测验已完成
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  感谢您的参与！现在可以查看答案解析并参与讨论
                </p>
              </div>
            </div>
          </div>

          {/* 题目答案解析 */}
          <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)',
                  boxShadow: '0 4px 15px rgba(0, 122, 255, 0.25)'
                }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                答案解析
              </h3>
            </div>

            <div className="space-y-6">
              {quiz.questions.map((question, index) => (
                <div key={question.id} 
                  className="rounded-xl p-6 transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                    border: '1px solid var(--border-light)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                  }}>
                  
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: 'var(--primary)' }}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                        {question.question}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {['A', 'B', 'C', 'D'].map((option) => {
                          const optionText = question[`option${option}` as keyof typeof question] as string;
                          const isCorrect = question.correctAnswer === option;
                          
                          return (
                            <div key={option}
                              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                                isCorrect 
                                  ? 'border-green-500 bg-green-50' 
                                  : 'border-gray-200 bg-gray-50'
                              }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                                  isCorrect 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-300 text-gray-600'
                                }`}>
                                  {option}
                                </div>
                                <span className={isCorrect ? 'text-green-700 font-medium' : 'text-gray-600'}>
                                  {optionText}
                                </span>
                                {isCorrect && (
                                  <svg className="w-5 h-5 text-green-500 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {question.explanation && (
                        <div className="p-4 rounded-lg"
                          style={{
                            background: 'linear-gradient(135deg, #E8F5E8 0%, #F0F9F0 100%)',
                            border: '1px solid #34C759'
                          }}>
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <h5 className="font-semibold text-green-800 mb-1">解析</h5>
                              <p className="text-green-700 text-sm leading-relaxed">
                                {question.explanation}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 讨论区 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <DiscussionPanel
              quizId={quizId}
              quizTitle={quiz.title}
              isQuizCompleted={true}
              quizQuestions={quiz.questions}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
