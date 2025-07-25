'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
// Modern UI components will be replaced with custom styled elements
import { useRouter } from 'next/navigation';
import { PresentationWithRelations, AudienceAnalytics, AnalyticsSummary } from '@/types';

export default function AudienceDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [availablePresentations, setAvailablePresentations] = useState<PresentationWithRelations[]>([]);
  const [myPresentations, setMyPresentations] = useState<PresentationWithRelations[]>([]);
  const [analytics, setAnalytics] = useState<AudienceAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    if (user && user.role === 'AUDIENCE') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 加载我已加入的演示
      const myPresentationsResponse = await apiService.getPresentations();
      setMyPresentations(myPresentationsResponse.presentations);

      // 从我已加入的演示中筛选活跃演示
      const activePresentations = myPresentationsResponse.presentations.filter(
        (presentation: PresentationWithRelations) => presentation.isActive
      );
      setAvailablePresentations(activePresentations);

      // 加载分析数据
      const analyticsResponse = await apiService.getAudienceAnalytics();
      setAnalytics(analyticsResponse.analytics);
      setSummary(analyticsResponse.summary);
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinPresentation = async (presentationId: string) => {
    try {
      // 直接导航到测验界面（已加入）
      setTimeout(() => {
        window.location.href = `/audience/presentation/${presentationId}`;
      }, 100);
    } catch (error: any) {
      alert(error.message || '加入演示失败');
    }
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) {
      alert('请输入演示代码');
      return;
    }

    try {
      // 通过6位代码加入
      const response = await apiService.joinPresentationByCode(joinCode.trim().toUpperCase(), nickname.trim() || undefined);
      const presentationId = (response as any).presentationId;

      // 连接到socket房间
      socketService.emit('join-presentation', presentationId);

      // 导航到测验界面
      setTimeout(() => {
        window.location.href = `/audience/presentation/${presentationId}`;
      }, 100);

      // 关闭模态框并重置表单
      setShowJoinForm(false);
      setJoinCode('');
      setNickname('');

      // 刷新分析数据
      loadDashboardData();
    } catch (error: any) {
      alert(error.message || '加入演示失败');
    }
  };

  // 检查认证时显示加载
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

  // 如果未认证或角色错误则重定向
  if (!user || user.role !== 'AUDIENCE') {
    router.push('/auth/login');
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
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
            </svg>
          </div>
          <p className="mt-4 text-lg text-gray-600">正在加载仪表板...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* 现代化头部 */}
      <header className="modern-header">
        <div className="content-wrapper">
          <div className="flex justify-between items-center py-6">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                听众仪表板
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                欢迎回来，{user?.username}！
              </p>
            </div>
            <div className="flex gap-3 animate-slide-in-right">
              <button
                className="btn-primary"
                onClick={() => setShowJoinForm(true)}
              >
                加入演示
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
          {/* 快速加入部分 */}
          <div className="modern-card animate-fade-in-up" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--primary)' }}></div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                  快速加入
                </h2>
              </div>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                输入演示代码快速加入
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="请输入演示代码"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="modern-input flex-1"
                />
                <button
                  className="btn-primary"
                  onClick={joinByCode}
                >
                  加入
                </button>
              </div>
            </div>
          </div>

          {/* 可用的现场演示 */}
          <div className="modern-card animate-fade-in-up" style={{
            animationDelay: '0.1s',
            borderLeft: '4px solid var(--success)'
          }}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }}></div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--success)' }}>
                  可用的现场演示
                </h2>
              </div>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                您已加入的当前活跃演示
              </p>
              {availablePresentations.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: 'var(--text-secondary)' }}>暂无活跃的演示</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availablePresentations.map((presentation, index) => (
                    <div
                      key={presentation.id}
                      className="modern-card p-4 animate-fade-in-up"
                      style={{
                        animationDelay: `${index * 0.1}s`,
                        background: 'rgba(52, 199, 89, 0.05)',
                        borderColor: 'rgba(52, 199, 89, 0.2)',
                        borderLeft: '4px solid var(--success)'
                      }}
                    >
                      <div className="mb-4">
                        <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                          {presentation.title}
                        </h3>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                          演讲者: {presentation.speaker.username}
                        </p>
                        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                          {presentation.description || '暂无描述'}
                        </p>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="badge-success">● LIVE</span>
                        <button
                          className="btn-primary"
                          onClick={() => joinPresentation(presentation.id)}
                        >
                          立即加入
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 我的统计 */}
          {summary && (
            <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="p-6">
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  我的表现总结
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  您的整体测验参与统计
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{summary.totalPresentations}</div>
                    <div className="text-sm text-gray-600">已参加演示</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summary.totalAnswered}</div>
                    <div className="text-sm text-gray-600">已答题数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{summary.overallAccuracy.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">总体准确率</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{summary.overallParticipationRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">参与率</div>
                  </div>
                  {summary.ranking && summary.ranking.currentRank && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">#{summary.ranking.currentRank}</div>
                      <div className="text-sm text-gray-600">
                        排名 (第{summary.ranking.percentile}百分位)
                      </div>
                      <div className="text-xs text-gray-500">
                        共 {summary.ranking.totalUsers} 位用户
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 最近的演示 */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                我的最近演示
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                您的参与历史和表现
              </p>
              {analytics.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无演示历史</p>
              ) : (
                <div className="space-y-4">
                  {analytics.slice(0, 5).map((item) => (
                    <div key={item.presentationId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="text-sm text-gray-600">演讲者: {item.speaker}</p>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {new Date(item.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">已答:</span>
                          <span className="ml-1 font-medium">{item.answeredQuestions}/{item.totalQuestions}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">准确率:</span>
                          <span className="ml-1 font-medium text-green-600">{item.accuracy.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">参与度:</span>
                          <span className="ml-1 font-medium text-blue-600">{item.participationRate.toFixed(1)}%</span>
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

      {/* 加入演示模态框 */}
      {showJoinForm && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
          <div className="modern-card p-6 w-full max-w-md animate-fade-in-up">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              加入演示
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  演示代码 *
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="modern-input"
                  placeholder="输入6位代码 (例如: ABC123)"
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  向演讲者询问6位演示代码
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  昵称（可选）
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="modern-input"
                  placeholder="输入您的昵称"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1"
                onClick={joinByCode}
              >
                加入
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setShowJoinForm(false);
                  setJoinCode('');
                  setNickname('');
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
