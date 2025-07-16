'use client';
import React, { useState } from 'react';
import { Question } from '@/types/quiz';

interface QuestionEditorProps {
  question?: Question;
  onSave: (question: Omit<Question, 'id'>) => void;
  onCancel: () => void;
}

export default function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [formData, setFormData] = useState({
    text: question?.text || '',
    type: question?.type || 'multiple-choice' as const,
    options: question?.options || ['', '', '', ''],
    correctAnswer: question?.correctAnswer || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      <h3 className="text-lg font-semibold mb-4">Edit Question</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          placeholder="Question text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md h-20"
          value={formData.text}
          onChange={(e) => setFormData({...formData, text: e.target.value})}
        />
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={formData.type}
          onChange={(e) => setFormData({...formData, type: e.target.value as any})}
        >
          <option value="multiple-choice">Multiple Choice</option>
          <option value="true-false">True/False</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Save
          </button>
          <button type="button" onClick={onCancel} className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
