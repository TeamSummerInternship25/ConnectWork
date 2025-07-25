'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
// Modern UI components will be replaced with custom styled elements
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login({ email, password });
      router.push('/');
    } catch (error: any) {
      setError(error.message || '登录失败');
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
              登录 PopQuiz
            </h2>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              AI驱动的演示实时测验系统
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              还没有账户？{' '}
              <Link
                href="/auth/register"
                className="font-medium transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                点击注册
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
                  placeholder="请输入您的邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  密码
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="modern-input"
                  placeholder="请输入您的密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
            <div className="text-center">
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                演示账户
              </h3>
              <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p><strong>组织者:</strong> organizer@demo.com / password</p>
                <p><strong>演讲者:</strong> speaker@demo.com / password</p>
                <p><strong>听众:</strong> audience@demo.com / password</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
