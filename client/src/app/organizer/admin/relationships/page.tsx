'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { UserRole } from '@/types';

interface Speaker {
  id: string;
  username: string;
  email: string;
  speakerPresentations: Array<{
    id: string;
    title: string;
    isActive: boolean;
    _count: { audience: number };
  }>;
}

interface Audience {
  id: string;
  username: string;
  email: string;
  audienceParticipations: Array<{
    presentation: {
      id: string;
      title: string;
      speaker: { username: string };
    };
  }>;
}

interface Presentation {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  isActive: boolean;
  organizer: { id: string; username: string };
  speaker: { id: string; username: string };
  _count: { audience: number; quizzes: number };
}

interface RelationshipData {
  speakers: Speaker[];
  audiences: Audience[];
  presentations: Presentation[];
}

export default function RelationshipManagement() {
  const { user } = useAuth();
  const [data, setData] = useState<RelationshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'ORGANIZER') {
      loadRelationshipData();
      loadAvailableUsers();
    }
  }, [user]);

  const loadRelationshipData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRelationships();
      setData(response.relationships);
    } catch (error) {
      console.error('加载关系数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await apiService.getAllUsers();
      setAvailableUsers(response.users);
    } catch (error) {
      console.error('加载用户失败:', error);
    }
  };

  const handleAssignSpeaker = async (presentationId: string, speakerId: string) => {
    try {
      await apiService.assignSpeaker(presentationId, speakerId);
      await loadRelationshipData(); // Refresh data
      alert('演讲者分配成功');
    } catch (error: any) {
      alert(error.message || '分配演讲者失败');
    }
  };

  const handleAddAudience = async (presentationId: string, userId: string) => {
    try {
      await apiService.addAudienceMember(presentationId, userId);
      await loadRelationshipData(); // Refresh data
      alert('听众成员添加成功');
    } catch (error: any) {
      alert(error.message || '添加听众成员失败');
    }
  };

  if (!user || user.role !== 'ORGANIZER') {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="modern-card p-8 max-w-md mx-auto animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              访问被拒绝
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              只有组织者可以访问关系管理
            </p>
            <button
              onClick={() => window.location.href = '/organizer/dashboard'}
              className="btn-secondary"
            >
              返回仪表板
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="modern-card p-8 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center animate-spin"
              style={{
                background: 'rgba(0, 122, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                border: '3px solid var(--border-light)',
                borderTop: '3px solid var(--primary)'
              }}>
              <svg className="w-8 h-8" fill="var(--primary)" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              正在加载关系数据
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              正在分析用户关系...
            </p>
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
                关系管理
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                管理演讲者-课程-听众关系
              </p>
            </div>
            <div className="flex gap-4 animate-slide-in-right">
              <button
                onClick={() => window.location.href = '/organizer/admin/users'}
                className="btn-secondary"
              >
                管理用户
              </button>
              <button
                onClick={() => window.location.href = '/organizer/admin'}
                className="btn-secondary"
              >
                返回管理
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* Relationship Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Speakers */}
            <div className="modern-card animate-fade-in-up hover:scale-105 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)',
                      boxShadow: '0 4px 15px rgba(52, 199, 89, 0.25)'
                    }}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      演讲者 ({data?.speakers.length || 0})
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      可用的演讲者及其演示
                    </p>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data?.speakers.map((speaker) => (
                    <div key={speaker.id} className="p-3" style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all var(--transition-fast)'
                    }}>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{speaker.username}</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{speaker.email}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {speaker.speakerPresentations.length} 个演示
                      </div>
                      {speaker.speakerPresentations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {speaker.speakerPresentations.slice(0, 2).map((pres) => (
                            <div key={pres.id} className="text-xs p-1 rounded" style={{
                              background: 'rgba(52, 199, 89, 0.1)',
                              color: 'var(--success)'
                            }}>
                              {pres.title} ({pres._count.audience} 听众)
                            </div>
                          ))}
                          {speaker.speakerPresentations.length > 2 && (
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              +{speaker.speakerPresentations.length - 2} 个更多...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Presentations (Courses) */}
            <div className="modern-card animate-fade-in-up hover:scale-105 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)',
                      boxShadow: '0 4px 15px rgba(0, 122, 255, 0.25)'
                    }}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      演示 ({data?.presentations.length || 0})
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      所有演示及其关系
                    </p>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data?.presentations.map((presentation) => (
                    <div
                      key={presentation.id}
                      className="p-3 cursor-pointer"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--border-light)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                      }}
                      onClick={() => setSelectedPresentation(presentation)}
                    >
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{presentation.title}</div>
                      <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        <div>📅 {new Date(presentation.startTime).toLocaleDateString()}</div>
                        <div>👤 演讲者: {presentation.speaker.username}</div>
                        <div>👥 听众: {presentation._count.audience}</div>
                        <div>❓ 测验: {presentation._count.quizzes}</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded mt-2 inline-block" style={{
                        background: presentation.isActive ? 'rgba(52, 199, 89, 0.1)' : 'rgba(134, 134, 139, 0.1)',
                        color: presentation.isActive ? 'var(--success)' : 'var(--text-tertiary)'
                      }}>
                        {presentation.isActive ? '活跃' : '非活跃'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Audiences */}
            <div className="modern-card animate-fade-in-up hover:scale-105 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #5856D6 0%, #7B68EE 100%)',
                      boxShadow: '0 4px 15px rgba(88, 86, 214, 0.25)'
                    }}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2 1l-3 4v7h2v7h3v-7h2v7h2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      听众 ({data?.audiences.length || 0})
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      听众成员及其参与情况
                    </p>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data?.audiences.map((audience) => (
                    <div key={audience.id} className="p-3" style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all var(--transition-fast)'
                    }}>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{audience.username}</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{audience.email}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {audience.audienceParticipations.length} 次参与
                      </div>
                      {audience.audienceParticipations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {audience.audienceParticipations.slice(0, 2).map((part, idx) => (
                            <div key={idx} className="text-xs p-1 rounded" style={{
                              background: 'rgba(88, 86, 214, 0.1)',
                              color: 'var(--secondary)'
                            }}>
                              {part.presentation.title}
                              <br />
                              <span style={{ color: 'var(--text-tertiary)' }}>由 {part.presentation.speaker.username}</span>
                            </div>
                          ))}
                          {audience.audienceParticipations.length > 2 && (
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              +{audience.audienceParticipations.length - 2} 个更多...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Relationship Matrix */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                关系矩阵
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                演讲者-演示-听众关系的可视化表示
              </p>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-light)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>演示</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>演讲者</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>听众数量</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>状态</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.presentations.map((presentation) => (
                      <tr
                        key={presentation.id}
                        className="transition-colors duration-200"
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--border-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td className="p-4 font-medium" style={{ color: 'var(--text-primary)' }}>{presentation.title}</td>
                        <td className="p-4" style={{ color: 'var(--text-secondary)' }}>{presentation.speaker.username}</td>
                        <td className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>{presentation._count.audience}</td>
                        <td className="p-4">
                          <span className="px-3 py-1 text-xs rounded-full font-medium" style={{
                            background: presentation.isActive ? 'rgba(52, 199, 89, 0.1)' : 'rgba(134, 134, 139, 0.1)',
                            color: presentation.isActive ? 'var(--success)' : 'var(--text-tertiary)'
                          }}>
                            {presentation.isActive ? '活跃' : '非活跃'}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            className="btn-secondary text-xs px-3 py-2 min-w-[60px] hover:scale-105 transition-transform"
                            onClick={() => setSelectedPresentation(presentation)}
                          >
                            管理
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Presentation Detail Modal */}
      {selectedPresentation && (
        <PresentationDetailModal
          presentation={selectedPresentation}
          availableUsers={availableUsers}
          onClose={() => setSelectedPresentation(null)}
          onAssignSpeaker={handleAssignSpeaker}
          onAddAudience={handleAddAudience}
          onRefresh={loadRelationshipData}
        />
      )}
    </div>
  );
}

// Presentation Detail Modal Component
function PresentationDetailModal({
  presentation,
  availableUsers,
  onClose,
  onAssignSpeaker,
  onAddAudience,
  onRefresh
}: {
  presentation: Presentation;
  availableUsers: any[];
  onClose: () => void;
  onAssignSpeaker: (presentationId: string, speakerId: string) => void;
  onAddAudience: (presentationId: string, userId: string) => void;
  onRefresh: () => void;
}) {
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('');
  const [audienceMembers, setAudienceMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPresentationDetails();
  }, [presentation.id]);

  const loadPresentationDetails = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPresentation(presentation.id);
      setAudienceMembers(response.presentation.audience || []);
    } catch (error) {
      console.error('Failed to load presentation details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAudience = async (userId: string) => {
    if (!confirm('移除此听众成员？')) return;

    try {
      await apiService.removeAudienceMember(presentation.id, userId);
      await loadPresentationDetails();
      onRefresh();
      alert('听众成员移除成功');
    } catch (error: any) {
      alert(error.message || '移除听众成员失败');
    }
  };

  const speakers = availableUsers.filter(u => u.role === 'SPEAKER');
  const audiences = availableUsers.filter(u => u.role === 'AUDIENCE');

  return (
    <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="modern-card w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              管理演示: {presentation.title}
            </h3>
            <button
              onClick={onClose}
              className="btn-secondary w-8 h-8 rounded-full flex items-center justify-center text-lg"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Presentation Info */}
            <div>
              <h3 className="font-semibold mb-4">演示信息</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">标题</label>
                  <p>{presentation.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">描述</label>
                  <p>{presentation.description || '无描述'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">开始时间</label>
                  <p>{new Date(presentation.startTime).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">状态</label>
                  <p>
                    <span className={`px-2 py-1 text-xs rounded ${presentation.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                      }`}>
                      {presentation.isActive ? '活跃' : '非活跃'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">统计</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="font-bold text-purple-600">{presentation._count.audience}</div>
                      <div className="text-xs text-purple-600">听众</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-bold text-blue-600">{presentation._count.quizzes}</div>
                      <div className="text-xs text-blue-600">测验</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Speaker Management */}
            <div>
              <h3 className="font-semibold mb-4">演讲者分配</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">当前演讲者</label>
                  <div className="mt-1 p-3 bg-green-50 rounded">
                    <div className="font-medium">{presentation.speaker.username}</div>
                    <div className="text-sm text-gray-600">当前已分配</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">分配新演讲者</label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="flex-1 modern-select"
                    >
                      <option value="">选择演讲者...</option>
                      {speakers.map(speaker => (
                        <option key={speaker.id} value={speaker.id}>
                          {speaker.username} ({speaker.email})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedSpeaker) {
                          onAssignSpeaker(presentation.id, selectedSpeaker);
                          setSelectedSpeaker('');
                        }
                      }}
                      disabled={!selectedSpeaker}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      分配
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audience Management */}
          <div className="mt-6">
            <h3 className="font-semibold mb-4">听众管理</h3>

            {/* Add Audience */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-500">添加听众成员</label>
              <div className="mt-1 flex gap-2">
                <select
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                  className="flex-1 modern-select"
                >
                  <option value="">选择听众成员...</option>
                  {audiences.filter(aud =>
                    !audienceMembers.some(member => member.user.id === aud.id)
                  ).map(audience => (
                    <option key={audience.id} value={audience.id}>
                      {audience.username} ({audience.email})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedAudience) {
                      onAddAudience(presentation.id, selectedAudience);
                      setSelectedAudience('');
                      loadPresentationDetails();
                    }
                  }}
                  disabled={!selectedAudience}
                  className="btn-primary text-sm px-4 py-2"
                >
                  添加
                </button>
              </div>
            </div>

            {/* Current Audience */}
            <div>
              <label className="text-sm font-medium text-gray-500">
                当前听众 ({audienceMembers.length})
              </label>
              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-300 rounded">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">正在加载...</div>
                ) : audienceMembers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">暂无听众成员</div>
                ) : (
                  <div className="divide-y">
                    {audienceMembers.map((member) => (
                      <div key={member.user.id} className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium">{member.user.username}</div>
                          <div className="text-sm text-gray-600">{member.user.email}</div>
                          <div className="text-xs text-gray-500">昵称: {member.nickname}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveAudience(member.user.id)}
                          className="btn-danger text-sm px-3 py-1"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
