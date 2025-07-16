import React from 'react';
import Link from 'next/link';

interface QuizCardProps {
  id: string;
  title: string;
  description: string;
}

export default function QuizCard({ id, title, description }: QuizCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <div className="flex gap-2">
        <Link
          href={\/quiz/\\}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          Edit
        </Link>
        <button className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
          Delete
        </button>
      </div>
    </div>
  );
}
