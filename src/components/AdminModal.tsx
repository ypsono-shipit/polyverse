import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Edit2, Upload, Lock } from 'lucide-react';
import { EcosystemProject, getEcosystemProjects, saveEcosystemProjects } from '../data/ecosystemData';

const ADMIN_PASSWORD = 'polyverse69';
const AUTH_KEY = 'polyverse_admin_auth';

interface AdminModalProps {
  onClose: () => void;
}

export default function AdminModal({ onClose }: AdminModalProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [projects, setProjects] = useState<EcosystemProject[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<EcosystemProject>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if already authenticated this session
    if (sessionStorage.getItem(AUTH_KEY) === 'true') {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      setProjects(getEcosystemProjects());
    }
  }, [authenticated]);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, 'true');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleSave = () => {
    saveEcosystemProjects(projects);
    onClose();
  };

  const handleAdd = () => {
    const newProject: EcosystemProject = {
      id: Date.now().toString(),
      name: 'New Project',
      logo: '',
      description: '',
      link: '',
      token: '',
      tokenLink: '',
      platform: 'Both'
    };
    setProjects([newProject, ...projects]);
    setEditingId(newProject.id);
    setFormData(newProject);
  };

  const handleDelete = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const startEdit = (project: EcosystemProject) => {
    setEditingId(project.id);
    setFormData(project);
  };

  const saveEdit = () => {
    if (editingId) {
      setProjects(projects.map(p => p.id === editingId ? { ...p, ...formData } as EcosystemProject : p));
      setEditingId(null);
      setFormData({});
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  if (!authenticated) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
        <div className="w-full max-w-sm bg-[#0a0a0a] border border-gray-700 rounded-xl shadow-2xl p-8">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Admin Access</h2>
            <p className="text-gray-500 text-sm text-center font-mono">Enter the admin password to continue</p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              placeholder="Password"
              autoFocus
              className={`w-full bg-black border rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none transition-colors ${
                passwordError ? 'border-red-500/50 focus:border-red-500' : 'border-gray-700 focus:border-blue-500'
              }`}
            />
            {passwordError && (
              <p className="text-red-400 text-xs font-mono">Incorrect password</p>
            )}
            <button
              onClick={handlePasswordSubmit}
              className="w-full py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 rounded-lg font-mono text-sm transition-colors"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl bg-[#0a0a0a] border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Ecosystem Admin</h2>
            <p className="text-gray-400 text-sm mt-1">Manage projects listed in the ecosystem directory</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-200">Projects List</h3>
            <button 
              onClick={handleAdd}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-lg text-sm font-mono transition-colors border border-gray-700"
            >
              <Plus className="w-4 h-4" />
              Add Project
            </button>
          </div>

          <div className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-mono">
                  <th className="p-4 font-medium">Name & Logo</th>
                  <th className="p-4 font-medium">Platform</th>
                  <th className="p-4 font-medium">Token</th>
                  <th className="p-4 font-medium">Link</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {projects.map(project => (
                  <tr key={project.id} className="hover:bg-gray-900/30 transition-colors">
                    <td className="p-4">
                      {editingId === project.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={formData.name || ''}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="Project Name"
                            className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                          />
                          <div className="flex items-center gap-2">
                            {formData.logo && (
                              <img src={formData.logo} alt="" className="w-8 h-8 rounded object-cover border border-gray-700" />
                            )}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors border border-gray-700"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload Logo
                            </button>
                            <span className="text-gray-600 text-xs">or</span>
                            <input
                              type="text"
                              value={formData.logo?.startsWith('data:') ? '' : (formData.logo || '')}
                              onChange={e => setFormData({...formData, logo: e.target.value})}
                              placeholder="Paste URL"
                              className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none flex-1"
                            />
                          </div>
                          <textarea
                            value={formData.description || ''}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="Description"
                            rows={2}
                            className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none resize-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                            {project.logo ? (
                              <img src={project.logo} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/100/100'; }} />
                            ) : (
                              <span className="text-xs text-gray-500">{project.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-200">{project.name}</div>
                            <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">{project.description}</div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === project.id ? (
                        <select 
                          value={formData.platform || 'Both'}
                          onChange={e => setFormData({...formData, platform: e.target.value as any})}
                          className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                        >
                          <option value="Polymarket">Polymarket</option>
                          <option value="Kalshi">Kalshi</option>
                          <option value="Both">Both</option>
                        </select>
                      ) : (
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs font-mono">{project.platform}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === project.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={formData.token || ''}
                            onChange={e => setFormData({...formData, token: e.target.value})}
                            placeholder="Token Symbol"
                            className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none w-32"
                          />
                          <input
                            type="text"
                            value={formData.tokenLink || ''}
                            onChange={e => setFormData({...formData, tokenLink: e.target.value})}
                            placeholder="Token URL"
                            className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none w-32"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {project.tokenLink ? (
                            <a href={project.tokenLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 font-mono">{project.token || '-'}</a>
                          ) : (
                            <span className="text-sm text-gray-400 font-mono">{project.token || '-'}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === project.id ? (
                        <input 
                          type="text" 
                          value={formData.link || ''} 
                          onChange={e => setFormData({...formData, link: e.target.value})}
                          placeholder="https://..."
                          className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none w-48"
                        />
                      ) : (
                        <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline truncate max-w-[150px] inline-block">
                          {project.link}
                        </a>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {editingId === project.id ? (
                        <button 
                          onClick={saveEdit}
                          className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 text-sm font-medium transition-colors"
                        >
                          Done
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => startEdit(project)}
                            className="p-1.5 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(project.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-gray-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                      No projects found. Add one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
