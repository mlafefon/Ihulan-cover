
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { PlusIcon, SearchIcon } from '../components/Icons';
import { initialTemplates } from '../constants';
import type { Template } from '../types';

const TemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const handleSelectTemplate = (template: Template) => {
    navigate('/editor', { state: { template } });
  };
  
  const handleNewDesign = () => {
    const newTemplate: Template = {
      id: `new_${Date.now()}`,
      name: 'עיצוב חדש',
      width: 800,
      height: 1000,
      backgroundColor: '#1a202c',
      elements: [],
    };
    navigate('/editor', { state: { template: newTemplate } });
  };

  const filteredTemplates = useMemo(() => {
    return initialTemplates.filter(template => {
        const nameMatch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'all') return nameMatch;
        return nameMatch // logic for future filters
    })
  }, [searchTerm, filter]);

  return (
    <div className="flex flex-col min-h-screen bg-[#111827]">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">בחר את העיצוב שלך</h1>
          <p className="text-slate-400">התחל מתבנית מוכנה או צור עיצוב חדש מאפס.</p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="relative w-full md:w-1/3">
            <input
              type="text"
              placeholder="חיפוש תבניות..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pr-10 pl-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          </div>
          <div className="flex items-center gap-2">
            {/* Filter buttons can be added here */}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <button
            onClick={handleNewDesign}
            className="flex flex-col items-center justify-center bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg hover:bg-slate-700 hover:border-blue-500 transition-colors duration-300 aspect-[4/5] p-6"
          >
            <PlusIcon className="w-16 h-16 text-slate-500 mb-4" />
            <span className="text-xl font-semibold text-white">עיצוב חדש</span>
          </button>

          {filteredTemplates.map(template => (
            <div key={template.id} onClick={() => handleSelectTemplate(template)} className="cursor-pointer group">
              <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden transform group-hover:scale-105 group-hover:shadow-blue-500/50 transition-all duration-300 aspect-[4/5] relative">
                <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-20 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">ערוך תבנית</span>
                </div>
                {/* This is a simple preview. A better version would render the actual elements. */}
                <div className="w-full h-full bg-cover bg-center" style={{backgroundImage: `url(${template.previewImage})`}}></div>
              </div>
              <h3 className="text-center mt-3 font-semibold">{template.name}</h3>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default TemplatesPage;
