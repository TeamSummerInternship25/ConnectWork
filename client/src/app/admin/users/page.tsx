'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
// Modern UI components will be replaced with custom styled elements
import { UserRole } from '@/types';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'ORGANIZER' | 'SPEAKER' | 'AUDIENCE';
  avatar?: string;
  createdAt: string;
  _count?: {
    organizedPresentations?: number;
    speakerPresentations?: number;
    audiencePresentations?: number;
  };
}

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: UserRole.AUDIENCE
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      // 模拟API调用 - 实际需要创建后端API
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        // 如果API不存在，使用模拟数据
        setUsers([
          {
            id: '1',
            email: 'organizer@example.com',
            username: 'organizer1',
            role: 'ORGANIZER',
            createdAt: new Date().toISOString(),
            _count: { organizedPresentations: 5 }
          },
          {
            id: '2',
            email: 'speaker@example.com',
            username: 'speaker1',
            role: 'SPEAKER',
            createdAt: new Date().toISOString(),
            _count: { speakerPresentations: 3 }
          },
          {
            id: '3',
            email: 'audience@example.com',
            username: 'audience1',
            role: 'AUDIENCE',
            createdAt: new Date().toISOString(),
            _count: { audiencePresentations: 8 }
          }
        ]);
      }
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    try {
      await apiService.register(newUser);
      alert('用户创建成功！');
      setNewUser({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        role: UserRole.AUDIENCE
      });
      setShowCreateUser(false);
      loadUsers();
    } catch (error: any) {
      alert(error.message || '创建用户失败');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowEditUser(true);
  };

  const updateUser = async () => {
    if (!editingUser) return;

    try {
      // 模拟API调用 - 实际需要创建后端API
      console.log('更新用户:', editingUser);

      setShowEditUser(false);
      setEditingUser(null);

      // 重新加载用户列表
      loadUsers();
    } catch (error) {
      console.error('更新用户错误:', error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ORGANIZER': return 'bg-purple-100 text-purple-800';
      case 'SPEAKER': return 'bg-blue-100 text-blue-800';
      case 'AUDIENCE': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'ORGANIZER': return '组织者';
      case 'SPEAKER': return '演讲者';
      case 'AUDIENCE': return '听众';
      default: return role;
    }
  };

  if (!user || user.role !== 'ORGANIZER') {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="modern-card p-8 w-full max-w-md animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              访问受限
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              只有组织者可以访问用户管理页面
            </p>
            <button
              onClick={() => window.history.back()}
              className="btn-primary w-full"
            >
              返回
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
                用户管理
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                管理组织者、演讲者和听众
              </p>
            </div>
            <div className="flex gap-3 animate-slide-in-right">
              <button
                className="btn-primary"
                onClick={() => setShowCreateUser(true)}
              >
                创建新用户
              </button>
              <button
                className="btn-secondary"
                onClick={() => window.history.back()}
              >
                返回
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-8">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="modern-card p-6 animate-fade-in-up">
              <div className="text-center">
                <div className="text-2xl font-bold mb-2" style={{ color: 'var(--secondary)' }}>
                  {users.filter(u => u.role === 'ORGANIZER').length}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>组织者</div>
              </div>
            </div>
            <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="text-center">
                <div className="text-2xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
                  {users.filter(u => u.role === 'SPEAKER').length}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>演讲者</div>
              </div>
            </div>
            <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-center">
                <div className="text-2xl font-bold mb-2" style={{ color: 'var(--success)' }}>
                  {users.filter(u => u.role === 'AUDIENCE').length}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>听众</div>
              </div>
            </div>
            <div className="modern-card p-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="text-center">
                <div className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {users.length}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>总用户数</div>
              </div>
            </div>
          </div>

          {/* 用户列表 */}
          <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                用户列表
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                所有注册用户及其角色信息
              </p>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">加载中...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium">{user.username}</h3>
                            <span className={`modern-badge ${getRoleBadgeColor(user.role)}`}>
                              {getRoleDisplayName(user.role)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <p className="text-xs text-gray-500">
                            注册时间: {new Date(user.createdAt).toLocaleString()}
                          </p>
                          {user._count && (
                            <div className="mt-2 text-sm text-gray-600">
                              {user.role === 'ORGANIZER' && `组织演讲: ${user._count.organizedPresentations || 0} 场`}
                              {user.role === 'SPEAKER' && `主讲演讲: ${user._count.speakerPresentations || 0} 场`}
                              {user.role === 'AUDIENCE' && `参与演讲: ${user._count.audiencePresentations || 0} 场`}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn-secondary text-sm px-3 py-1"
                            onClick={() => handleEditUser(user)}
                          >
                            编辑
                          </button>
                          <button className="btn-secondary text-sm px-3 py-1">
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

          {/* 创建用户对话框 */}
          {showCreateUser && (
            <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
              <div className="modern-card w-full max-w-md animate-fade-in-up">
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    创建新用户
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    添加新的组织者、演讲者或听众
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        邮箱
                      </label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="user@example.com"

                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="用户名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密码
                      </label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="密码"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        角色
                      </label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                        className="modern-select"
                      >
                        <option value="AUDIENCE">听众</option>
                        <option value="SPEAKER">演讲者</option>
                        <option value="ORGANIZER">组织者</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button onClick={createUser} className="btn-primary flex-1">
                        创建
                      </button>
                      <button
                        onClick={() => setShowCreateUser(false)}
                        className="btn-secondary flex-1"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 编辑用户对话框 */}
          {showEditUser && editingUser && (
            <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
              <div className="modern-card w-full max-w-md animate-fade-in-up">
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    编辑用户
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    修改用户信息
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        邮箱
                      </label>
                      <input
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="用户@示例.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={editingUser.username}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="用户名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        角色
                      </label>
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                        className="modern-select"
                      >
                        <option value="AUDIENCE">听众</option>
                        <option value="SPEAKER">演讲者</option>
                        <option value="ORGANIZER">组织者</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button onClick={updateUser} className="btn-primary flex-1">
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setShowEditUser(false);
                          setEditingUser(null);
                        }}
                        className="btn-secondary flex-1"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
