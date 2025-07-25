'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
// Modern UI components will be replaced with custom styled elements
import { PresentationWithRelations } from '@/types';

export default function PresentationAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const presentationId = params.id as string;

  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllFeedback, setShowAllFeedback] = useState(false);

  // 反馈类型翻译
  const getFeedbackTypeText = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'TOO_FAST': '太快',
      'TOO_SLOW': '太慢',
      'BORING': '无聊',
      'POOR_QUESTIONS': '题目质量差',
      'GENERAL': '一般反馈'
    };
    return typeMap[type] || type;
  };

  useEffect(() => {
    console.log('🔄 useEffect触发');
    console.log('👤 用户状态:', user ? `${user.username} (${user.role})` : '未登录');
    console.log('⏳ 认证加载中:', authLoading);
    console.log('📋 演示ID:', presentationId);

    if (user && !authLoading) {
      console.log('✅ 条件满足，开始加载数据');
      loadPresentationAnalytics();
    } else {
      console.log('❌ 条件不满足，跳过加载');
      if (!user) console.log('   - 用户未登录');
      if (authLoading) console.log('   - 认证仍在加载中');
    }
  }, [presentationId, user, authLoading]);

  const loadPresentationAnalytics = async () => {
    console.log('🚀 开始加载演示分析数据...');
    console.log('📋 演示ID:', presentationId);

    try {
      // Load analytics data (includes presentation details)
      console.log('📡 调用API: getPresentationAnalytics');
      const analyticsResponse = await apiService.getPresentationAnalytics(presentationId);

      // 调试：打印接收到的数据
      console.log('🔍 API响应数据:', analyticsResponse);
      console.log('📊 听众统计数据:', analyticsResponse.audienceStats);
      if (analyticsResponse.audienceStats && analyticsResponse.audienceStats.length > 0) {
        console.log('👤 第一个听众数据:', analyticsResponse.audienceStats[0]);
      }

      console.log('💾 设置状态数据...');
      setPresentation(analyticsResponse.presentation);
      setAnalytics(analyticsResponse);
      console.log('✅ 数据加载完成');
    } catch (error) {
      console.error('❌ 加载分析数据失败:', error);
      console.error('🔍 错误详情:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('📡 HTTP状态:', axiosError.response?.status);
        console.error('📄 响应数据:', axiosError.response?.data);
      }
      alert('加载演示分析失败。请检查控制台获取详细信息。');
    } finally {
      setLoading(false);
      console.log('🏁 加载过程结束');
    }
  };

  const goBack = () => {
    if (user?.role === 'ORGANIZER') {
      router.push('/organizer/dashboard');
    } else if (user?.role === 'SPEAKER') {
      router.push('/speaker/dashboard');
    } else {
      router.push('/audience/dashboard');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="modern-card p-8 max-w-md mx-auto">
            <div
              className="animate-spin rounded-full h-16 w-16 mx-auto mb-6"
              style={{
                border: '3px solid var(--border-light)',
                borderTop: '3px solid var(--primary)'
              }}
            ></div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              正在加载分析
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              正在分析演示数据...
            </p>
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
              未找到演示
            </h2>
            <button onClick={goBack} className="btn-secondary">
              返回仪表板
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalQuizzes = analytics?.overallStats?.totalQuizzes || 0;
  const totalAudience = analytics?.overallStats?.totalAudience || 0;
  const participationRate = analytics?.overallStats?.averageParticipation || 0;
  const accuracyRate = analytics?.overallStats?.overallAccuracy || 0;

  return (
    <div className="page-container">
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                演示分析
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {presentation.title}
              </p>
            </div>
            <button onClick={goBack} className="btn-secondary animate-slide-in-right">
              返回仪表板
            </button>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="modern-card p-6 animate-fade-in-up">
              <div className="text-center">
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  总听众数
                </h3>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                  {totalAudience}
                </div>
              </div>
            </div>

            <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="text-center">
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  总测验数
                </h3>
                <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>
                  {totalQuizzes}
                </div>
              </div>
            </div>

            <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-center">
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  参与率
                </h3>
                <div className="text-2xl font-bold" style={{ color: 'var(--secondary)' }}>
                  {participationRate.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="text-center">
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  准确率
                </h3>
                <div className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
                  {accuracyRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quiz Details */}
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  测验表现
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  每个测验的详细统计
                </p>
                {analytics?.quizStats && analytics.quizStats.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.quizStats.map((quiz: any) => (
                      <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <h3 className="font-semibold mb-2">{quiz.title}</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">题目数:</span>
                            <span className="ml-2 font-medium">{quiz.totalQuestions}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">状态:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${quiz.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              quiz.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                              {quiz.status === 'COMPLETED' ? '已完成' : quiz.status === 'ACTIVE' ? '进行中' : quiz.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">答案数:</span>
                            <span className="ml-2 font-medium">{quiz.totalAnswers}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">准确率:</span>
                            <span className="ml-2 font-medium">{quiz.accuracy.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    暂无可用测验
                  </p>
                )}
              </div>
            </div>

            {/* 听众反馈 */}
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  听众反馈
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  来自参与者的实时反馈
                </p>
                {analytics?.feedbackStats?.recent && analytics.feedbackStats.recent.length > 0 ? (
                  <div className="space-y-3">
                    {(showAllFeedback ? analytics.feedbackStats.recent : analytics.feedbackStats.recent.slice(0, 5)).map((feedback: any, index: number) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`px-2 py-1 text-xs rounded ${feedback.type === 'TOO_FAST' ? 'bg-red-100 text-red-800' :
                            feedback.type === 'TOO_SLOW' ? 'bg-yellow-100 text-yellow-800' :
                              feedback.type === 'BORING' ? 'bg-orange-100 text-orange-800' :
                                feedback.type === 'POOR_QUESTIONS' ? 'bg-purple-100 text-purple-800' :
                                  'bg-blue-100 text-blue-800'
                            }`}>
                            {getFeedbackTypeText(feedback.type)}
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
                    {analytics.feedbackStats.total > 5 && (
                      <div className="text-center mt-4">
                        <button
                          onClick={() => setShowAllFeedback(!showAllFeedback)}
                          className="btn-secondary text-sm px-4 py-2"
                        >
                          {showAllFeedback ? '收起反馈' : `还有 ${analytics.feedbackStats.total - 5} 条反馈`}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    暂无反馈
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Audience List */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                听众成员
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                此演示的参与者列表
              </p>
              {analytics?.audienceStats && analytics.audienceStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analytics.audienceStats.map((member: any, index: number) => (
                    <div key={index} className="modern-card p-4 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                          {member.user?.username || '匿名'}
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                          听众
                        </div>
                      </div>

                      <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        {member.user?.email || '无邮箱'}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="text-center p-2 rounded-lg bg-green-50">
                          <div className="text-xl font-bold text-green-600">
                            {member.answeredQuestions || 0}
                          </div>
                          <div className="text-xs text-green-600">已答题目</div>
                          <div className="text-xs text-gray-400">
                            调试: {JSON.stringify(member.answeredQuestions)}
                          </div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-50">
                          <div className="text-xl font-bold text-blue-600">
                            {member.correctAnswers || 0}
                          </div>
                          <div className="text-xs text-blue-600">正确答案</div>
                          <div className="text-xs text-gray-400">
                            调试: {JSON.stringify(member.correctAnswers)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="text-center p-2 rounded-lg bg-purple-50">
                          <div className="text-lg font-bold text-purple-600">
                            {(member.participationRate || 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-purple-600">参与率</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-orange-50">
                          <div className="text-lg font-bold text-orange-600">
                            {(member.accuracy || 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-orange-600">正确率</div>
                        </div>
                      </div>

                      <div className="text-xs pt-2 border-t border-gray-100" style={{ color: 'var(--text-secondary)' }}>
                        加入时间: {new Date(member.joinedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  暂无听众成员
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
