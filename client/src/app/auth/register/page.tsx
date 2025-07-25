'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { RegisterFormData, UserRole } from '@/types';
// Modern UI components will be replaced with custom styled elements
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: UserRole.AUDIENCE
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.email || !formData.username || !formData.password || !formData.confirmPassword) {
      setError('所有字段都是必填的');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('密码不匹配');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('密码至少需要6个字符');
      setLoading(false);
      return;
    }

    try {
      await register(formData);
      router.push('/');
    } catch (error: unknown) {
      setError((error instanceof Error ? error.message : "未知错误") || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="modern-card p-8 animate-fade-in-up">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              创建您的 PopQuiz 账户
            </h2>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              加入AI驱动的实时测验系统
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              已有账户？{' '}
              <Link
                href="/auth/login"
                className="font-medium transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                点击登录
              </Link>
            </p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="badge-error p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  邮箱地址
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="modern-input"
                  placeholder="请输入您的邮箱"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  用户名
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="modern-input"
                  placeholder="请选择用户名"
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  角色
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  className="modern-input"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value={UserRole.AUDIENCE}>听众 - 参加演示并回答测验</option>
                  <option value={UserRole.SPEAKER}>演讲者 - 展示内容并创建测验</option>
                  <option value={UserRole.ORGANIZER}>组织者 - 管理演示和用户</option>
                </select>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  密码
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="modern-input"
                  placeholder="请创建密码"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  确认密码
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="modern-input"
                  placeholder="请确认您的密码"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '创建账户中...' : '创建账户'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
            <div className="text-center">
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                角色说明
              </h3>
              <div className="space-y-2 text-sm text-left" style={{ color: 'var(--text-secondary)' }}>
                <div><strong>听众:</strong> 参加现场演示，回答AI生成的测验，并提供反馈</div>
                <div><strong>演讲者:</strong> 展示内容，在演示期间开始测验，并查看听众回应</div>
                <div><strong>组织者:</strong> 创建和管理演示，邀请演讲者，并分析参与数据</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
