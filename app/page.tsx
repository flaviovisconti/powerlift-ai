"use client";
import dynamic from 'next/dynamic';

// Carichiamo il componente solo sul client (browser)
const WorkoutCanvas = dynamic(() => import('@/components/WorkoutCanvas'), { 
  ssr: false 
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <WorkoutCanvas />
    </main>
  );
}