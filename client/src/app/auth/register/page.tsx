'use client'; 
import React, { useState } from 'react'; 
import { registerSchema } from '@/lib/validation/auth'; 
import { useAuth } from '@/hooks/useAuth'; 
 
export default function RegisterPage() { 
  const [formData, setFormData] = useState({ 
    email: '', password: '', confirmPassword: '' 
  }); 
  const [errors, setErrors] = useState({}); 
  const { register, isLoading, error } = useAuth(); 
 
  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const result = registerSchema.safeParse(formData); 
    if (!result.success) { 
      setErrors(result.error.flatten().fieldErrors); 
      return; 
    } 
    const response = await register(formData); 
    if (response.success) { 
      alert('Registration successful!'); 
    } 
  }; 
 
  return ( 
    <div className="min-h-screen flex items-center justify-center bg-gray-50"> 
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow"> 
        <h2 className="text-3xl font-bold text-center text-gray-900">Register</h2> 
        {error && <div className="text-red-600 text-sm">{error}</div>} 
        <input 
          type="email" 
          placeholder="Email" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md" 
          value={formData.email} 
          onChange={(e) => setFormData({...formData, email: e.target.value})} 
        /> 
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md" 
          value={formData.password} 
          onChange={(e) => setFormData({...formData, password: e.target.value})} 
        /> 
        <button 
          type="submit" 
          disabled={isLoading} 
          className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50" 
        > 
          {isLoading ? 'Registering...' : 'Register'} 
        </button> 
      </form> 
    </div> 
  ); 
} 
