'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { FileUploadResponse } from '@/types';

interface FileUploadProps {
  presentationId: string;
  onUploadSuccess?: (response: FileUploadResponse) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

interface UploadedContent {
  id: string;
  originalName: string;
  contentType: string;
  extractedText: string;
  createdAt: string;
  metadata?: any;
}

const FileUpload: React.FC<FileUploadProps> = ({
  presentationId,
  onUploadSuccess,
  onUploadError,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedContents, setUploadedContents] = useState<UploadedContent[]>([]);
  const [aiProcessingStatus, setAiProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = [
    '.txt', '.md', '.pdf', '.ppt', '.pptx',
    '.mp3', '.wav', '.m4a', '.mp4', '.avi', '.mov'
  ];

  // 加载已上传的内容
  useEffect(() => {
    loadUploadedContents();
  }, [presentationId]);

  const loadUploadedContents = async () => {
    try {
      const response = await apiService.getPresentationContents(presentationId);
      if (response.contents) {
        setUploadedContents(response.contents);
      }
    } catch (error) {
      console.error('Failed to load uploaded contents:', error);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // 验证文件大小 (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      onUploadError?.('文件大小不能超过50MB');
      return;
    }

    // 验证文件类型
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedTypes.includes(fileExtension)) {
      onUploadError?.('不支持的文件类型');
      return;
    }

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setAiProcessingStatus('uploading');

      const response = await apiService.uploadContent(presentationId, file);

      if (response.message) {
        setAiProcessingStatus('processing');
        onUploadSuccess?.(response);

        // 重新加载已上传的内容
        await loadUploadedContents();

        // 检查AI处理状态
        setTimeout(() => {
          setAiProcessingStatus('completed');
        }, 2000);
      } else {
        throw new Error(response.error || '上传失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      setAiProcessingStatus('error');
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  const deleteContent = async (contentId: string) => {
    if (!confirm('确定要删除这个文件吗？')) {
      return;
    }

    try {
      await apiService.deleteContent(contentId);
      await loadUploadedContents();
    } catch (error) {
      console.error('Failed to delete content:', error);
      onUploadError?.('删除文件失败');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`file-upload-container ${className}`}>
      {/* 文件上传区域 */}
      <div
        className={`
          file-upload-area
          ${dragOver ? 'drag-over' : ''}
          ${uploading ? 'uploading' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
        />

        <div className="upload-content">
          {uploading ? (
            <div className="upload-progress">
              <div className="upload-icon-container">
                <div className="upload-icon-bg">
                  <div className="spinner"></div>
                </div>
              </div>
              <h3>正在上传文件...</h3>
              <p>{aiProcessingStatus === 'uploading' ? '文件上传中' : aiProcessingStatus === 'processing' ? 'AI正在处理内容' : '处理完成'}</p>
              {uploadProgress > 0 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="upload-icon-container">
                <div className="upload-icon-bg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              </div>
              <h3>上传演讲内容</h3>
              <p>拖拽文件到此处或点击选择文件</p>
              <div className="supported-formats">
                <p>支持的格式：</p>
                <div className="format-tags">
                  <span className="format-tag">
                    <div className="format-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    文本
                  </span>
                  <span className="format-tag">
                    <div className="format-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    PDF
                  </span>
                  <span className="format-tag">
                    <div className="format-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="13,2 13,9 20,9" stroke="currentColor" strokeWidth="2"/>
                        <path d="M8 13h8" stroke="currentColor" strokeWidth="2"/>
                        <path d="M8 17h8" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    PPT
                  </span>
                  <span className="format-tag">
                    <div className="format-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    音频
                  </span>
                  <span className="format-tag">
                    <div className="format-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <polygon points="23 7 16 12 23 17 23 7" stroke="currentColor" strokeWidth="2"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    视频
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 已上传内容列表 */}
      {uploadedContents.length > 0 && (
        <div className="uploaded-contents">
          <h4>已上传的内容</h4>
          <div className="content-list">
            {uploadedContents.map((content) => (
              <div key={content.id} className="content-item">
                <div className="content-info">
                  <div className="content-icon-container">
                    <div className="content-icon-bg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  </div>
                  <div className="content-details">
                    <h5>{content.originalName}</h5>
                    <p>{content.contentType} • {new Date(content.createdAt).toLocaleDateString('zh-CN')}</p>
                    {content.extractedText && (
                      <p className="content-preview">{content.extractedText.substring(0, 100)}...</p>
                    )}
                  </div>
                </div>
                <div className="content-actions">
                  <button
                    className="action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteContent(content.id);
                    }}
                    title="删除"
                  >
                    <div className="action-icon-bg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2"/>
                        <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .file-upload-container {
          width: 100%;
          space-y: 1.5rem;
        }

        .file-upload-area {
          border: 2px dashed #e5e7eb;
          border-radius: 16px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #ffffff;
          min-height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .file-upload-area::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
        }

        .file-upload-area:hover {
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.15);
        }

        .file-upload-area:hover::before {
          opacity: 0.05;
        }

        .file-upload-area.drag-over {
          border-color: #667eea;
          transform: scale(1.02);
          box-shadow: 0 15px 35px rgba(102, 126, 234, 0.2);
        }

        .file-upload-area.drag-over::before {
          opacity: 0.1;
        }

        .file-upload-area.uploading {
          pointer-events: none;
          opacity: 0.8;
        }

        .upload-content {
          max-width: 400px;
          position: relative;
          z-index: 1;
        }

        .upload-icon-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .upload-icon-bg {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
          transition: all 0.3s ease;
        }

        .file-upload-area:hover .upload-icon-bg {
          transform: scale(1.1);
          box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
        }

        .upload-content h3 {
          color: #1f2937;
          margin-bottom: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.025em;
        }

        .upload-content > p {
          color: #6b7280;
          margin-bottom: 2rem;
          font-size: 1rem;
          line-height: 1.5;
        }

        .supported-formats {
          margin-top: 2rem;
        }

        .supported-formats p {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          font-weight: 500;
        }

        .format-tags {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .format-tag {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
          padding: 0.5rem 1rem;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .format-tag:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }

        .format-icon {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #667eea;
        }

        .upload-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .upload-progress p {
          color: #6b7280;
          margin: 0;
          font-size: 1rem;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 1rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s ease;
        }

        .uploaded-contents {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .uploaded-contents h4 {
          color: #1f2937;
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .content-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .content-item {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .content-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .content-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .content-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .content-icon-bg {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
        }

        .content-details h5 {
          color: #1f2937;
          font-size: 0.875rem;
          font-weight: 600;
          margin: 0 0 0.25rem 0;
        }

        .content-details p {
          color: #6b7280;
          font-size: 0.75rem;
          margin: 0;
          line-height: 1.4;
        }

        .content-preview {
          color: #9ca3af !important;
          font-style: italic;
          margin-top: 0.25rem !important;
        }

        .content-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-icon-bg {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .delete-btn .action-icon-bg {
          background: #fef2f2;
          color: #dc2626;
        }

        .delete-btn:hover .action-icon-bg {
          background: #fee2e2;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};

export default FileUpload;
