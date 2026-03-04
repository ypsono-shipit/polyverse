import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Shield } from 'lucide-react';
import { EcosystemProject, getEcosystemProjects } from '../data/ecosystemData';

interface EcosystemModalProps {
  onClose: () => void;
  onOpenAdmin: () => void;
}

export default function EcosystemModal({ onClose, onOpenAdmin }: EcosystemModalProps) {
  const [projects, setProjects] = useState<EcosystemProject[]>([]);
  const [filter, setFilter] = useState<'All' | 'Polymarket' | 'Kalshi'>('All');

  useEffect(() => {
    setProjects(getEcosystemProjects());
  }, []);

  const filteredProjects = projects.filter(p => 
    filter === 'All' ? true : p.platform === filter || p.platform === 'Both'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-[#0a0a0a] border border-blue-500/30 rounded-xl shadow-[0_0_40px_rgba(59,130,246,0.1)] flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-blue-500/20">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Ecosystem Projects</h2>
            <p className="text-gray-400 text-sm mt-1">Explore apps built on Polymarket and Kalshi</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenAdmin}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-mono transition-colors border border-gray-600"
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-blue-400 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-6 pb-0">
          {['All', 'Polymarket', 'Kalshi'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filter === f 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' 
                  : 'bg-transparent text-gray-400 border-gray-700 hover:border-blue-500/30 hover:text-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <div key={project.id} className="bg-black/40 border border-blue-500/20 rounded-xl p-5 hover:border-blue-500/50 transition-colors group flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-700">
                    {project.logo ? (
                      <img src={project.logo} alt={project.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/100/100'; }} />
                    ) : (
                      <span className="text-xl font-bold text-gray-500">{project.name.charAt(0)}</span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {project.platform}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                <p className="text-sm text-gray-400 mb-4 flex-1 line-clamp-3">{project.description}</p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-mono uppercase">Token</span>
                    {project.tokenLink ? (
                      <a href={project.tokenLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">{project.token || 'N/A'}</a>
                    ) : (
                      <span className="text-sm font-medium text-gray-300">{project.token || 'N/A'}</span>
                    )}
                  </div>
                  
                  <a 
                    href={project.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-lg"
                  >
                    Visit <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
            {filteredProjects.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500 font-mono">
                No projects found for {filter}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
