'use client'; 
import React, { useState } from 'react'; 
import { loginSchema } from '@/lib/validation/auth'; 
 
export default function LoginPage() { 
  const [formData, setFormData] = useState({ email: '', password: '' }); 
  const [errors, setErrors] = useState({}); 
 
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    const result = loginSchema.safeParse(formData); 
    if (!result.success) { 
      setErrors(result.error.flatten().fieldErrors); 
      return; 
    } 
    console.log('Login attempt:', formData); 
  }; 
 
  return ( 
    <div className="min-h-screen flex items-center justify-center bg-gray-50"> 
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow"> 
        <h2 className="text-3xl font-bold text-center text-gray-900">Login</h2> 
        <input 
          type="email" 
          placeholder="Email" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md" 
          value={formData.email} 
          onChange={(e) => setFormData({...formData, email: e.target.value})} 
        /> 
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"> 
          Login 
        </button> 
      </form> 
    </div> 
  ); 
} 
