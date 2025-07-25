'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';
import { Discussion, DiscussionComment } from '@/types';

interface DiscussionPanelProps {
  quizId: string;
  quizTitle: string;
  isQuizCompleted: boolean;
  quizQuestions?: Array<{
    id: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
  }>;
}

export default function DiscussionPanel({ quizId, quizTitle, isQuizCompleted, quizQuestions }: DiscussionPanelProps) {
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isQuizCompleted) {
      loadDiscussion();
      setupSocketListeners();
    }

    // Cleanup socket listeners on unmount or quiz change
    return () => {
      socketService.off('discussion-comment-added');
      socketService.off('discussion-comment-updated');
      socketService.off('discussion-comment-deleted');
    };
  }, [quizId, isQuizCompleted]);

  useEffect(() => {
    scrollToBottom();
  }, [discussion?.comments]);

  const loadDiscussion = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDiscussion(quizId);
      setDiscussion(response.discussion);
    } catch (error) {
      console.error('Failed to load discussion:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('discussion-comment-added', (data: { quizId: string; comment: DiscussionComment }) => {
      // Only update if this is for the current quiz
      if (data.quizId === quizId) {
        setDiscussion(prev => prev ? {
          ...prev,
          comments: [...prev.comments, data.comment]
        } : null);
        console.log('💬 New discussion comment received:', data.comment);
      }
    });

    socketService.on('discussion-comment-updated', (data: { quizId: string; comment: DiscussionComment }) => {
      // Only update if this is for the current quiz
      if (data.quizId === quizId) {
        setDiscussion(prev => prev ? {
          ...prev,
          comments: prev.comments.map(c => c.id === data.comment.id ? data.comment : c)
        } : null);
        console.log('✏️ Discussion comment updated:', data.comment);
      }
    });

    socketService.on('discussion-comment-deleted', (data: { quizId: string; commentId: string }) => {
      // Only update if this is for the current quiz
      if (data.quizId === quizId) {
        setDiscussion(prev => prev ? {
          ...prev,
          comments: prev.comments.filter(c => c.id !== data.commentId)
        } : null);
        console.log('🗑️ Discussion comment deleted:', data.commentId);
      }
    });
  };

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const response = await apiService.postComment(quizId, newComment.trim());

      // Add comment locally (will also be received via socket)
      setDiscussion(prev => prev ? {
        ...prev,
        comments: [...prev.comments, response.comment]
      } : null);

      setNewComment('');
    } catch (error: any) {
      alert(error.message || '发布评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (comment: DiscussionComment) => {
    setEditingComment(comment.id);
    setEditMessage(comment.message);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditMessage('');
  };

  const saveEdit = async (commentId: string) => {
    if (!editMessage.trim()) return;

    try {
      const response = await apiService.editComment(commentId, editMessage.trim());

      setDiscussion(prev => prev ? {
        ...prev,
        comments: prev.comments.map(c => c.id === commentId ? response.comment : c)
      } : null);

      setEditingComment(null);
      setEditMessage('');
    } catch (error: any) {
      alert(error.message || '更新评论失败');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('您确定要删除这条评论吗？')) return;

    try {
      await apiService.deleteComment(commentId);

      setDiscussion(prev => prev ? {
        ...prev,
        comments: prev.comments.filter(c => c.id !== commentId)
      } : null);
    } catch (error: any) {
      alert(error.message || '删除评论失败');
    }
  };

  const canEditComment = (comment: DiscussionComment) => {
    if (comment.user.id !== user?.id) return false;

    // Can edit within 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return new Date(comment.createdAt) > fifteenMinutesAgo;
  };

  const canDeleteComment = (comment: DiscussionComment) => {
    return comment.user.id === user?.id || user?.role === 'ORGANIZER';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ORGANIZER': return 'text-purple-600';
      case 'SPEAKER': return 'text-blue-600';
      case 'AUDIENCE': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getRoleBadge = (role: string) => {
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else if (diffInMinutes < 1440) { // 24小时
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (!isQuizCompleted) {
    return (
      <div className="modern-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #86868B 0%, #A0A0A0 100%)',
                boxShadow: '0 4px 15px rgba(134, 134, 139, 0.25)'
              }}>
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                讨论
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                测验结束后将开放讨论
              </p>
            </div>
          </div>
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              讨论即将开放
            </h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              完成测验后即可参与讨论！
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="modern-card">
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            讨论
          </h3>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">正在加载讨论...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modern-card">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: discussion?.isActive
                ? 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)'
                : 'linear-gradient(135deg, #FF9500 0%, #F0AD4E 100%)',
              boxShadow: discussion?.isActive
                ? '0 4px 15px rgba(52, 199, 89, 0.25)'
                : '0 4px 15px rgba(255, 149, 0, 0.25)'
            }}>
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              讨论：{quizTitle}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {discussion?.isActive ? '分享您的想法并与他人讨论' : '讨论当前已禁用'}
            </p>
          </div>
          {discussion?.isActive && (
            <div className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: '#E8F5E8',
                color: '#34C759'
              }}>
              <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              活跃
            </div>
          )}
        </div>
        {/* Quiz Questions Display */}
        {quizQuestions && quizQuestions.length > 0 && (
          <div className="mb-6 space-y-4">
            <h4 className="font-medium text-gray-900">📝 测验题目与答案</h4>
            {quizQuestions.map((question, index) => (
              <div key={question.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h5 className="font-medium mb-3">第 {index + 1} 题：{question.question}</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {['A', 'B', 'C', 'D'].map((option) => (
                    <div
                      key={option}
                      className={`p-2 rounded text-sm ${option === question.correctAnswer
                        ? 'bg-green-100 border border-green-300 text-green-800 font-medium'
                        : 'bg-white border border-gray-200'
                        }`}
                    >
                      <span className="font-medium">{option}.</span>{' '}
                      {question[`option${option}` as keyof typeof question]}
                      {option === question.correctAnswer && (
                        <span className="ml-2 text-green-600">✓ 正确</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>💬 讨论</h4>
            </div>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
          {discussion?.comments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                开始讨论
              </h4>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                还没有评论。成为第一个分享想法的人！
              </p>
            </div>
          ) : (
            discussion?.comments.map((comment) => (
              <div key={comment.id}
                className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm text-white"
                      style={{
                        background: comment.user.role === 'ORGANIZER'
                          ? 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)'
                          : comment.user.role === 'SPEAKER'
                          ? 'linear-gradient(135deg, #34C759 0%, #5CB85C 100%)'
                          : 'linear-gradient(135deg, #5856D6 0%, #7B68EE 100%)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}>
                      {comment.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {comment.user.username}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full font-semibold"
                          style={{
                            background: comment.user.role === 'ORGANIZER' ? '#E3F2FD' :
                              comment.user.role === 'SPEAKER' ? '#E8F5E8' : '#F0F0FF',
                            color: comment.user.role === 'ORGANIZER' ? '#007AFF' :
                              comment.user.role === 'SPEAKER' ? '#34C759' : '#5856D6'
                          }}>
                          {getRoleDisplayName(comment.user.role)}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatTime(comment.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditComment(comment) && (
                      <button
                        onClick={() => startEdit(comment)}
                        className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                        style={{
                          background: 'linear-gradient(135deg, #007AFF 0%, #4A90E2 100%)',
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)'
                        }}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                        </svg>
                      </button>
                    )}
                    {canDeleteComment(comment) && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                        style={{
                          background: 'linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%)',
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(255, 59, 48, 0.25)'
                        }}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {editingComment === comment.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="编辑您的评论..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(comment.id)}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="btn-secondary text-sm px-4 py-2"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-gray-800 leading-relaxed">{comment.message}</p>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment Form */}
        {discussion?.isActive && (
          <div className="border-t border-gray-200 pt-4 mt-6">
            <form onSubmit={submitComment} className="space-y-4">
              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="分享您对这个测验的想法..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  rows={4}
                  disabled={submitting}
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {newComment.length}/500
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  💡 分享您的想法和见解
                </div>
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting || newComment.length > 500}
                  className="btn-primary px-6 py-2"
                >
                  {submitting ? '发布中...' : '发布评论'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
