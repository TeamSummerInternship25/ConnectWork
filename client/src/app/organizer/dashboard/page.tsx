'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
// Modern UI components will be replaced with custom styled elements
import { useRouter } from 'next/navigation';
import { PresentationWithRelations, Analytics, CreatePresentationData, PresentationAnalytics } from '@/types';

export default function OrganizerDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [presentations, setPresentations] = useState<PresentationWithRelations[]>([]);
  const [analytics, setAnalytics] = useState<PresentationAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPresentation, setNewPresentation] = useState<CreatePresentationData>({
    title: '',
    description: '',
    startTime: '',
    speakerEmail: ''
  });

  useEffect(() => {
    if (user && user.role === 'ORGANIZER') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load presentations
      const presentationsResponse = await apiService.getPresentations();
      setPresentations(presentationsResponse.presentations);

      // Load analytics
      const analyticsResponse = await apiService.getOrganizerAnalytics();
      setAnalytics(analyticsResponse.analytics);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createPresentation(newPresentation);
      setShowCreateForm(false);
      setNewPresentation({
        title: '',
        description: '',
        startTime: '',
        speakerEmail: ''
      });
      loadDashboardData();
    } catch (error: any) {
      alert(error.message || '创建演示失败');
    }
  };

  const deletePresentation = async (presentationId: string) => {
    if (!confirm('您确定要删除这个演示吗？')) {
      return;
    }

    try {
      await apiService.deletePresentation(presentationId);
      loadDashboardData();
    } catch (error: any) {
      alert(error.message || '删除演示失败');
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
          <p className="mt-4 text-lg text-gray-600">正在加载仪表板...</p>
        </div>
      </div>
    );
  }

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
  if (!user || user.role !== 'ORGANIZER') {
    router.push('/auth/login');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Redirecting to login...</p>
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
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
            </svg>
          </div>
          <p className="mt-4 text-lg text-gray-600">正在加载仪表板...</p>
        </div>
      </div>
    );
  }

  const activePresentations = presentations.filter(p => p.isActive);
  const upcomingPresentations = presentations.filter(p => !p.isActive && new Date(p.startTime) > new Date());
  const pastPresentations = presentations.filter(p => !p.isActive && new Date(p.startTime) <= new Date());

  return (
    <div className="page-container">
      {/* Modern Header */}
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                组织者仪表板
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                欢迎回来，{user?.username}！
              </p>
            </div>
            <div className="flex gap-3 animate-slide-in-right">
              <button
                className="btn-primary"
                onClick={() => setShowCreateForm(true)}
              >
                创建演示
              </button>
              <button
                className="btn-secondary"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => {
                    window.location.href = '/organizer/admin';
                  }, 100);
                }}
              >
                管理面板
              </button>
              <button
                className="btn-secondary"
                onClick={logout}
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* Create Presentation Form */}
          {showCreateForm && (
            <div className="modern-card animate-fade-in-up" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                      创建新演示
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      设置新演示并邀请演讲者
                    </p>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    取消
                  </button>
                </div>
                <form onSubmit={createPresentation} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                      标题 *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPresentation.title}
                      onChange={(e) => setNewPresentation({ ...newPresentation, title: e.target.value })}
                      className="modern-input"
                      placeholder="请输入演示标题"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                      描述
                    </label>
                    <textarea
                      value={newPresentation.description}
                      onChange={(e) => setNewPresentation({ ...newPresentation, description: e.target.value })}
                      className="modern-input"
                      rows={3}
                      placeholder="请输入演示描述"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                      开始时间 *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newPresentation.startTime}
                      onChange={(e) => setNewPresentation({ ...newPresentation, startTime: e.target.value })}
                      className="modern-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                      演讲者邮箱 *
                    </label>
                    <input
                      type="email"
                      required
                      value={newPresentation.speakerEmail}
                      onChange={(e) => setNewPresentation({ ...newPresentation, speakerEmail: e.target.value })}
                      className="modern-input"
                      placeholder="请输入演讲者的邮箱地址"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="submit" className="btn-primary">
                      创建演示
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Active Presentations */}
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
                              演讲者: {presentation.speaker.username}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              听众: {presentation._count?.audience || 0} | 测验: {presentation._count?.quizzes || 0}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="modern-badge">
                              📋 代码: {presentation.code || '无'}
                            </span>
                            <span className="badge-success">
                              ● 直播开始: {new Date(presentation.startTime).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            className="btn-primary"
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTimeout(() => {
                                window.location.href = `/organizer/presentation/${presentation.id}`;
                              }, 100);
                            }}
                          >
                            监控
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
                您已安排的演示
              </p>
              {upcomingPresentations.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: 'var(--text-secondary)' }}>暂无即将到来的演示</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingPresentations.map((presentation, index) => (
                    <div
                      key={presentation.id}
                      className="modern-card p-4 animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                            {presentation.title}
                          </h3>
                          <div className="space-y-1 mb-3">
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              演讲者: {presentation.speaker.username}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {presentation.description || '无描述'}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="modern-badge">
                              📅 已安排: {new Date(presentation.startTime).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            className="btn-secondary"
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTimeout(() => {
                                window.location.href = `/organizer/presentation/${presentation.id}`;
                              }, 100);
                            }}
                          >
                            管理
                          </button>
                          <button
                            className="btn-secondary"
                            style={{
                              background: 'var(--error)',
                              color: 'white',
                              borderColor: 'var(--error)'
                            }}
                            onClick={() => deletePresentation(presentation.id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Analytics Overview */}
          {analytics.length > 0 && (
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="p-6">
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  分析概览
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  您演示的性能指标
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{analytics.length}</div>
                    <div className="text-sm text-gray-600">总演示数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.reduce((sum, a) => sum + a.totalAudience, 0)}
                    </div>
                    <div className="text-sm text-gray-600">总听众数</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {analytics.reduce((sum, a) => sum + a.totalQuizzes, 0)}
                    </div>
                    <div className="text-sm text-gray-600">总测验数</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {(analytics.reduce((sum, a) => sum + a.participationRate, 0) / analytics.length).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">平均参与率</div>
                  </div>
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
                您的演示历史和表现
              </p>
              {pastPresentations.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: 'var(--text-secondary)' }}>暂无过往演示</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pastPresentations.slice(0, 5).map((presentation, index) => (
                    <div
                      key={presentation.id}
                      className="modern-card p-4 animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                            {presentation.title}
                          </h3>
                          <div className="space-y-1 mb-3">
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              演讲者: {presentation.speaker.username}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {new Date(presentation.startTime).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="modern-badge">
                              👥 听众: {presentation._count?.audience || 0}
                            </span>
                            <span className="modern-badge">
                              📝 测验: {presentation._count?.quizzes || 0}
                            </span>
                          </div>
                        </div>

                        <div className="ml-4">
                          <button
                            className="btn-secondary"
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTimeout(() => {
                                window.location.href = `/analytics/presentation/${presentation.id}`;
                              }, 100);
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
