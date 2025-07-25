'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
// Modern UI components will be replaced with custom styled elements
import FileUpload from '@/components/FileUpload';
import {
  QuizWithRelations,
  QuizQuestion,
  PresentationWithRelations,
  QuizStats,
  Feedback,
  CreateQuizData
} from '@/types';

export default function SpeakerPresentationPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const presentationId = params.id as string;

  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizWithRelations | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);

  useEffect(() => {
    // Redirect to manage page for better UX
    router.push(`/speaker/presentation/${presentationId}/manage`);
  }, [presentationId, router]);

  const loadPresentation = async () => {
    try {
      const response = await apiService.getPresentation(presentationId);
      setPresentation(response.presentation);

      // Connect to socket room
      const socket = socketService.getSocket();
      if (socket) {
        socketService.emit('join-presentation', presentationId);
      }
    } catch (error) {
      console.error('Failed to load presentation:', error);
      router.push('/speaker/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    // Check if socket is available before setting up listeners
    const socket = socketService.getSocket();
    if (!socket) {
      console.warn('Socket not connected, skipping listener setup');
      return;
    }

    socketService.on('quiz-stats-updated', (stats: QuizStats) => {
      setQuizStats(stats);
    });

    socketService.on('feedback-received', (feedback: Feedback) => {
      setFeedbacks(prev => [feedback, ...prev]);
    });
  };

  const startQuiz = async (quizId: string) => {
    try {
      const socket = socketService.getSocket();
      if (socket) {
        socketService.emit('start-quiz', {
          quizId,
          presentationId
        });

        // Find and set current quiz
        const quiz = presentation?.quizzes.find(q => q.id === quizId);
        if (quiz) {
          setCurrentQuiz(quiz);
        }
      } else {
        console.warn('Socket not connected, cannot start quiz');
      }
    } catch (error) {
      console.error('Failed to start quiz:', error);
    }
  };

  const endQuiz = async () => {
    if (!currentQuiz) return;

    try {
      const socket = socketService.getSocket();
      if (socket) {
        socketService.emit('end-quiz', {
          quizId: currentQuiz.id,
          presentationId
        });

        setCurrentQuiz(null);
      } else {
        console.warn('Socket not connected, cannot end quiz');
      }
    } catch (error) {
      console.error('Failed to end quiz:', error);
    }
  };

  const createSampleQuiz = async () => {
    try {
      const sampleQuiz: CreateQuizData = {
        presentationId,
        title: 'Sample Quiz',
        questions: [
          {
            question: 'What is the main topic of this presentation?',
            optionA: 'Technology',
            optionB: 'Business',
            optionC: 'Education',
            optionD: 'Science',
            correctAnswer: 'A',
            explanation: 'This presentation focuses on technology topics.',
            order: 1
          }
        ],
        timeLimit: 10
      };

      await apiService.createQuiz(sampleQuiz);
      loadPresentation(); // Refresh to get new quiz
      setShowCreateQuiz(false);
    } catch (error) {
      console.error('Failed to create quiz:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto rounded-full flex items-center justify-center animate-spin"
            style={{
              background: 'rgba(0, 122, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              border: '3px solid var(--border-light)',
              borderTop: '3px solid var(--primary)'
            }}>
            <svg className="w-16 h-16" fill="var(--primary)" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
            </svg>
          </div>
          <p className="mt-4 text-lg text-gray-600">正在加载演示...</p>
        </div>
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="modern-card p-8 max-w-md mx-auto animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Presentation not found
            </h2>
            <button
              onClick={() => router.push('/speaker/dashboard')}
              className="btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{presentation.title}</h1>
              <p className="text-gray-600">Organizer: {presentation.organizer.username}</p>
              <p className="text-sm text-gray-500">
                Audience: {presentation.audience.length} participants
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateQuiz(true)}
                className="btn-primary"
              >
                Create Quiz
              </button>
              <button
                onClick={() => router.push('/speaker/dashboard')}
                className="btn-secondary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quiz Control Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload Section */}
            <FileUpload
              presentationId={presentationId}
              onUploadSuccess={(result) => {
                console.log('Upload successful:', result);
                // Refresh presentation data to show new content
                loadPresentation();
              }}
            />
            {/* Current Quiz Status */}
            {currentQuiz ? (
              <div className="modern-card animate-fade-in-up" style={{ borderLeft: '4px solid var(--success)' }}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--success)' }}>
                      Active Quiz: {currentQuiz.title}
                    </h3>
                    <button onClick={endQuiz} className="btn-primary" style={{ backgroundColor: 'var(--error)' }}>
                      End Quiz
                    </button>
                  </div>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    测验正在进行中
                  </p>
                  <div className="space-y-4">
                    {currentQuiz.questions.map((question, index) => (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <h3 className="font-medium mb-2">
                          Question {index + 1}: {question.question}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>A. {question.optionA}</div>
                          <div>B. {question.optionB}</div>
                          <div>C. {question.optionC}</div>
                          <div>D. {question.optionD}</div>
                        </div>
                        <div className="mt-2 text-sm text-green-600">
                          Correct Answer: {question.correctAnswer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="modern-card animate-fade-in-up">
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Quiz Control
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Start a quiz for your audience
                  </p>
                  {presentation.quizzes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>暂无可用测验</p>
                      <button onClick={() => setShowCreateQuiz(true)} className="btn-primary">
                        Create Your First Quiz
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {presentation.quizzes.map((quiz) => (
                        <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{quiz.title}</h3>
                              <p className="text-sm text-gray-600">
                                {quiz.questions.length} questions • {quiz.timeLimit}s per question
                              </p>
                            </div>
                            <button
                              onClick={() => startQuiz(quiz.id)}
                              className="btn-primary text-sm px-3 py-1"
                            >
                              Start Quiz
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quiz Statistics */}
            {quizStats && (
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Live Quiz Statistics
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    Real-time audience responses
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{quizStats.totalParticipants}</div>
                      <div className="text-sm text-gray-600">参与者</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{quizStats.totalAnswers}</div>
                      <div className="text-sm text-gray-600">总答题数</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {quizStats.questionStats.map((stat, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <h4 className="font-medium mb-3">Question {index + 1}: {stat.question}</h4>
                        <div className="space-y-2">
                          {Object.entries(stat.optionCounts).map(([option, count]) => (
                            <div key={option} className="flex items-center">
                              <span className="w-8 text-sm font-medium">{option}:</span>
                              <div className="flex-1 mx-3">
                                <div className="bg-gray-200 rounded-full h-4">
                                  <div
                                    className={`h-4 rounded-full ${option === stat.correctAnswer ? 'bg-green-500' : 'bg-blue-500'
                                      }`}
                                    style={{
                                      width: `${stat.totalAnswers > 0 ? (count / stat.totalAnswers) * 100 : 0}%`
                                    }}
                                  ></div>
                                </div>
                              </div>
                              <span className="text-sm text-gray-600">{count}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-green-600">
                            Correct answers: {stat.correctCount}/{stat.totalAnswers}
                          </span>
                          <span className="ml-4 text-gray-600">
                            ({stat.totalAnswers > 0 ? ((stat.correctCount / stat.totalAnswers) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Create Quiz Form */}
            {showCreateQuiz && (
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Create Sample Quiz
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    Quick demo quiz creation
                  </p>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      This will create a sample quiz with one question for demonstration purposes.
                    </p>
                    <div className="flex gap-4">
                      <button onClick={createSampleQuiz} className="btn-primary">
                        Create Sample Quiz
                      </button>
                      <button
                        onClick={() => setShowCreateQuiz(false)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feedback Panel */}
          <div>
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Live Feedback
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  实时听众反馈
                </p>
                {feedbacks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无反馈</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {feedbacks.map((feedback, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs px-2 py-1 rounded ${feedback.type === 'TOO_FAST' ? 'bg-red-100 text-red-800' :
                            feedback.type === 'TOO_SLOW' ? 'bg-yellow-100 text-yellow-800' :
                              feedback.type === 'BORING' ? 'bg-gray-100 text-gray-800' :
                                feedback.type === 'POOR_QUESTIONS' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                            }`}>
                            {feedback.type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(feedback.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {feedback.message && (
                          <p className="text-sm text-gray-700">{feedback.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
