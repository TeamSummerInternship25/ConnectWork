import React from 'react'; 
 
interface QuizCardProps { 
  title: string; 
  description: string; 
} 
 
export default function QuizCard({ title, description }: QuizCardProps) { 
  return ( 
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow"> 
      <h3 className="font-semibold">{title}</h3> 
      <p className="text-gray-600">{description}</p> 
    </div> 
  ); 
} 
