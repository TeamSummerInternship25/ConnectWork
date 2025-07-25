'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import { PresentationWithRelations, PresentationAnalytics } from '@/types';

export default function SpeakerDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [presentations, setPresentations] = useState<PresentationWithRelations[]>([]);
  const [analytics, setAnalytics] = useState<PresentationAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 如果未认证或不是演讲者则重定向
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SPEAKER')) {
      console.log('Redirecting to login - user:', user);
      router.push('/auth/login');
      return;
    }

    if (user && user.role === 'SPEAKER') {
      loadDashboardData();
    }
  }, [user, authLoading, router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading dashboard data for user:', user?.email);

      // 加载演示
      const presentationsResponse = await apiService.getPresentations();
      console.log('📊 Presentations loaded:', presentationsResponse.presentations.length);
      setPresentations(presentationsResponse.presentations);

      // 加载分析数据
      const analyticsResponse = await apiService.getSpeakerAnalytics();
      console.log('📈 Analytics loaded:', analyticsResponse.analytics.length);
      setAnalytics(analyticsResponse.analytics);
    } catch (error: any) {
      console.error('❌ Failed to load dashboard data:', error);
      setError(error.message || '加载数据失败');

      // 如果是认证错误，重定向到登录
      if (error.message?.includes('Access denied') || error.message?.includes('Invalid token')) {
        console.log('🔐 Authentication error, redirecting to login');
        logout();
        router.push('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };



  const endPresentation = async (presentationId: string) => {
    if (!confirm('您确定要结束此演示吗？这将停止所有活跃的测验。')) {
      return;
    }

    try {
      console.log('🔴 Ending presentation:', presentationId);

      // 调用API结束演示
      await apiService.endPresentation(presentationId);

      console.log('✅ Presentation ended successfully');

      // 刷新数据以更新UI
      loadDashboardData();
    } catch (error: any) {
      console.error('❌ Failed to end presentation:', error);
      alert(error.message || '结束演示失败');
    }
  };

  // 注意：演讲者不能删除演示 - 只有组织者可以管理演示生命周期

  // 注意：演讲者不能创建演示 - 只有组织者可以
  // 演示由组织者分配给演讲者

  // 检查认证时显示加载
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

  // 如果未认证则重定向
  if (!user || user.role !== 'SPEAKER') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">正在重定向到登录...</p>
        </div>
      </div>
    );
  }

  // 如果数据加载失败则显示错误
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">错误: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
          <button onClick={loadDashboardData} className="btn-primary">
            重试
          </button>
          <button onClick={logout} className="btn-secondary ml-2">
            退出登录
          </button>
        </div>
      </div>
    );
  }

  // 获取数据时显示加载
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">正在加载仪表板数据...</p>
        </div>
      </div>
    );
  }

  const upcomingPresentations = presentations.filter(p => !p.isActive && new Date(p.startTime) > new Date());
  const activePresentations = presentations.filter(p => p.isActive);
  const pastPresentations = presentations.filter(p => !p.isActive && new Date(p.startTime) <= new Date());

  return (
    <div className="page-container">
      {/* Modern Header */}
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                演讲者仪表板
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                欢迎回来，{user?.username}！
              </p>
            </div>
            <div className="flex gap-3 animate-slide-in-right">
              <button
                onClick={logout}
                className="btn-secondary"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* 活跃演示 */}
          {activePresentations.length > 0 && (
            <div className="modern-card animate-fade-in-up" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }}></div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--success)' }}>
                    活跃演示
                  </h2>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  当前正在进行的演示
                </p>

                <div className="space-y-4">
                  {activePresentations.map((presentation, index) => (
                    <div
                      key={presentation.id}
                      className="modern-card p-4 animate-fade-in-up"
                      style={{
                        animationDelay: `${index * 0.1}s`,
                        background: 'rgba(52, 199, 89, 0.05)',
                        borderColor: 'rgba(52, 199, 89, 0.2)'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                            {presentation.title}
                          </h3>
                          <div className="space-y-1 mb-3">
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              组织者: {presentation.organizer.username}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              听众: {presentation._count?.audience || 0} | 测验: {presentation._count?.quizzes || 0}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className="modern-badge">
                              📋 加入代码: {presentation.code || '无'}
                            </span>
                            <span className="badge-success">
                              ● 直播开始: {new Date(presentation.startTime).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            className="btn-primary"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🔴 Go Live button clicked for presentation:', presentation.id);
                              console.log('📊 Current user:', user);
                              console.log('🎤 Presentation speaker ID:', presentation.speakerId);
                              console.log('👤 User ID:', user?.id);

                              // 检查用户是否拥有此演示
                              if (user?.id !== presentation.speakerId) {
                                console.error('❌ User does not own this presentation');
                                alert('您没有权限启动此演示');
                                return;
                              }

                              console.log('✅ Permission check passed');

                              try {
                                // Start the presentation first
                                console.log('🚀 Starting presentation API call:', presentation.id);
                                console.log('🌐 API URL will be:', `/api/presentations/${presentation.id}/start`);

                                const response = await apiService.startPresentation(presentation.id);
                                console.log('✅ Presentation started successfully:', response);

                                // Small delay to ensure state is updated
                                console.log('⏳ Waiting 500ms for state update...');
                                await new Promise(resolve => setTimeout(resolve, 500));

                                // Navigate to live page
                                const targetUrl = `/speaker/presentation/${presentation.id}/live`;
                                console.log('🔄 Navigating to:', targetUrl);
                                console.log('🌍 Full URL:', window.location.origin + targetUrl);

                                // Try navigation with error handling
                                try {
                                  window.location.href = targetUrl;
                                } catch (navError) {
                                  console.error('❌ Navigation failed, trying alternative method:', navError);
                                  window.location.assign(targetUrl);
                                }

                              } catch (error: any) {
                                console.error('❌ Failed to start presentation:', error);
                                console.error('📋 Error details:', error.response?.data || error);
                                console.error('🔍 Error stack:', error.stack);

                                const errorMessage = error.response?.data?.error || error.message || 'Failed to start presentation';
                                alert(`启动演讲失败: ${errorMessage}`);
                              }
                            }}
                          >
                            开始直播
                          </button>
                          <button
                            className="btn-secondary"
                            style={{
                              background: 'var(--error)',
                              color: 'white',
                              borderColor: 'var(--error)'
                            }}
                            onClick={() => endPresentation(presentation.id)}
                          >
                            结束
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Presentations */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                即将到来的演示
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                您的预定演示
              </p>
              {upcomingPresentations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">暂无即将到来的演示</p>
                  <p className="text-sm text-gray-400">
                    演示由组织者创建和分配。
                    请联系您的组织者以获得分配给您的演示。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingPresentations.map((presentation) => (
                    <div key={presentation.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{presentation.title}</h3>
                          <p className="text-sm text-gray-600">演讲者: {presentation.speaker?.username || '未知'}</p>
                          <p className="text-sm text-gray-600">
                            {presentation.description || '暂无描述'}
                          </p>
                          <p className="text-sm font-medium text-blue-600">
                            📋 加入代码: {presentation.code || '无'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('Manage button clicked for presentation:', presentation.id);
                              const targetUrl = `/speaker/presentation/${presentation.id}/manage`;
                              console.log('Navigating to:', targetUrl);

                              // Force navigation with timeout
                              setTimeout(() => {
                                window.location.href = targetUrl;
                              }, 100);
                            }}
                            title={`管理演讲: ${presentation.title}`}
                          >
                            管理
                          </button>
                          {/* 注意：演讲者不能删除演示 - 只有组织者可以 */}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        计划时间: {new Date(presentation.startTime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Performance Analytics */}
          {analytics.length > 0 && (
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="p-6">
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  表现分析
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  您的演示统计和听众反馈
                </p>
                <div className="space-y-6">
                  {analytics.slice(0, 3).map((item) => (
                    <div key={item.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="text-sm text-gray-600">
                            {new Date(item.startTime).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            console.log('View Details button clicked for presentation:', item.id);
                            const targetUrl = `/analytics/presentation/${item.id}`;
                            console.log('Navigating to:', targetUrl);
                            window.location.href = targetUrl;
                          }}
                        >
                          查看详情
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">{item.totalAudience}</div>
                          <div className="text-xs text-gray-600">听众</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{item.totalQuizzes}</div>
                          <div className="text-xs text-gray-600">测验</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-purple-600">
                            {item.participationRate != null ? item.participationRate.toFixed(1) : '0.0'}%
                          </div>
                          <div className="text-xs text-gray-600">参与度</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-orange-600">
                            {item.accuracy != null ? item.accuracy.toFixed(1) : '0.0'}%
                          </div>
                          <div className="text-xs text-gray-600">准确率</div>
                        </div>
                      </div>

                      {/* Feedback Summary */}
                      <div className="border-t border-gray-200 pt-3">
                        <h4 className="text-sm font-medium mb-2">听众反馈</h4>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.feedbackSummary?.TOO_FAST > 0 && (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                              太快: {item.feedbackSummary.TOO_FAST}
                            </span>
                          )}
                          {item.feedbackSummary?.TOO_SLOW > 0 && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              太慢: {item.feedbackSummary.TOO_SLOW}
                            </span>
                          )}
                          {item.feedbackSummary?.BORING > 0 && (
                            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              无聊: {item.feedbackSummary.BORING}
                            </span>
                          )}
                          {item.feedbackSummary?.POOR_QUESTIONS > 0 && (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              题目质量差: {item.feedbackSummary.POOR_QUESTIONS}
                            </span>
                          )}
                          {item.feedbackSummary?.GENERAL > 0 && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              一般反馈: {item.feedbackSummary.GENERAL}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Presentations */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                最近的演示
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                您的演示历史
              </p>
              {pastPresentations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无过往演示</p>
              ) : (
                <div className="space-y-4">
                  {pastPresentations.slice(0, 5).map((presentation) => (
                    <div key={presentation.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{presentation.title}</h3>
                          <p className="text-sm text-gray-600">组织者: {presentation.organizer.username}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(presentation.startTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <div>听众: {presentation._count?.audience || 0}</div>
                          <div>测验: {presentation._count?.quizzes || 0}</div>
                          <button
                            className="btn-secondary mt-2"
                            onClick={() => {
                              window.location.href = `/analytics/presentation/${presentation.id}`;
                            }}
                          >
                            查看详情
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
