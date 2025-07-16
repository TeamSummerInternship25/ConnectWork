'use client'; 
import React, { useState } from 'react'; 
import { registerSchema } from '@/lib/validation/auth'; 
 
export default function RegisterPage() { 
  const [formData, setFormData] = useState({ 
    email: '', password: '', confirmPassword: '' 
  }); 
 
  return ( 
    <div className="min-h-screen flex items-center justify-center bg-gray-50"> 
      <form className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow"> 
        <h2 className="text-3xl font-bold text-center text-gray-900">Register</h2> 
        <input type="email" placeholder="Email" className="w-full px-3 py-2 border rounded-md" /> 
        <input type="password" placeholder="Password" className="w-full px-3 py-2 border rounded-md" /> 
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-md">Register</button> 
      </form> 
    </div> 
  ); 
} 
