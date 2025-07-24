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
