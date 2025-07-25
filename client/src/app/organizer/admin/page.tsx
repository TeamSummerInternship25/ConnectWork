'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';

interface AdminStats {
  totalUsers: number;
  totalPresentations: number;
  totalQuizzes: number;
  totalQuestions: number;
  usersByRole: Record<string, number>;
  recentPresentations: any[];
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'ORGANIZER') {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminStats();
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'ORGANIZER') {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="modern-card p-8 w-full max-w-md animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              访问被拒绝
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              只有组织者可以访问管理面板
            </p>
            <button
              onClick={() => window.location.href = '/organizer/dashboard'}
              className="btn-primary w-full"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-lg text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">正在加载管理仪表板...</p>
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
                管理仪表板
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                系统管理和用户管理
              </p>
            </div>
            <div className="flex gap-3 animate-slide-in-right">
              <button
                className="btn-secondary"
                onClick={() => window.location.href = '/organizer/admin/users'}
              >
                管理用户
              </button>
              <button
                className="btn-secondary"
                onClick={() => window.location.href = '/organizer/admin/relationships'}
              >
                管理关系
              </button>
              <button
                className="btn-secondary"
                onClick={() => window.location.href = '/organizer/dashboard'}
              >
                返回仪表板
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="modern-card p-6 animate-fade-in-up hover:scale-105 transition-all duration-300">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, #4A90E2 100%)',
                    boxShadow: '0 8px 25px rgba(0, 122, 255, 0.25)'
                  }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
                  {stats?.totalUsers || 0}
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>总用户数</div>
              </div>
            </div>

            <div className="modern-card p-6 animate-fade-in-up hover:scale-105 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--success) 0%, #5CB85C 100%)',
                    boxShadow: '0 8px 25px rgba(52, 199, 89, 0.25)'
                  }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--success)' }}>
                  {stats?.totalPresentations || 0}
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>总演示数</div>
              </div>
            </div>

            <div className="modern-card p-6 animate-fade-in-up hover:scale-105 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--secondary) 0%, #7B68EE 100%)',
                    boxShadow: '0 8px 25px rgba(88, 86, 214, 0.25)'
                  }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9H19V1h-2v1H7V1H5v1H4.5C3.67 2 3 2.67 3 3.5v15C3 19.33 3.67 20 4.5 20h15c.83 0 1.5-.67 1.5-1.5v-15C21 2.67 20.33 2 19.5 2z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--secondary)' }}>
                  {stats?.totalQuizzes || 0}
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>总测验数</div>
              </div>
            </div>

            <div className="modern-card p-6 animate-fade-in-up hover:scale-105 transition-all duration-300" style={{ animationDelay: '0.3s' }}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--warning) 0%, #F0AD4E 100%)',
                    boxShadow: '0 8px 25px rgba(255, 149, 0, 0.25)'
                  }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--warning)' }}>
                  {stats?.totalQuestions || 0}
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>总题目数</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Users by Role */}
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.25)'
                    }}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2 1l-3 4v7h2v7h3v-7h2v7h2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      按角色分类的用户
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      不同角色用户的分布情况
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {Object.entries(stats?.usersByRole || {}).map(([role, count]) => {
                    const getRoleInfo = (role: string) => {
                      switch (role) {
                        case 'ORGANIZER': return { label: '组织者', color: '#007AFF', bgColor: '#E3F2FD' };
                        case 'SPEAKER': return { label: '演讲者', color: '#34C759', bgColor: '#E8F5E8' };
                        case 'AUDIENCE': return { label: '听众', color: '#5856D6', bgColor: '#F0F0FF' };
                        default: return { label: role, color: '#86868B', bgColor: '#F5F5F5' };
                      }
                    };

                    const roleInfo = getRoleInfo(role);

                    return (
                      <div key={role} className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 hover:scale-105"
                        style={{ backgroundColor: roleInfo.bgColor }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: roleInfo.color }}>
                            <div className="w-3 h-3 rounded-full bg-white"></div>
                          </div>
                          <span className="font-semibold" style={{ color: roleInfo.color }}>{roleInfo.label}</span>
                        </div>
                        <span className="text-2xl font-bold" style={{ color: roleInfo.color }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Presentations */}
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)',
                      boxShadow: '0 4px 15px rgba(52, 199, 89, 0.25)'
                    }}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      最近的演示
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      系统中最新的演示
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {stats?.recentPresentations?.length ? (
                    stats.recentPresentations.map((presentation, index) => (
                      <div key={presentation.id}
                        className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:scale-105"
                        style={{
                          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                        }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold mb-2 text-gray-800">
                              {presentation.title}
                            </h4>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span>组织者: {presentation.organizer.username}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>演讲者: {presentation.speaker.username}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                  </svg>
                                  {presentation._count.audience}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9H19V1h-2v1H7V1H5v1H4.5C3.67 2 3 2.67 3 3.5v15C3 19.33 3.67 20 4.5 20h15c.83 0 1.5-.67 1.5-1.5v-15C21 2.67 20.33 2 19.5 2z" />
                                  </svg>
                                  {presentation._count.quizzes}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 ml-4">
                            #{index + 1}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500">暂无最近的演示</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions - Apple Style */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                快速操作
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                常用管理任务
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 管理用户 */}
              <div
                onClick={() => window.location.href = '/organizer/admin/users'}
                className="modern-card p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg group"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #4A90E2 100%)',
                  border: 'none'
                }}
              >
                <div className="text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                    <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold mb-2">管理用户</h4>
                  <p className="text-sm opacity-90">创建、编辑和管理系统用户</p>
                </div>
              </div>

              {/* 管理关系 */}
              <div
                onClick={() => window.location.href = '/organizer/admin/relationships'}
                className="modern-card p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg group"
                style={{
                  background: 'linear-gradient(135deg, var(--success) 0%, #5CB85C 100%)',
                  border: 'none'
                }}
              >
                <div className="text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                    <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold mb-2">管理关系</h4>
                  <p className="text-sm opacity-90">配置演讲者和听众关系</p>
                </div>
              </div>

              {/* 查看报告 */}
              <div
                onClick={() => window.location.href = '/organizer/dashboard'}
                className="modern-card p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg group"
                style={{
                  background: 'linear-gradient(135deg, var(--warning) 0%, #F0AD4E 100%)',
                  border: 'none'
                }}
              >
                <div className="text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                    <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold mb-2">查看报告</h4>
                  <p className="text-sm opacity-90">查看详细的系统统计报告</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
