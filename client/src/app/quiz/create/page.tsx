'use client'; 
import React, { useState } from 'react'; 
 
export default function CreateQuizPage() { 
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    timeLimit: 30 
  }); 
 
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    console.log('Creating quiz:', formData); 
  }; 
 
  return ( 
    <div className="container mx-auto px-4 py-8"> 
      <h1 className="text-2xl font-bold mb-6">Create New Quiz</h1> 
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4"> 
        <input 
          type="text" 
          placeholder="Quiz Title" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md" 
          value={formData.title} 
          onChange={(e) => setFormData({...formData, title: e.target.value})} 
        /> 
        <textarea 
          placeholder="Description" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md h-24" 
          value={formData.description} 
          onChange={(e) => setFormData({...formData, description: e.target.value})} 
        /> 
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"> 
          Create Quiz 
        </button> 
      </form> 
    </div> 
  ); 
} 
