'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
import DiscussionPanel from '@/components/DiscussionPanel';
import {
  QuizWithRelations,
  PresentationWithRelations,
  QuizStats,
  QuizStatus,
  Feedback,
} from '@/types';

export default function LivePresentationPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const presentationId = params.id as string;

  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizWithRelations | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // 反馈类型翻译
  const getFeedbackTypeText = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'TOO_FAST': '太快了',
      'TOO_SLOW': '太慢了',
      'BORING': '内容无聊',
      'POOR_QUESTIONS': '题目质量差',
      'GENERAL': '一般反馈'
    };
    return typeMap[type] || type;
  };

  useEffect(() => {
    console.log('🔍 Live page useEffect - user:', user, 'authLoading:', authLoading);

    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    if (!user) {
      console.log('❌ No user found, redirecting to login');
      window.location.href = '/auth/login';
      return;
    }

    if (user.role !== 'SPEAKER') {
      console.log('❌ User is not a speaker, redirecting to dashboard');
      window.location.href = '/speaker/dashboard';
      return;
    }

    console.log('✅ User verified as speaker, loading presentation');
    loadPresentation();

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socketService.emit('leave-presentation', presentationId);
      }
    };
  }, [presentationId, user, authLoading]);

  // 单独的useEffect处理Socket监听器
  useEffect(() => {
    if (!authLoading && user && user.role === 'SPEAKER') {
      setupSocketListeners();
    }

    return () => {
      // 清理Socket监听器
      socketService.off('quiz-stats-updated');
      socketService.off('feedback-received');
      socketService.off('quiz-started');
      socketService.off('next-question');
      socketService.off('quiz-ended');
    };
  }, [presentationId, user, authLoading]); // 包含所有相关依赖

  const loadPresentation = async () => {
    try {
      console.log('🔄 Loading presentation:', presentationId);
      const response = await apiService.getPresentation(presentationId);
      console.log('✅ Presentation loaded:', response);

      if (!response.presentation) {
        console.error('❌ No presentation data in response');
        setTimeout(() => {
          window.location.href = '/speaker/dashboard';
        }, 100);
        return;
      }

      setPresentation(response.presentation);
      console.log('✅ Presentation state set');
      console.log('📊 Quiz数据详情:', response.presentation.quizzes);
      console.log('📊 DRAFT Quiz数量:', response.presentation.quizzes?.filter(q => q.status === 'DRAFT').length || 0);
      console.log('📊 所有Quiz状态:', response.presentation.quizzes?.map(q => ({ title: q.title, status: q.status })) || []);

      // 从数据库加载现有反馈
      try {
        const feedbackResponse = await apiService.getFeedback(presentationId);
        if ((feedbackResponse as any).feedbacks) {
          setFeedbacks((feedbackResponse as any).feedbacks);
          console.log('📝 已加载现有反馈:', (feedbackResponse as any).feedbacks.length);
        }
      } catch (feedbackError) {
        console.warn('⚠️ 加载现有反馈失败:', feedbackError);
      }

      // Check if there's an active quiz and set it as current
      const activeQuiz = response.presentation.quizzes?.find((quiz: any) => quiz.status === 'ACTIVE');
      if (activeQuiz) {
        console.log('🎯 Found active quiz:', activeQuiz.title);
        setCurrentQuiz(activeQuiz);

        // 延迟获取Quiz状态，确保Socket连接已建立
        setTimeout(() => {
          const socket = socketService.getSocket();
          if (socket) {
            console.log('🔍 演讲者页面请求Quiz状态...');
            socket.emit('get-quiz-state', { quizId: activeQuiz.id }, (response: any) => {
              if (response.success && response.state) {
                console.log('📊 演讲者页面恢复Quiz状态:', response.state);
                setCurrentQuestionIndex(response.state.currentQuestionIndex);
                console.log('✅ 演讲者状态已恢复，不主动广播（观众端会主动同步）');
              } else {
                console.log('❓ 演讲者页面无保存状态，从第0题开始');
                setCurrentQuestionIndex(0);
                console.log('✅ 演讲者状态已初始化，不主动广播（观众端会主动同步）');
              }
            });
          } else {
            console.warn('⚠️ 演讲者页面Socket未连接，使用默认状态');
            setCurrentQuestionIndex(0); // Default to first question
          }
        }, 300); // 稍短的延迟，因为演讲者页面通常先连接
      } else {
        // Clear current quiz if no active quiz found
        if (currentQuiz) {
          console.log('🔄 Clearing current quiz - no active quiz found');
          setCurrentQuiz(null);
          setCurrentQuestionIndex(-1);
        }
      }

      // Socket房间加入逻辑已移至setupSocketListeners
    } catch (error) {
      console.error('❌ Failed to load presentation:', error);
      setTimeout(() => {
        window.location.href = '/speaker/dashboard';
      }, 100);
      return;
    } finally {
      console.log('✅ Setting loading to false');
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) {
      console.warn('Socket not connected, skipping listener setup');
      return;
    }

    console.log('🚨🚨🚨 [演讲者] 设置Socket监听器');

    // 立即加入演讲房间
    console.log('🔌 [演讲者] 加入房间:', presentationId);
    socketService.emit('join-presentation', presentationId);

    socketService.on('quiz-stats-updated', (stats: QuizStats) => {
      setQuizStats(stats);
    });

    socketService.on('feedback-received', (feedback: Feedback) => {
      setFeedbacks(prev => [feedback, ...prev]);
    });

    // 监听quiz-started事件以确保与观众同步
    socketService.on('quiz-started', (data: { quiz: any; questionIndex: number; timeLimit: number }) => {
      console.log('🎯 [演讲者] 收到quiz-started事件:', data);
      console.log('🔄 [演讲者] 同步测验状态...');

      // 确保演讲者页面与观众同步
      setCurrentQuiz(data.quiz);
      setCurrentQuestionIndex(data.questionIndex);

      console.log('✅ [演讲者] 测验状态已同步');
    });

    // Speaker不需要监听next-question事件，因为Speaker是事件的发起者
    // 移除这个监听器以避免状态冲突

    socketService.on('quiz-ended', (data: { quizId: string }) => {
      console.log('🏁 Speaker received quiz-ended event:', data);
      setCurrentQuiz(null);
      setCurrentQuestionIndex(-1);
    });
  };

  const startQuiz = async (quizId: string) => {
    try {
      console.log('🚀 [演讲者] 开始启动测验:', quizId);

      // Update quiz status to ACTIVE
      await apiService.updateQuizStatus(quizId, 'ACTIVE');
      console.log('✅ [演讲者] 测验状态已更新为ACTIVE');

      const socket = socketService.getSocket();
      if (socket) {
        console.log('📡 [演讲者] 发送start-quiz事件...');
        socketService.emit('start-quiz', {
          quizId,
          presentationId,
          questionIndex: 0
        });
        console.log('✅ [演讲者] start-quiz事件已发送，等待quiz-started回调...');

        // 不再在这里直接设置状态，让quiz-started事件处理同步
        // 这样确保演讲者和观众完全同步
      } else {
        console.error('❌ [演讲者] Socket未连接');
      }
    } catch (error: any) {
      console.error('Failed to start quiz:', error);

      // 处理特定错误
      if (error.message?.includes('another quiz is already active')) {
        alert('无法启动Quiz：已有其他Quiz正在运行。\n\n请先结束当前活跃的Quiz，然后再启动新的Quiz。\n页面将刷新以显示当前状态。');
        // 刷新演讲数据以获取最新状态并显示活跃的Quiz
        loadPresentation();
      } else if (error.message?.includes('Cannot restart a completed quiz')) {
        alert('无法重新启动已完成的Quiz。\n\nQuiz状态是不可逆的：开始 → 结束 → 已完成');
      } else {
        alert(`启动Quiz失败: ${error.message || '未知错误'}`);
        // 刷新演讲数据以获取最新状态
        loadPresentation();
      }
    }
  };

  const nextQuestion = () => {
    if (!currentQuiz || currentQuestionIndex >= currentQuiz.questions.length - 1) return;

    const nextIndex = currentQuestionIndex + 1;
    console.log('🔥🔥🔥 [演讲者] 切换到下一题');
    console.log('🔥🔥🔥 [演讲者] 从第', currentQuestionIndex + 1, '题到第', nextIndex + 1, '题');

    // 立即更新本地状态
    setCurrentQuestionIndex(nextIndex);

    // 发送Socket事件
    const eventData = {
      presentationId,
      quizId: currentQuiz.id,
      questionIndex: nextIndex
    };

    console.log('🔥🔥🔥 [演讲者] 发送事件:', eventData);
    socketService.emit('next-question', eventData);

    console.log('🔥🔥🔥 [演讲者] 事件已发送');
  };

  const previousQuestion = () => {
    if (!currentQuiz || currentQuestionIndex <= 0) return;

    const prevIndex = currentQuestionIndex - 1;
    setCurrentQuestionIndex(prevIndex);

    const socket = socketService.getSocket();
    if (socket) {
      socketService.emit('next-question', {
        presentationId,
        quizId: currentQuiz.id,
        questionIndex: prevIndex
      });
    }
  };

  const endQuiz = async () => {
    if (!currentQuiz) return;

    try {
      // Update quiz status to COMPLETED
      await apiService.updateQuizStatus(currentQuiz.id, QuizStatus.COMPLETED);

      const socket = socketService.getSocket();
      if (socket) {
        socketService.emit('end-quiz', {
          quizId: currentQuiz.id,
          presentationId
        });

        setCurrentQuiz(null);
        setCurrentQuestionIndex(-1);
      }

      // Reload presentation to get updated quiz statuses
      loadPresentation();
    } catch (error: any) {
      console.error('Failed to end quiz:', error);
      alert(`结束Quiz失败: ${error.message || '未知错误'}`);
    }
  };



  const backToManage = () => {
    setTimeout(() => {
      window.location.href = `/speaker/presentation/${presentationId}/manage`;
    }, 100);
  };

  const endPresentation = async () => {
    if (!confirm('您确定要结束此演示吗？这将停止所有活跃的测验。')) {
      return;
    }

    try {
      // End the presentation via API
      await apiService.endPresentation(presentationId);

      // Navigate back to dashboard
      setTimeout(() => {
        window.location.href = '/speaker/dashboard';
      }, 100);
    } catch (error: any) {
      alert(error.message || '结束演示失败');
    }
  };

  // Show loading while checking auth
  if (authLoading) {
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
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <p className="mt-4 text-lg text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated or wrong role
  if (!user || user.role !== 'SPEAKER') {
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

  if (authLoading || loading) {
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
          <p className="mt-4 text-lg text-gray-600">
            {authLoading ? '🔐 正在验证身份...' : '📊 正在加载演示...'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            演示ID: {presentationId}
          </p>
          <div className="mt-4 text-xs text-gray-400">
            <p>身份验证加载中: {authLoading ? '是' : '否'}</p>
            <p>数据加载中: {loading ? '是' : '否'}</p>
            <p>用户: {user ? `${user.email} (${user.role})` : '无'}</p>
          </div>
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
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                  window.location.href = '/speaker/dashboard';
                }, 100);
              }}
              className="btn-secondary"
            >
              返回仪表板
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Modern Header */}
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                🔴 LIVE: {presentation.title}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                听众: {presentation.audience?.length || 0} 位参与者
              </p>
            </div>
            <div className="flex gap-3 animate-slide-in-right">
              <button onClick={backToManage} className="btn-secondary">
                返回管理
              </button>
              <button onClick={endPresentation} className="btn-primary" style={{ backgroundColor: 'var(--error)' }}>
                结束演示
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Quiz Control */}
          <div className="xl:col-span-3 space-y-6">
            <div className="modern-card animate-fade-in-up">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  测验控制
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  为您的听众开始测验
                </p>
                <div className="space-y-4">
                  {/* Quiz List with Status Bars */}
                  {presentation.quizzes && presentation.quizzes.length > 0 ? (
                    presentation.quizzes.map((quiz) => {
                      const isActive = currentQuiz?.id === quiz.id;
                      const isDraft = quiz.status === QuizStatus.DRAFT;
                      const isCompleted = quiz.status === QuizStatus.COMPLETED;

                      return (
                        <div
                          key={quiz.id}
                          className={`p-4 rounded-lg transition-all ${isActive
                            ? 'border border-green-500 bg-green-50'
                            : isCompleted
                              ? 'border border-gray-300 bg-gray-50'
                              : 'border border-blue-300 bg-blue-50'
                            }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`w-3 h-3 rounded-full ${isActive
                                  ? 'bg-green-500 animate-pulse'
                                  : isCompleted
                                    ? 'bg-gray-400'
                                    : 'bg-blue-500'
                                  }`}></span>
                                <h3 className="font-semibold">{quiz.title}</h3>
                              </div>

                              <div className="flex items-center gap-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${isActive
                                  ? 'bg-green-100 text-green-800'
                                  : isCompleted
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-blue-100 text-blue-800'
                                  }`}>
                                  {isActive ? '🔴 直播中' : isCompleted ? '✅ 已完成' : '📋 就绪'}
                                </span>
                                <span className="text-gray-600">
                                  {(quiz as any).questions?.length || 0} 道题
                                </span>
                                {isActive && (
                                  <span className="text-green-600 font-medium">
                                    第 {currentQuestionIndex + 1}/{currentQuiz?.questions.length} 题
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {/* 只有DRAFT状态且未激活的Quiz可以启动 */}
                              {isDraft && !isActive && (
                                <button
                                  onClick={() => startQuiz(quiz.id)}
                                  className="btn-primary text-sm px-3 py-1"
                                  style={{ backgroundColor: 'var(--success)' }}
                                >
                                  开始测验
                                </button>
                              )}

                              {/* 只有激活的Quiz可以结束 */}
                              {isActive && (
                                <button
                                  onClick={endQuiz}
                                  className="btn-primary text-sm px-3 py-1"
                                  style={{ backgroundColor: 'var(--error)' }}
                                >
                                  结束测验
                                </button>
                              )}

                              {/* 已完成的Quiz显示状态，不可操作 */}
                              {isCompleted && (
                                <span className="text-sm text-gray-500 px-3 py-1">
                                  测验已完成
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">暂无可用测验</p>
                      <button
                        onClick={backToManage}
                        className="btn-secondary"
                      >
                        前往管理页面创建测验
                      </button>
                    </div>
                  )}
                </div>

                {/* Active Quiz Details */}
                {currentQuiz && (
                  <div className="mt-6 space-y-4">
                    {/* Current Question Display */}
                    {currentQuiz.questions[currentQuestionIndex] && (
                      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="mb-4">
                          <h4 className="font-semibold text-lg mb-2">
                            当前题目 ({currentQuestionIndex + 1}/{currentQuiz.questions.length})
                          </h4>
                          <p className="text-gray-800 mb-4">
                            {currentQuiz.questions[currentQuestionIndex].question}
                          </p>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="p-2 bg-gray-50 rounded">
                              <span className="font-medium">A.</span> {currentQuiz.questions[currentQuestionIndex].optionA}
                            </div>
                            <div className="p-2 bg-gray-50 rounded">
                              <span className="font-medium">B.</span> {currentQuiz.questions[currentQuestionIndex].optionB}
                            </div>
                            <div className="p-2 bg-gray-50 rounded">
                              <span className="font-medium">C.</span> {currentQuiz.questions[currentQuestionIndex].optionC}
                            </div>
                            <div className="p-2 bg-gray-50 rounded">
                              <span className="font-medium">D.</span> {currentQuiz.questions[currentQuestionIndex].optionD}
                            </div>
                          </div>

                          <div className="mt-2 text-sm text-green-600">
                            <span className="font-medium">正确答案：{currentQuiz.questions[currentQuestionIndex].correctAnswer}</span>
                          </div>
                        </div>

                        {/* Question Navigation */}
                        <div className="flex justify-between items-center pt-4 border-t">
                          <button
                            onClick={previousQuestion}
                            disabled={currentQuestionIndex === 0}
                            className="btn-secondary text-sm px-3 py-1"
                          >
                            ← 上一题
                          </button>

                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            第 {currentQuestionIndex + 1} 题，共 {currentQuiz.questions.length} 题
                          </span>

                          <button
                            onClick={nextQuestion}
                            disabled={currentQuestionIndex >= currentQuiz.questions.length - 1}
                            className="btn-primary text-sm px-3 py-1"
                          >
                            下一题 →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quiz Stats */}
            {quizStats && (
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                    实时统计
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {quizStats.participantCount}
                      </div>
                      <div className="text-sm text-gray-600">参与者</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {quizStats.averageScore}%
                      </div>
                      <div className="text-sm text-gray-600">平均分数</div>
                    </div>
                  </div>

                  {/* Question-by-Question Statistics */}
                  {quizStats && quizStats.questionStats && quizStats.questionStats.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">逐题结果</h4>
                      <div className="space-y-3">
                        {quizStats.questionStats.map((stat, index) => (
                          <div key={stat.questionId} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-sm">第 {index + 1} 题</span>
                              <div className="text-right">
                                <div className="text-sm font-medium">{stat.totalAnswers} 位学生作答</div>
                                <div className={`text-sm ${stat.accuracy >= 70 ? 'text-green-600' : stat.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {stat.accuracy.toFixed(1)}% 准确率
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 truncate">{stat.question}</p>
                            <div className="mt-2 flex justify-between text-xs">
                              <span className="text-green-600">{stat.correctAnswers} 正确</span>
                              <span className="text-red-600">{stat.totalAnswers - stat.correctAnswers} 错误</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Live Feedback */}
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  实时反馈
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  实时听众反馈
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {feedbacks.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">暂无反馈</p>
                  ) : (
                    feedbacks.map((feedback, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium">{getFeedbackTypeText(feedback.type)}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(feedback.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {feedback.message && (
                          <p className="text-sm text-gray-700">{feedback.message}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Discussion Management for Completed Quizzes */}
            {presentation?.quizzes?.filter(quiz => quiz.status === QuizStatus.COMPLETED).length > 0 && (
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    测验讨论
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    管理已完成测验的讨论
                  </p>
                  <div className="space-y-6">
                    {presentation?.quizzes
                      ?.filter(quiz => quiz.status === QuizStatus.COMPLETED)
                      .map(quiz => (
                        <div key={quiz.id} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                            📝 {quiz.title}
                          </h4>
                          <DiscussionPanel
                            quizId={quiz.id}
                            quizTitle={quiz.title}
                            isQuizCompleted={true}
                            quizQuestions={undefined}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Empty for now */}
          <div className="space-y-6">
          </div>
        </div>
      </main>
    </div>
  );
}
