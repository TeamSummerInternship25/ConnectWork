'use client'; 
import React, { ReactNode } from 'react'; 
import { useAuthContext } from '@/contexts/AuthContext'; 
import { useRouter } from 'next/navigation'; 
import { useEffect } from 'react'; 
 
interface ProtectedRouteProps { 
  children: ReactNode; 
  fallback?: ReactNode; 
} 
 
export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) { 
  const { isAuthenticated, isLoading } = useAuthContext(); 
  const router = useRouter(); 
 
  useEffect(() => { 
    if (!isLoading && !isAuthenticated) { 
      router.push('/auth/login'); 
    } 
  }, [isAuthenticated, isLoading, router]); 
 
  if (isLoading) { 
    return ( 
      <div className="min-h-screen flex items-center justify-center"> 
        <div className="text-lg">Loading...</div> 
      </div> 
    ); 
  } 
 
  if (!isAuthenticated) { 
