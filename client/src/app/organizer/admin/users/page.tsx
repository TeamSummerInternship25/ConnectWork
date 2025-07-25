'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { UserRole } from '@/types';

interface UserWithStats {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  presentationsAsOrganizer: number;
  presentationsAsSpeaker: number;
  presentationsAsAudience: number;
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithStats | null>(null);

  useEffect(() => {
    if (user?.role === 'ORGANIZER') {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllUsers();
      setUsers(response.users);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('您确定要删除此用户吗？此操作无法撤销。')) {
      return;
    }

    try {
      await apiService.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      alert('用户删除成功');
    } catch (error: any) {
      alert(error.message || '删除用户失败');
    }
  };

  const handleUpdateUser = async (userData: any) => {
    try {
      await apiService.updateUser(editingUser!.id, userData);
      await loadUsers(); // Refresh the list
      setEditingUser(null);
      alert('用户更新成功');
    } catch (error: any) {
      alert(error.message || '更新用户失败');
    }
  };

  const handleCreateUser = async (userData: any) => {
    try {
      await apiService.createUser(userData);
      await loadUsers(); // Refresh the list
      setShowCreateForm(false);
      alert('用户创建成功');
    } catch (error: any) {
      alert(error.message || '创建用户失败');
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
              只有组织者可以访问用户管理
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
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              正在加载用户
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              正在获取用户数据...
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
                用户管理
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                管理系统用户及其角色
              </p>
            </div>
            <div className="flex gap-4 animate-slide-in-right">
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                创建新用户
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
          {/* Users Table */}
          <div className="modern-card animate-fade-in-up">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)',
                    boxShadow: '0 4px 15px rgba(0, 122, 255, 0.25)'
                  }}>
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    所有用户 ({users.length})
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    管理用户账户、角色和权限
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl" style={{
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
              }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{
                      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                      borderBottom: '2px solid var(--border)'
                    }}>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>用户</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>角色</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>演示</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>创建时间</th>
                      <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userItem, index) => (
                      <tr key={userItem.id}
                        className="border-b hover:scale-[1.01] transition-all duration-200"
                        style={{
                          borderColor: 'var(--border-light)',
                          background: index % 2 === 0 ? 'rgba(248, 250, 252, 0.5)' : 'white'
                        }}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{
                                background: userItem.role === 'ORGANIZER' ? 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)' :
                                  userItem.role === 'SPEAKER' ? 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)' :
                                    'linear-gradient(135deg, #5856D6 0%, #7B68EE 100%)',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                              }}>
                              <span className="text-white font-semibold text-sm">
                                {userItem.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {userItem.username}
                              </div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {userItem.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-2 text-xs rounded-full font-semibold inline-flex items-center gap-1"
                            style={{
                              background: userItem.role === 'ORGANIZER' ? '#E3F2FD' :
                                userItem.role === 'SPEAKER' ? '#E8F5E8' : '#F0F0FF',
                              color: userItem.role === 'ORGANIZER' ? '#007AFF' :
                                userItem.role === 'SPEAKER' ? '#34C759' : '#5856D6'
                            }}>
                            <div className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: userItem.role === 'ORGANIZER' ? '#007AFF' :
                                  userItem.role === 'SPEAKER' ? '#34C759' : '#5856D6'
                              }}></div>
                            {userItem.role === 'ORGANIZER' ? '组织者' :
                              userItem.role === 'SPEAKER' ? '演讲者' : '听众'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                组织者: <span className="font-semibold text-blue-600">{userItem.presentationsAsOrganizer}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                演讲者: <span className="font-semibold text-green-600">{userItem.presentationsAsSpeaker}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                听众: <span className="font-semibold text-purple-600">{userItem.presentationsAsAudience}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(userItem.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 items-center">
                            <button
                              className="px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 hover:scale-105"
                              style={{
                                background: 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)',
                                color: 'white',
                                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)'
                              }}
                              onClick={() => setSelectedUser(userItem)}
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                              </svg>
                              查看
                            </button>
                            <button
                              className="px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 hover:scale-105"
                              style={{
                                background: 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)',
                                color: 'white',
                                boxShadow: '0 2px 8px rgba(52, 199, 89, 0.25)'
                              }}
                              onClick={() => setEditingUser(userItem)}
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                              编辑
                            </button>
                            {userItem.id !== user.id && (
                              <button
                                className="px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 hover:scale-105"
                                style={{
                                  background: 'linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%)',
                                  color: 'white',
                                  boxShadow: '0 2px 8px rgba(255, 59, 48, 0.25)'
                                }}
                                onClick={() => handleDeleteUser(userItem.id)}
                              >
                                <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                </svg>
                                删除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Role Distribution */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
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
                    角色分布
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    不同角色用户的统计分析
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                {Object.values(UserRole).map((role, index) => {
                  const count = users.filter(u => u.role === role).length;
                  const roleConfig = {
                    'ORGANIZER': {
                      name: '组织者',
                      gradient: 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)',
                      bgColor: '#E3F2FD',
                      textColor: '#007AFF',
                      icon: (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )
                    },
                    'SPEAKER': {
                      name: '演讲者',
                      gradient: 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)',
                      bgColor: '#E8F5E8',
                      textColor: '#34C759',
                      icon: (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      )
                    },
                    'AUDIENCE': {
                      name: '听众',
                      gradient: 'linear-gradient(135deg, #5856D6 0%, #7B68EE 100%)',
                      bgColor: '#F0F0FF',
                      textColor: '#5856D6',
                      icon: (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2 1l-3 4v7h2v7h3v-7h2v7h2z" />
                        </svg>
                      )
                    }
                  }[role] || {
                    name: role,
                    gradient: 'linear-gradient(135deg, #86868B 0%, #A0A0A0 100%)',
                    bgColor: '#F5F5F5',
                    textColor: '#86868B',
                    icon: (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )
                  };

                  return (
                    <div
                      key={role}
                      className="relative overflow-hidden rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300"
                      style={{
                        backgroundColor: roleConfig.bgColor,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                        animationDelay: `${0.2 + index * 0.1}s`
                      }}
                    >
                      <div className="relative z-10">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white"
                          style={{
                            background: roleConfig.gradient,
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                          }}>
                          {roleConfig.icon}
                        </div>
                        <div className="text-3xl font-bold mb-2" style={{ color: roleConfig.textColor }}>
                          {count}
                        </div>
                        <div className={`text-sm font-medium ${roleConfig.textColor}`}>
                          {roleConfig.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modern-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  用户详情
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="btn-secondary w-8 h-8 rounded-full flex items-center justify-center text-lg"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">用户名</label>
                    <p>{selectedUser.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">邮箱</label>
                    <p>{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">角色</label>
                    <p>{selectedUser.role}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">创建时间</label>
                    <p>{new Date(selectedUser.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">演示统计</label>
                  <div className="mt-2 grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <div className="text-xl font-bold text-blue-600">{selectedUser.presentationsAsOrganizer}</div>
                      <div className="text-sm text-blue-600">作为组织者</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <div className="text-xl font-bold text-green-600">{selectedUser.presentationsAsSpeaker}</div>
                      <div className="text-sm text-green-600">作为演讲者</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-xl font-bold text-gray-600">{selectedUser.presentationsAsAudience}</div>
                      <div className="text-sm text-gray-600">作为听众</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditForm
          user={editingUser}
          onSave={handleUpdateUser}
          onCancel={() => setEditingUser(null)}
        />
      )}

      {/* Create User Modal */}
      {showCreateForm && (
        <UserCreateForm
          onSave={handleCreateUser}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

// User Edit Form Component
function UserEditForm({ user, onSave, onCancel }: {
  user: UserWithStats;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    email: user.email,
    username: user.username,
    role: user.role
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="modern-card w-full max-w-md animate-scale-in">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            编辑用户
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>邮箱</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="modern-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>用户名</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="modern-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>角色</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="modern-select"
              >
                {Object.values(UserRole).map(role => (
                  <option key={role} value={role}>
                    {role === 'ORGANIZER' ? '组织者' :
                      role === 'SPEAKER' ? '演讲者' : '听众'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="submit" className="btn-primary flex-1">保存</button>
              <button type="button" onClick={onCancel} className="btn-secondary flex-1">取消</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// User Create Form Component
function UserCreateForm({ onSave, onCancel }: {
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    role: UserRole.AUDIENCE
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="modern-card w-full max-w-md animate-scale-in">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            创建新用户
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>邮箱</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="modern-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>用户名</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="modern-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>密码</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="modern-input"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>角色</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="modern-select"
              >
                {Object.values(UserRole).map(role => (
                  <option key={role} value={role}>
                    {role === 'ORGANIZER' ? '组织者' :
                      role === 'SPEAKER' ? '演讲者' : '听众'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="submit" className="btn-primary flex-1">创建</button>
              <button type="button" onClick={onCancel} className="btn-secondary flex-1">取消</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
