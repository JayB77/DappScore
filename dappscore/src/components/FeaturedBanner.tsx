'use client';

import Link from 'next/link';
import { Clock, ExternalLink, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface FeaturedProject {
  id: number;
  name: string;
  symbol: string;
  description: string;
  logoUrl?: string;
  endDate: number;
}

function CountdownTimer({ endDate }: { endDate: number }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = endDate - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        mins: Math.floor((diff % 3600) / 60),
        secs: diff % 60,
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="flex space-x-2">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="bg-yellow-500 text-black px-2 py-1 rounded text-center min-w-[40px]">
          <div className="text-lg font-bold">{value}</div>
          <div className="text-[10px] uppercase">{unit}</div>
        </div>
      ))}
    </div>
  );
}

export function FeaturedBanner({ project }: { project: FeaturedProject | null }) {
  if (!project) {
    return (
      <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-600/50 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Shield className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Featured Spot Available</h3>
            <p className="text-gray-300 mb-4">Get your project featured here</p>
            <Link
              href="/submit"
              className="inline-flex items-center px-4 py-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400 transition-colors"
            >
              Submit Your Project
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-yellow-500 rounded-lg overflow-hidden mb-8">
      <div className="bg-yellow-500 text-black text-center text-sm font-bold py-1">
        FEATURED PROJECT
      </div>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
              {project.logoUrl ? (
                <img src={project.logoUrl} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-yellow-500">
                  {project.symbol.slice(0, 2)}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{project.name}</h2>
              <p className="text-gray-400">{project.description}</p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end space-y-2">
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
              <Clock className="h-4 w-4" />
              <span>Sale ends in:</span>
            </div>
            <CountdownTimer endDate={project.endDate} />
            <Link
              href={`/projects/${project.id}`}
              className="flex items-center space-x-1 text-yellow-500 hover:text-yellow-400 mt-2"
            >
              <span>View Project</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
