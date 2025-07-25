'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
// Modern UI components will be replaced with custom styled elements
import FileUpload from '@/components/FileUpload';
import {
  QuizWithRelations,
  PresentationWithRelations,
} from '@/types';

export default function PresentationManagePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const presentationId = params.id as string;

  const [presentation, setPresentation] = useState<PresentationWithRelations | null>(null);
  const [quizzes, setQuizzes] = useState<QuizWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuiz, setEditingQuiz] = useState<QuizWithRelations | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<QuizWithRelations | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    if (user && user.role === 'SPEAKER') {
      loadPresentation();
    }
  }, [presentationId, user]);

  // 添加定期刷新机制，检查AI生成的新题目
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        refreshQuizzes();
      }
    }, 10000); // 每10秒检查一次

    return () => clearInterval(interval);
  }, [loading, refreshing]);

  const loadPresentation = async (retryCount = 0) => {
    try {
      const response = await apiService.getPresentation(presentationId);
      setPresentation(response.presentation);
      // 转换Quiz[]为QuizWithRelations[]
      const quizzesWithRelations = (response.presentation.quizzes || []).map(quiz => ({
        ...quiz,
        presentation: response.presentation,
        questions: (quiz as any).questions || [],
        answers: (quiz as any).answers || []
      }));
      setQuizzes(quizzesWithRelations);
    } catch (error) {
      console.error('加载演示失败:', error);

      // Retry up to 2 times with increasing delay
      if (retryCount < 2) {
        console.log(`重试中... (尝试 ${retryCount + 1})`);
        setTimeout(() => {
          loadPresentation(retryCount + 1);
        }, (retryCount + 1) * 1000);
        return;
      }

      // After all retries failed, redirect to dashboard
      console.error('所有重试尝试失败，重定向到仪表板');
      router.push('/speaker/dashboard');
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };

  const refreshQuizzes = async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      const response = await apiService.getPresentation(presentationId);
      const newQuizzes = response.presentation.quizzes || [];

      // 只有当题目数量发生变化时才更新
      if (newQuizzes.length !== quizzes.length) {
        // 转换Quiz[]为QuizWithRelations[]
        const quizzesWithRelations = newQuizzes.map(quiz => ({
          ...quiz,
          presentation: response.presentation,
          questions: (quiz as any).questions || [],
          answers: (quiz as any).answers || []
        }));
        setQuizzes(quizzesWithRelations);
        console.log(`🔄 发现新题目！当前题目数: ${newQuizzes.length}`);
      }
    } catch (error) {
      console.error('刷新测验失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    await refreshQuizzes();
  };



  const startPresentation = async () => {
    try {
      console.log('🚀 Starting presentation:', presentationId);

      // Start the presentation via API
      const response = await apiService.startPresentation(presentationId);

      console.log('✅ Presentation started successfully:', response);

      // Update local presentation state
      if (response.presentation) {
        setPresentation(prev => prev ? {
          ...prev,
          isActive: true,
          startTime: response.presentation.startTime || new Date().toISOString()
        } : prev);
        console.log('✅ Local presentation state updated');
      }

      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to live page
      const targetUrl = `/speaker/presentation/${presentationId}/live`;
      console.log('� Navigating to:', targetUrl);
      window.location.href = targetUrl;

    } catch (error: any) {
      console.error('❌ Failed to start presentation:', error);
      alert(error.message || '启动演示失败');
    }
  };

  const handleEditQuiz = (quiz: QuizWithRelations) => {
    setEditingQuiz(quiz);
    // Initialize edited questions with current data
    setEditedQuestions(quiz.questions || []);
  };

  const handlePreviewQuiz = (quiz: QuizWithRelations) => {
    setPreviewQuiz(quiz);
  };

  const handleCloseEdit = () => {
    setEditingQuiz(null);
    setEditedQuestions([]);
    // Reload quizzes to get updated data
    loadPresentation();
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updated = [...editedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditedQuestions(updated);
  };

  const saveQuizChanges = async () => {
    if (!editingQuiz) return;

    setSaving(true);
    try {
      // Update each question
      for (const question of editedQuestions) {
        await apiService.updateQuizQuestion(question.id, {
          question: question.question,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation || ''
        });
      }

      alert('测验更新成功！');
      handleCloseEdit();
    } catch (error: any) {
      console.error('更新测验失败:', error);
      alert(`更新测验失败: ${error.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewQuiz(null);
  };

  const handleDeleteQuiz = async (quiz: QuizWithRelations) => {
    if (!confirm(`确定要删除测验"${quiz.title}"吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await apiService.deleteQuiz(quiz.id);

      // 更新本地状态
      setQuizzes(prev => prev.filter(q => q.id !== quiz.id));

      alert('测验删除成功！');
    } catch (error: any) {
      console.error('删除测验失败:', error);
      alert(error.message || '删除测验失败');
    }
  };

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
  if (!user || user.role !== 'SPEAKER') {
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
          <p className="mt-4 text-lg text-gray-600">正在加载演示...</p>
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
              Presentation not found
            </h2>
            <button
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                  window.location.href = '/speaker/dashboard';
                }, 100);
              }}
              className="btn-secondary"
            >
              返回仪表板
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{presentation.title}</h1>
              <p className="text-gray-600 mt-1">{presentation.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                <span>演讲者: {presentation.speaker.username}</span>
                <span>开始时间: {new Date(presentation.startTime).toLocaleString()}</span>
                <span>状态: {presentation.isActive ? '活跃' : '非活跃'}</span>
              </div>
            </div>
            <div className="flex gap-3">
              {presentation.isActive ? (
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetUrl = `/speaker/presentation/${presentationId}/live`;
                    window.location.href = targetUrl;
                  }}
                  className="btn-primary"
                >
                  开始直播
                </button>
              ) : (
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startPresentation();
                  }}
                  className="btn-primary"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  开始演示
                </button>
              )}
              <button
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => {
                    window.location.href = '/speaker/dashboard';
                  }, 100);
                }}
                className="btn-secondary"
              >
                返回仪表板
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-8">
        <div className="space-y-6">
          {/* Modern Tab Navigation */}
          <div className="modern-card p-1 animate-fade-in-up">
            <div className="grid grid-cols-3 gap-1">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'content'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
                  }`}
                style={{
                  color: activeTab === 'content' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === 'content' ? 'var(--surface)' : 'transparent'
                }}
                onClick={() => setActiveTab('content')}
              >
                上传内容
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'quizzes'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
                  }`}
                style={{
                  color: activeTab === 'quizzes' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === 'quizzes' ? 'var(--surface)' : 'transparent'
                }}
                onClick={() => setActiveTab('quizzes')}
              >
                管理测验
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'settings'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
                  }`}
                style={{
                  color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === 'settings' ? 'var(--surface)' : 'transparent'
                }}
                onClick={() => setActiveTab('settings')}
              >
                设置
              </button>
            </div>
          </div>

          {/* Content Tab */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    上传演示材料
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    上传文件以使用AI自动生成测验问题
                  </p>
                  <FileUpload
                    presentationId={presentationId}
                    onUploadSuccess={(result) => {
                      console.log('文件上传成功:', result);
                      // 显示上传成功提示
                      alert('文件上传成功！AI正在后台生成题目，请等待10-30秒后点击"刷新题目"按钮查看新生成的测验。');
                      // 刷新演讲数据
                      loadPresentation();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quizzes Tab */}
          {activeTab === 'quizzes' && (
            <div className="space-y-6">
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                        测验管理
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        管理您生成的测验和问题
                      </p>
                    </div>
                    <button
                      onClick={handleManualRefresh}
                      disabled={refreshing}
                      className="btn-secondary text-sm"
                    >
                      {refreshing ? '刷新中...' : '🔄 刷新题目'}
                    </button>
                  </div>
                  {quizzes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">暂无测验题目</p>
                      <div className="text-sm text-gray-400 space-y-2">
                        <p>📄 请在"上传内容"标签页上传文件以自动生成测验</p>
                        <p>⚠️ 确保文件内容超过200字符才会触发AI生成</p>
                        <p>🔄 上传后请等待10-30秒，然后点击"刷新题目"按钮</p>
                        <p>🈳 支持中文内容，请确保文件保存为UTF-8编码</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {quizzes.map((quiz) => (
                        <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{quiz.title}</h3>
                              <p className="text-sm text-gray-600">
                                {quiz.questions?.length || 0} 道题
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="btn-secondary text-sm px-3 py-1"
                                onClick={() => handleEditQuiz(quiz)}
                              >
                                编辑
                              </button>
                              <button
                                className="btn-secondary text-sm px-3 py-1"
                                onClick={() => handlePreviewQuiz(quiz)}
                              >
                                预览
                              </button>
                              <button
                                className="btn-primary text-sm px-3 py-1"
                                style={{ backgroundColor: 'var(--error)' }}
                                onClick={() => handleDeleteQuiz(quiz)}
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
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="modern-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    演示设置
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    配置您的演示设置
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        演示标题
                      </label>
                      <input
                        type="text"
                        value={presentation.title}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        描述
                      </label>
                      <textarea
                        value={presentation.description || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        开始时间
                      </label>
                      <input
                        type="text"
                        value={new Date(presentation.startTime).toLocaleString()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">编辑测验: {editingQuiz.title}</h2>
              <button onClick={handleCloseEdit} className="btn-secondary text-sm">
                ✕ 关闭
              </button>
            </div>

            <div className="space-y-6">
              {editedQuestions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <h3 className="font-semibold mb-3">题目 {index + 1}</h3>

                  {/* Question Text */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      题目
                    </label>
                    <textarea
                      value={question.question}
                      onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">选项 A</label>
                      <input
                        type="text"
                        value={question.optionA}
                        onChange={(e) => updateQuestion(index, 'optionA', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">选项 B</label>
                      <input
                        type="text"
                        value={question.optionB}
                        onChange={(e) => updateQuestion(index, 'optionB', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">选项 C</label>
                      <input
                        type="text"
                        value={question.optionC}
                        onChange={(e) => updateQuestion(index, 'optionC', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">选项 D</label>
                      <input
                        type="text"
                        value={question.optionD}
                        onChange={(e) => updateQuestion(index, 'optionD', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Correct Answer */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      正确答案
                    </label>
                    <select
                      value={question.correctAnswer}
                      onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                      className="modern-select"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      解释 (可选)
                    </label>
                    <textarea
                      value={question.explanation || ''}
                      onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="为正确答案提供解释..."
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCloseEdit}
                className="btn-secondary"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={saveQuizChanges}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? '保存中...' : '保存更改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Quiz Modal */}
      {previewQuiz && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-y-auto w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">预览: {previewQuiz.title}</h2>
              <button onClick={handleClosePreview} className="btn-secondary text-sm">
                ✕ 关闭
              </button>
            </div>

            <div className="space-y-6">
              {previewQuiz.questions?.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <h3 className="font-semibold mb-3">题目 {index + 1}</h3>
                  <p className="text-lg mb-4">{question.question}</p>

                  <div className="space-y-2">
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <div
                        key={option}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${option === question.correctAnswer
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <span className="font-medium">{option}.</span>{' '}
                        {question[`option${option}` as keyof typeof question]}
                        {option === question.correctAnswer && (
                          <span className="ml-2 text-green-600 text-sm">✓ 正确</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {question.explanation && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm"><span className="font-medium">解释:</span> {question.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
