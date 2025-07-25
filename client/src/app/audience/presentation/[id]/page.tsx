'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
// Modern UI components will be replaced with custom styled elements
import DiscussionPanel from '@/components/DiscussionPanel';
import {
  QuizWithRelations,
  QuizQuestion,
  PresentationWithRelations,
  FeedbackType,
  QuizStatus,
  SocketQuizStartData,

  SocketFeedbackData
} from '@/types';

export default function AudiencePresentationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const presentationId = params.id as string;

  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizWithRelations | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quizJustEnded, setQuizJustEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | ''>(FeedbackType.TOO_FAST);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean,
    correctAnswer: string,
    explanation?: string,
    isTimeout?: boolean
  } | null>(null);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  // 记录每道题的作答状态 - key: questionId, value: {answer, result, timestamp}
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, {
    selectedAnswer: string;
    result: {
      isCorrect: boolean;
      correctAnswer: string;
      explanation?: string;
      isTimeout?: boolean;
    };
    timestamp: Date;
  }>>({});

  // 从localStorage加载答题记录
  useEffect(() => {
    if (typeof window !== 'undefined' && currentQuiz) {
      const storageKey = `quiz-answers-${currentQuiz.id}`;
      const savedAnswers = localStorage.getItem(storageKey);
      if (savedAnswers) {
        try {
          const parsedAnswers = JSON.parse(savedAnswers);
          // 转换timestamp字符串回Date对象
          Object.keys(parsedAnswers).forEach(questionId => {
            parsedAnswers[questionId].timestamp = new Date(parsedAnswers[questionId].timestamp);
          });
          setQuestionAnswers(parsedAnswers);
          console.log('📂 从本地存储加载已保存的答案:', parsedAnswers);
        } catch (error) {
          console.error('❌ 解析已保存答案失败:', error);
        }
      }
    }
  }, [currentQuiz]);

  // 保存答题记录到localStorage
  const saveAnswersToStorage = (answers: typeof questionAnswers) => {
    if (typeof window !== 'undefined' && currentQuiz) {
      const storageKey = `quiz-answers-${currentQuiz.id}`;
      localStorage.setItem(storageKey, JSON.stringify(answers));
      console.log('💾 答案已保存到本地存储:', answers);
    }
  };

  useEffect(() => {
    if (user && user.role === 'AUDIENCE') {
      loadPresentation();
    }
  }, [presentationId, user]);

  // 单独的useEffect处理Socket监听器
  useEffect(() => {
    if (user && user.role === 'AUDIENCE') {
      setupSocketListeners();
    }

    return () => {
      // 离开房间
      socketService.emit('leave-presentation', presentationId);
      // 监听器清理在setupSocketListeners中处理
    };
  }, [presentationId, user]); // 包含user依赖，确保user加载后设置监听器

  // 监听测验状态变化，如果变为COMPLETED且之前是ACTIVE，则显示结束界面
  useEffect(() => {
    if (currentQuiz && currentQuiz.status === QuizStatus.COMPLETED && !quizJustEnded) {
      console.log('🏁 [观众端] Quiz status changed to COMPLETED, showing end screen');
      setQuizJustEnded(true);
      setTimeLeft(0);
      setShowResults(true);
    }
  }, [currentQuiz?.status, quizJustEnded]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeLeft > 0 && currentQuiz?.status === 'ACTIVE') {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && currentQuiz?.status === 'ACTIVE') {
      // Time's up - handle timeout
      if (!hasAnswered) {
        console.log('⏰ 时间到！');
        if (selectedAnswer) {
          // Auto-submit if an answer is selected
          console.log('📤 自动提交已选答案:', selectedAnswer);
          submitAnswer();
        } else {
          // Mark as timeout without answer
          console.log('❌ 超时未答题');
          if (currentQuiz && currentQuiz.questions[currentQuestionIndex]) {
            const currentQuestion = currentQuiz.questions[currentQuestionIndex];
            const result = {
              isCorrect: false,
              correctAnswer: currentQuestion.correctAnswer,
              explanation: '时间到！您没有选择答案。',
              isTimeout: true
            };

            setHasAnswered(true);
            setAnswerResult(result);

            // 保存超时状态到questionAnswers中
            setQuestionAnswers(prev => {
              const newAnswers = {
                ...prev,
                [currentQuestion.id]: {
                  selectedAnswer: '',
                  result,
                  timestamp: new Date()
                }
              };
              saveAnswersToStorage(newAnswers);
              return newAnswers;
            });

            // 更新统计数据
            setTotalAnswered(prev => prev + 1);
            // 超时不算正确答案，所以不增加totalCorrect

            // 通过API提交超时答案进行统计
            apiService.submitAnswer(currentQuiz.id, {
              questionId: currentQuestion.id,
              answer: '' // 空答案表示超时
            }).then(() => {
              console.log('📤 已通过API提交超时答案用于统计');
            }).catch((error) => {
              console.error('❌ 提交超时答案失败:', error);
            });
          }
        }
      }
    }
    return () => clearTimeout(timer);
  }, [timeLeft, currentQuiz, hasAnswered, selectedAnswer]);

  // 检查当前题目是否已作答
  const getCurrentQuestionAnswer = () => {
    if (!currentQuiz || !currentQuiz.questions[currentQuestionIndex]) return null;
    const questionId = currentQuiz.questions[currentQuestionIndex].id;
    return questionAnswers[questionId] || null;
  };

  // 监听题目变化，检查是否已作答并更新状态
  useEffect(() => {
    if (currentQuiz && currentQuiz.questions && currentQuiz.questions[currentQuestionIndex]) {
      const question = currentQuiz.questions[currentQuestionIndex];

      // 使用函数式状态更新来获取最新的questionAnswers
      setQuestionAnswers(currentAnswers => {
        const questionId = question.id;
        const existingAnswer = currentAnswers[questionId];

        console.log('🔍 检查题目ID:', questionId);
        console.log('🔍 题目答案状态:', currentAnswers);
        console.log('🔍 此题目的现有答案:', existingAnswer);

        if (existingAnswer) {
          console.log('📋 此题目已作答:', existingAnswer);
          setHasAnswered(true);
          setSelectedAnswer(existingAnswer.selectedAnswer);
          setAnswerResult(existingAnswer.result);
          setTimeLeft(0); // 已作答的题目不显示倒计时
        } else {
          console.log('❓ 此题目尚未作答');
          setHasAnswered(false);
          setSelectedAnswer('');
          setAnswerResult(null);
          setTimeLeft(15); // 重置时间
        }

        // 返回原始状态，不做修改
        return currentAnswers;
      });
    }
  }, [currentQuestionIndex, currentQuiz]);

  // 移除定期同步机制，避免性能问题

  const loadPresentation = async () => {
    try {
      const response = await apiService.getPresentation(presentationId);
      setPresentation(response.presentation);

      // 检查是否有活跃的Quiz并恢复状态
      const activeQuiz = response.presentation.quizzes?.find((quiz: any) => quiz.status === 'ACTIVE');
      if (activeQuiz) {
        console.log('🎯 页面加载时发现活跃测验:', activeQuiz.title);
        setCurrentQuiz(activeQuiz);

        // 先设置默认状态，等待演讲者端的状态广播
        console.log('🎯 观众端发现活跃Quiz，等待演讲者端状态同步');
        setCurrentQuestionIndex(0); // 默认从第0题开始，等待同步
      }

      // Join the presentation
      await apiService.joinPresentation(presentationId);
    } catch (error) {
      console.error('加载演示失败:', error);
      router.push('/audience/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    console.log('🚨🚨🚨 [观众端] 设置Socket监听器 - 代码已更新!', new Date().toISOString());
    console.log('📡 Setting up socket listeners for presentation:', presentationId);

    const socket = socketService.getSocket();
    if (!socket) {
      console.error('🚨🚨🚨 [观众端] Socket未连接！');
      return;
    }

    console.log('🚨🚨🚨 [观众端] Socket连接状态:', socket.connected);
    console.log('🚨🚨🚨 [观众端] Socket ID:', socket.id);

    // 先清理可能存在的旧监听器
    socketService.off('quiz-started');
    socketService.off('quiz-ended');
    socketService.off('next-question');

    // 立即加入演讲房间
    console.log('🏠 [观众端] 准备加入房间:', presentationId);
    console.log('🏠 [观众端] Socket连接状态:', socket.connected);
    console.log('🏠 [观众端] Socket ID:', socket.id);

    socketService.emit('join-presentation', presentationId);
    console.log('🏠 [观众端] 已发送加入房间请求:', presentationId);

    // 加入房间后，检查是否有正在进行的Quiz并同步状态
    setTimeout(() => {
      if (currentQuiz) {
        console.log('🔄 观众端检测到活跃Quiz，主动同步状态...');
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('sync-question-state', { quizId: currentQuiz.id }, (response: any) => {
            if (response.success) {
              console.log('✅ 观众端同步到Quiz状态:', response.questionIndex);
              setCurrentQuestionIndex(response.questionIndex);
            } else {
              console.log('❓ 观众端同步失败，保持当前状态');
            }
          });
        }
      }
    }, 1000); // 延迟同步，确保房间加入完成

    socketService.on('quiz-started', (data: SocketQuizStartData) => {
      console.log('🎯 Quiz started:', data);
      setCurrentQuiz(data.quiz);
      setCurrentQuestionIndex(data.questionIndex || 0);
      setTimeLeft(data.timeLimit);
      setSelectedAnswer('');
      setHasAnswered(false);
      setShowResults(false);
      setQuizJustEnded(false);
      setAnswerResult(null);
      // 清空之前的答案记录，开始新的Quiz
      setQuestionAnswers({});
      if (typeof window !== 'undefined') {
        const storageKey = `quiz-answers-${data.quiz.id}`;
        localStorage.removeItem(storageKey);
      }
      console.log('🔄 Cleared previous answers for new quiz');

      // 主动同步当前Quiz状态，避免状态不一致
      setTimeout(() => {
        const socket = socketService.getSocket();
        if (socket) {
          console.log('🔄 观众端主动同步Quiz状态...');
          socket.emit('sync-question-state', { quizId: data.quiz.id }, (response: any) => {
            if (response.success) {
              console.log('✅ 观众端同步到Quiz状态:', response.questionIndex);
              setCurrentQuestionIndex(response.questionIndex);
            } else {
              console.log('❓ 观众端同步失败，使用默认状态');
            }
          });
        }
      }, 500); // 延迟同步，确保Quiz已完全启动
    });

    socketService.on('quiz-ended', (data) => {
      console.log('🏁 [观众端] Quiz ended event received:', data);
      console.log('🏁 [观众端] Current quiz:', currentQuiz?.id);
      console.log('🏁 [观众端] Event quiz ID:', data?.quizId);

      // 不要将currentQuiz设置为null，而是更新其状态为COMPLETED
      // 这样讨论面板可以正常显示
      if (currentQuiz) {
        console.log('🏁 [观众端] Setting quiz as completed and showing end screen');
        setCurrentQuiz({
          ...currentQuiz,
          status: QuizStatus.COMPLETED
        });

        // 测验结束后，显示跳转提示而不是自动跳转
        // 让用户自己决定是否查看讨论
        setQuizJustEnded(true);
      } else {
        console.log('🏁 [观众端] No current quiz to end');
      }
      setTimeLeft(0);
      setShowResults(true);
      setCurrentQuestionIndex(0);
      setSelectedAnswer('');
      setHasAnswered(false);
      setAnswerResult(null);
    });

    socketService.on('next-question', (data: { questionIndex: number; quizId: string }) => {
      console.log('🚨🚨🚨 [观众端] 收到题目切换事件:', data);
      console.log('🚨🚨🚨 [观众端] 当前时间:', new Date().toISOString());
      console.log('🚨🚨🚨 [观众端] 事件数据:', JSON.stringify(data));

      // 更新题目，其他状态由useEffect处理
      console.log('🚨🚨🚨 [观众端] 更新题目到:', data.questionIndex + 1);
      setCurrentQuestionIndex(data.questionIndex);

      console.log('🚨🚨🚨 [观众端] 题目切换完成，等待useEffect处理状态');
    });
  };

  const submitAnswer = async () => {
    if (!currentQuiz || !selectedAnswer || hasAnswered) {
      console.log('❌ Cannot submit answer:', {
        hasQuiz: !!currentQuiz,
        hasAnswer: !!selectedAnswer,
        alreadyAnswered: hasAnswered
      });
      return;
    }

    console.log('📤 Submitting answer:', selectedAnswer);

    try {
      const currentQuestion = currentQuiz.questions[currentQuestionIndex];
      await apiService.submitAnswer(currentQuiz.id, {
        questionId: currentQuestion.id,
        answer: selectedAnswer
      });

      setHasAnswered(true);

      // Show immediate feedback: correct or incorrect
      const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
      const result = {
        isCorrect,
        correctAnswer: currentQuestion.correctAnswer
      };
      setAnswerResult(result);

      // 保存答案到questionAnswers中，防止重复作答
      console.log('💾 Saving answer for question:', currentQuestion.id);
      console.log('💾 Answer data:', { selectedAnswer, result });

      setQuestionAnswers(prev => {
        const newAnswers = {
          ...prev,
          [currentQuestion.id]: {
            selectedAnswer,
            result,
            timestamp: new Date()
          }
        };
        console.log('💾 Updated questionAnswers:', newAnswers);
        saveAnswersToStorage(newAnswers);
        return newAnswers;
      });

      // Update statistics
      setTotalAnswered(prev => prev + 1);
      if (isCorrect) {
        setTotalCorrect(prev => prev + 1);
      }

      // 检查是否已完成所有题目
      const totalQuestions = currentQuiz.questions.length;
      const answeredCount = Object.keys(questionAnswers).length + 1; // +1 因为当前答案还没有更新到state
      console.log('📊 [观众端] 答题进度:', { answeredCount, totalQuestions });

      // 如果已完成所有题目，延迟显示结束界面
      if (answeredCount >= totalQuestions) {
        console.log('🎉 [观众端] 所有题目已完成，准备显示结束界面');
        setTimeout(() => {
          console.log('🏁 [观众端] 显示测验完成界面');
          setQuizJustEnded(true);
          setTimeLeft(0);
          setShowResults(true);
        }, 2000); // 2秒后显示，让用户看到最后一题的结果
      }

      // 注意：不再通过Socket发送答案，避免重复提交
      // API提交已经足够，Socket只用于实时统计更新
    } catch (error) {
      console.error('提交答案失败:', error);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackType) return;

    try {
      const feedbackData: SocketFeedbackData = {
        presentationId,
        type: feedbackType as FeedbackType,
        message: feedbackMessage || undefined
      };

      // 只通过Socket.IO提交反馈（实时且持久化）
      socketService.emit('submit-feedback', feedbackData);
      console.log('✅ 反馈已通过Socket.IO提交');

      setFeedbackType('');
      setFeedbackMessage('');
      alert('反馈提交成功！');
    } catch (error) {
      console.error('提交反馈失败:', error);
      alert('反馈提交失败，请重试');
    }
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

  // Redirect if not authenticated or wrong role
  if (!user || user.role !== 'AUDIENCE') {
    setTimeout(() => {
      window.location.href = '/auth/login';
    }, 100);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">正在重定向到登录...</p>
        </div>
      </div>
    );
  }

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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
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
              演示未找到
            </h2>
            <button
              onClick={() => router.push('/audience/dashboard')}
              className="btn-secondary"
            >
              返回仪表板
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = currentQuiz?.questions[currentQuestionIndex];

  // 调试信息（仅在开发模式下）
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Render state:', {
      currentQuiz: currentQuiz?.id,
      currentQuestionIndex,
      totalQuestions: currentQuiz?.questions?.length,
      currentQuestion: currentQuestion?.id,
      hasCurrentQuestion: !!currentQuestion
    });
  }

  return (
    <div className="page-container">
      {/* Modern Header */}
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {presentation?.title || '正在加载...'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                演讲者: {presentation?.speaker?.username || '正在加载...'}
              </p>
            </div>
            <button
              onClick={() => router.push('/audience/dashboard')}
              className="btn-secondary animate-slide-in-right"
            >
              离开演示
            </button>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* Waiting State */}
          {!currentQuiz && (
            <div className="modern-card text-center p-8 animate-fade-in-up">
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                等待测验
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                演讲者即将开始测验。请保持关注！
              </p>
              <div className="py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center animate-pulse"
                  style={{
                    background: 'rgba(0, 122, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0, 122, 255, 0.2)'
                  }}>
                  <svg className="w-8 h-8" fill="rgba(0, 122, 255, 0.8)" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  准备参与...
                </p>
              </div>
            </div>
          )}

          {/* Quiz Ended - Show Discussion Option */}
          {currentQuiz && quizJustEnded && (
            <div className="modern-card text-center p-8 animate-fade-in-up">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
                  boxShadow: '0 4px 15px rgba(52, 199, 89, 0.25)'
                }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                测验已完成！
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                感谢您的参与！现在可以查看答案解析并参与讨论
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push(`/audience/presentation/${presentationId}/discussion/${currentQuiz.id}`)}
                  className="btn-primary"
                >
                  查看答案解析与讨论
                </button>
                <button
                  onClick={() => setQuizJustEnded(false)}
                  className="btn-secondary"
                >
                  继续等待下一个测验
                </button>
              </div>
            </div>
          )}

          {/* Active Quiz */}
          {currentQuiz && currentQuestion && !quizJustEnded && (
            <div className="modern-card animate-fade-in-up">
              <div className="p-6">
                {/* Quiz Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%)',
                        boxShadow: '0 4px 15px rgba(255, 59, 48, 0.25)'
                      }}>
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {currentQuiz.title}
                      </h2>
                      <div className="flex items-center gap-4 text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span>第 {currentQuestionIndex + 1} 题，共 {currentQuiz.questions.length} 题</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${currentQuiz.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span>{currentQuiz.status === 'ACTIVE' ? '进行中' : '等待中'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-1 ${timeLeft <= 5 ? 'text-red-600' : 'text-blue-600'}`}>
                      {timeLeft}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      剩余秒数
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${(timeLeft / (currentQuiz.timeLimit || 10)) * 100}%` }}
                    ></div>
                  </div>
                </div>
                {/* Question Content */}
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                        {currentQuestion.question}
                      </h3>
                    </div>
                    {getCurrentQuestionAnswer() && (
                      <div className="ml-4 px-4 py-2 rounded-full font-semibold text-sm"
                        style={{
                          background: 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)',
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(52, 199, 89, 0.25)'
                        }}>
                        <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                        已作答
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <button
                        key={option}
                        onClick={() => !hasAnswered && setSelectedAnswer(option)}
                        disabled={hasAnswered}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] ${selectedAnswer === option
                          ? 'border-blue-500 bg-blue-50 shadow-lg'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          } ${hasAnswered ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{
                          boxShadow: selectedAnswer === option ? '0 4px 16px rgba(0, 122, 255, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.04)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedAnswer === option
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                            }`}>
                            {option}
                          </div>
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {currentQuestion[`option${option}` as keyof QuizQuestion]}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    {hasAnswered ? (
                      <div className="space-y-1">
                        <span className="text-green-600 font-medium">✓ 答案已提交</span>
                        {answerResult && (
                          <div className={`text-sm font-medium ${answerResult.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {answerResult.isTimeout
                              ? '⏰ 时间到！未提交答案。'
                              : answerResult.isCorrect
                                ? '🎉 正确！'
                                : `❌ 错误。正确答案：${answerResult.correctAnswer}`
                            }
                            {answerResult.explanation && (
                              <div className="text-xs text-gray-600 mt-1">
                                {answerResult.explanation}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600">选择答案</span>
                    )}
                  </div>
                  <button
                    onClick={submitAnswer}
                    disabled={!selectedAnswer || hasAnswered || timeLeft === 0}
                    className={`w-full py-3 text-lg font-medium transition-all rounded-md ${hasAnswered
                      ? 'bg-green-50 border border-green-300 text-green-700'
                      : timeLeft === 0
                        ? 'bg-red-50 border border-red-300 text-red-700'
                        : !selectedAnswer
                          ? 'opacity-50 cursor-not-allowed bg-gray-300'
                          : 'btn-primary'
                      }`}
                  >
                    {hasAnswered
                      ? '✓ 已提交'
                      : timeLeft === 0
                        ? '⏰ 时间到'
                        : '提交答案'
                    }
                  </button>
                </div>

                {/* Show current session statistics */}
                {totalAnswered > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">本次会话表现</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{totalAnswered}</div>
                        <div className="text-blue-700">已答题数</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{totalCorrect}</div>
                        <div className="text-green-700">正确答案</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">
                          {totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%
                        </div>
                        <div className="text-purple-700">准确率</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 如果用户已完成所有题目，显示进入讨论的选项 */}
                {Object.keys(questionAnswers).length >= currentQuiz.questions.length && (
                  <div className="mt-4 p-4 rounded-lg border-2 border-green-200 bg-green-50">
                    <div className="text-center">
                      <h4 className="font-semibold text-green-800 mb-2">🎉 您已完成所有题目！</h4>
                      <p className="text-sm text-green-700 mb-3">
                        您可以查看答案解析并参与讨论，或等待演讲者结束测验。
                      </p>
                      <button
                        onClick={() => {
                          console.log('🎯 [观众端] 用户手动进入讨论');
                          setQuizJustEnded(true);
                          setTimeLeft(0);
                          setShowResults(true);
                        }}
                        className="btn-primary"
                      >
                        查看答案解析与讨论
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feedback Section */}
          <div className="modern-card mt-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                提供反馈
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                帮助改善演示体验
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    反馈类型
                  </label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value as FeedbackType | '')}
                    className="modern-select"
                  >
                    <option value="TOO_FAST">讲话太快</option>
                    <option value="TOO_SLOW">讲话太慢</option>
                    <option value="BORING">内容无聊</option>
                    <option value="POOR_QUESTIONS">测验题目质量差</option>
                    <option value="GENERAL">一般反馈</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    消息（可选）
                  </label>
                  <textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)'
                    }}
                    rows={3}
                    placeholder="其他评论..."
                  />
                </div>
                <button
                  onClick={submitFeedback}
                  disabled={!feedbackType}
                  className="btn-secondary"
                >
                  提交反馈
                </button>
              </div>
            </div>
          </div>

          {/* Discussion Panel - Show after quiz completion */}
          {currentQuiz && (
            <DiscussionPanel
              quizId={currentQuiz.id}
              quizTitle={currentQuiz.title}
              isQuizCompleted={currentQuiz.status === QuizStatus.COMPLETED}
              quizQuestions={currentQuiz.questions}
            />
          )}
        </div>
      </main>
    </div>
  );
}
