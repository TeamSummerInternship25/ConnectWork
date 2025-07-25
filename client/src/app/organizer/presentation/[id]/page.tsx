'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
// Modern UI components will be replaced with custom styled elements
import FileUpload from '@/components/FileUpload';
import { PresentationWithRelations, QuizStats } from '@/types';

export default function OrganizerPresentationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const presentationId = params.id as string;

  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'audience' | 'quizzes' | 'feedback'>('overview');

  useEffect(() => {
    if (user && user.role === 'ORGANIZER') {
      loadPresentation();
      setupSocketListeners();
      // Socket房间加入逻辑已移至setupSocketListeners
    }

    return () => {
      // 清理Socket监听器
      socketService.off('quiz-stats-updated');
      socketService.off('feedback-received');
      socketService.emit('leave-presentation', presentationId);
    };
  }, [presentationId, user]);

  const loadPresentation = async () => {
    try {
      console.log('🚀 [组织者] 开始加载演示数据...');

      // 同时加载演示数据和分析数据
      const [presentationResponse, analyticsResponse] = await Promise.all([
        apiService.getPresentation(presentationId),
        apiService.getPresentationAnalytics(presentationId)
      ]);

      let presentationData = presentationResponse.presentation;

      console.log('🔍 [组织者] 演示数据:', presentationData);
      console.log('📊 [组织者] 分析数据:', analyticsResponse);
      console.log('👥 [组织者] 听众数量:', presentationData.audience?.length || 0);
      console.log('🧪 [组织者] 测验数量:', presentationData.quizzes?.length || 0);
      console.log('📈 [组织者] 分析-听众统计:', analyticsResponse.audienceStats?.length || 0);

      // 设置分析数据
      setAnalytics(analyticsResponse);

      // 如果未包含则单独加载反馈数据
      try {
        const feedbackResponse = await apiService.getFeedback(presentationId);
        if ((feedbackResponse as any).feedbacks) {
          presentationData = {
            ...presentationData,
            feedbacks: (feedbackResponse as any).feedbacks
          };
          console.log('📝 已加载反馈数据:', (feedbackResponse as any).feedbacks.length);
        }
      } catch (feedbackError) {
        console.warn('⚠️ 加载反馈数据失败:', feedbackError);
        // 确保即使加载失败也存在反馈数组
        if (!presentationData.feedbacks) {
          presentationData.feedbacks = [];
        }
      }

      setPresentation(presentationData);
    } catch (error) {
      console.error('加载演示失败:', error);
      router.push('/organizer/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) {
      console.warn('Socket not connected, skipping listener setup');
      return;
    }

    console.log('🚨🚨🚨 [组织者] 设置Socket监听器');

    // 立即加入演讲房间
    console.log('🔌 [组织者] 加入房间:', presentationId);
    socketService.emit('join-presentation', presentationId);

    socketService.on('quiz-stats-updated', (stats: QuizStats) => {
      setQuizStats(stats);
    });

    socketService.on('feedback-received', (newFeedback: any) => {
      // 直接添加新反馈到现有列表，避免重新加载整个演示
      console.log('📨 组织者页面收到新反馈:', newFeedback);
      setPresentation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          feedbacks: [newFeedback, ...prev.feedbacks]
        };
      });
    });
  };

  const endPresentation = async () => {
    if (!confirm('您确定要结束这个演示吗？')) {
      return;
    }

    try {
      await apiService.endPresentation(presentationId);
      loadPresentation();
    } catch (error: any) {
      alert(error.message || '结束演示失败');
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
  if (!user || user.role !== 'ORGANIZER') {
    setTimeout(() => {
      window.location.href = '/auth/login';
    }, 100);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">正在跳转到登录页面...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
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
              onClick={() => router.push('/organizer/dashboard')}
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
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{presentation.title}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>演讲者: {presentation.speaker.username}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className={`px-3 py-1 text-xs rounded-full font-medium ${presentation.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
                  }`}>
                  {presentation.isActive ? '● 直播中' : '已结束'}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {presentation.audience.length} 参与者
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              {presentation.isActive && (
                <button onClick={endPresentation} className="btn-primary" style={{ backgroundColor: 'var(--error)' }}>
                  结束演示
                </button>
              )}
              <button
                onClick={() => router.push('/organizer/dashboard')}
                className="btn-secondary"
              >
                返回仪表板
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Navigation Tabs */}
      <div className="content-wrapper py-6">
        <div className="modern-card p-1 animate-fade-in-up">
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'overview', label: '概览' },
              { id: 'audience', label: '听众' },
              { id: 'quizzes', label: '测验' },
              { id: 'feedback', label: '反馈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
                  }`}
                style={{
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === tab.id ? 'var(--surface)' : 'transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="content-wrapper pb-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* File Upload Section */}
            <FileUpload
              presentationId={presentationId}
              onUploadSuccess={(result) => {
                console.log('Upload successful:', result);
                // Refresh presentation data to show new content
                loadPresentation();
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="modern-card p-6 animate-fade-in-up">
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
                    {analytics?.overallStats?.totalAudience || presentation.audience.length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>总听众数</div>
                </div>
              </div>
              <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2" style={{ color: 'var(--success)' }}>
                    {analytics?.overallStats?.totalQuizzes || presentation.quizzes.length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>总测验数</div>
                </div>
              </div>
              <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2" style={{ color: 'var(--secondary)' }}>
                    {analytics?.overallStats?.totalQuestions || presentation.quizzes.reduce((sum, q) => sum + q.questions.length, 0)}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>总题目数</div>
                </div>
              </div>
              <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2" style={{ color: 'var(--warning)' }}>
                    {analytics?.overallStats?.overallAccuracy ? `${analytics.overallStats.overallAccuracy.toFixed(1)}%` : 'N/A'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>整体正确率</div>
                </div>
              </div>
            </div>

            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  演示详情
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>基本信息</h4>
                    <div className="space-y-2 text-sm">
                      <div><span style={{ color: 'var(--text-secondary)' }}>标题:</span> <span style={{ color: 'var(--text-primary)' }}>{presentation.title}</span></div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>描述:</span> <span style={{ color: 'var(--text-primary)' }}>{presentation.description || '无描述'}</span></div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>演讲者:</span> <span style={{ color: 'var(--text-primary)' }}>{presentation.speaker.username} ({presentation.speaker.email})</span></div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>开始时间:</span> <span style={{ color: 'var(--text-primary)' }}>{new Date(presentation.startTime).toLocaleString()}</span></div>
                      {presentation.endTime && (
                        <div><span style={{ color: 'var(--text-secondary)' }}>结束时间:</span> <span style={{ color: 'var(--text-primary)' }}>{new Date(presentation.endTime).toLocaleString()}</span></div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>状态</h4>
                    <div className="space-y-2 text-sm">
                      <div><span style={{ color: 'var(--text-secondary)' }}>状态:</span> <span style={{ color: 'var(--text-primary)' }}>{presentation.isActive ? '活跃' : '已结束'}</span></div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>演示ID:</span> <span style={{ color: 'var(--text-primary)' }}>{presentation.id}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audience Tab */}
        {activeTab === 'audience' && (
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                听众表现与排名
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                个人参与者统计和排名
              </p>
              {!analytics?.audienceStats || analytics.audienceStats.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无听众统计数据</p>
              ) : (
                <div className="space-y-4">
                  {analytics.audienceStats.map((audienceStat: any, index: number) => {
                    // 使用分析数据中的统计信息
                    const totalAnswered = audienceStat.answeredQuestions || 0;
                    const correctAnswers = audienceStat.correctAnswers || 0;
                    const accuracy = audienceStat.accuracy || 0;
                    const participationRate = audienceStat.participationRate || 0;

                    // 计算排名（基于正确率）
                    const sortedStats = [...analytics.audienceStats].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
                    const userRank = sortedStats.findIndex(stat => stat.user.id === audienceStat.user.id) + 1;
                    const totalUsers = analytics.audienceStats.length;

                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium">{audienceStat.user?.username || '未知用户'}</div>
                            <div className="text-sm text-gray-600">{audienceStat.user?.email || '无邮箱'}</div>
                          </div>
                          <div className="text-sm text-gray-500">
                            加入时间: {new Date(audienceStat.joinedAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Individual Performance Statistics */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="font-medium text-sm mb-2">📊 表现统计</h4>
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="text-center p-2 rounded-lg bg-blue-50">
                              <div className="text-xl font-bold text-blue-600">{totalAnswered}</div>
                              <div className="text-xs text-blue-600">已回答题目</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-green-50">
                              <div className="text-xl font-bold text-green-600">{correctAnswers}</div>
                              <div className="text-xs text-green-600">正确答案</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="text-center p-2 rounded-lg bg-purple-50">
                              <div className="text-lg font-bold text-purple-600">{participationRate.toFixed(1)}%</div>
                              <div className="text-xs text-purple-600">参与率</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-orange-50">
                              <div className="text-lg font-bold text-orange-600">{accuracy.toFixed(1)}%</div>
                              <div className="text-xs text-orange-600">正确率</div>
                            </div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-gray-50">
                            <div className="text-lg font-bold text-gray-600">
                              {userRank > 0 ? `#${userRank}` : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">
                              排名 {totalUsers > 0 ? `(共${totalUsers}人)` : ''}
                            </div>
                          </div>

                          {userRank > 0 && totalUsers > 0 && (
                            <div className="mt-2 text-center">
                              <span className="text-xs text-gray-500">
                                🏆 排名前 {Math.round(((totalUsers - userRank + 1) / totalUsers) * 100)}% 的参与者
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quizzes Tab */}
        {activeTab === 'quizzes' && (
          <div className="space-y-6">
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  测验管理
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  监控测验活动
                </p>
                {presentation.quizzes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂未创建测验</p>
                ) : (
                  <div className="space-y-4">
                    {presentation.quizzes.map((quiz) => (
                      <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium">{quiz.title}</h3>
                            <p className="text-sm text-gray-600">
                              {quiz.questions.length} 道题
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${quiz.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                            quiz.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {quiz.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Quiz Statistics */}
            {quizStats && (
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    实时测验统计
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    实时测验表现
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{quizStats.totalParticipants}</div>
                      <div className="text-sm text-gray-600">参与者</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{quizStats.totalAnswers}</div>
                      <div className="text-sm text-gray-600">总答案数</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {quizStats.questionStats.map((stat, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <h4 className="font-medium mb-3">题目 {index + 1}: {stat.question}</h4>
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
                            正确: {stat.correctCount}/{stat.totalAnswers}
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
          </div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                听众反馈
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                来自参与者的实时反馈
              </p>
              {presentation.feedbacks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂未收到反馈</p>
              ) : (
                <div className="space-y-4">
                  {presentation.feedbacks.map((feedback, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${feedback.type === 'TOO_FAST' ? 'bg-red-100 text-red-800' :
                            feedback.type === 'TOO_SLOW' ? 'bg-yellow-100 text-yellow-800' :
                              feedback.type === 'BORING' ? 'bg-gray-100 text-gray-800' :
                                feedback.type === 'POOR_QUESTIONS' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                            }`}>
                            {feedback.type === 'TOO_FAST' ? '太快了' :
                              feedback.type === 'TOO_SLOW' ? '太慢了' :
                                feedback.type === 'BORING' ? '无聊' :
                                  feedback.type === 'POOR_QUESTIONS' ? '题目质量差' :
                                    feedback.type === 'GENERAL' ? '一般反馈' : feedback.type}
                          </span>
                          <span className="text-sm font-medium">{feedback.user?.username || '匿名'}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(feedback.createdAt).toLocaleString()}
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
        )}
      </main>
    </div>
  );
}
