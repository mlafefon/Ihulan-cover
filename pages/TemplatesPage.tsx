

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { PlusIcon, SearchIcon, TrashIcon, SpinnerIcon } from '../components/Icons';
import type { Template, TemplatePreview, CanvasElement } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useTemplates } from '../components/TemplateContext';

const TemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { myTemplates, publicTemplates, loading, error, removeTemplate, fetchFullTemplate } = useTemplates();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'my' | 'public'>(() => {
    const savedTab = sessionStorage.getItem('templatesPageActiveTab');
    return (savedTab === 'my' || savedTab === 'public') ? savedTab : 'public';
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<TemplatePreview | null>(null);
  const [selectingTemplateId, setSelectingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem('templatesPageActiveTab', activeTab);
  }, [activeTab]);

  const initiateDelete = (template: TemplatePreview) => {
    setTemplateToDelete(template);
  };

  const cancelDelete = () => {
    setTemplateToDelete(null);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    
    const templateIdToDelete = templateToDelete.id;
    setTemplateToDelete(null);

    try {
        const { error } = await supabase
            .from('templates')
            .update({ is_active: false })
            .eq('id', templateIdToDelete);
        
        if (error) {
            throw error;
        }
        
        removeTemplate(templateIdToDelete); // Update global state via context
    } catch (error: any) {
        console.error('Error soft-deleting template:', error);
        setLocalError(`שגיאה במחיקת התבנית: ${error.message}`);
    }
  };

  const handleSelectTemplate = async (template: TemplatePreview) => {
    setLocalError(null);
    setSelectingTemplateId(template.id);
    try {
      const fullTemplate = await fetchFullTemplate(template.id);
      if (fullTemplate) {
        navigate('/editor', { state: { template: fullTemplate } });
      } else {
        throw new Error('לא ניתן היה לטעון את פרטי התבנית.');
      }
    } catch (err: any) {
      console.error("Error fetching full template:", err);
      setLocalError(`שגיאה בטעינת התבנית: ${err.message}`);
      setSelectingTemplateId(null);
    }
  };
  
  const handleNewDesign = async () => {
    setLocalError(null);
    setSelectingTemplateId('new_design');
    try {
      const response = await fetch('./templates/default.json');
      if (!response.ok) {
        throw new Error(`שגיאת רשת: ${response.statusText}`);
      }
      const defaultTemplateData = await response.json();

      // Ensure element IDs inside the new template are unique to prevent key collisions.
      const elementsWithNewIds = (defaultTemplateData.items || []).map((el: CanvasElement) => ({
          ...el,
          id: `${el.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));

      const newTemplate: Template = {
        id: `new_${Date.now()}`,
        name: 'עיצוב חדש',
        width: defaultTemplateData.width || 800,
        height: defaultTemplateData.height || 1000,
        background_color: defaultTemplateData.backgroundColor || '#1a202c',
        elements: elementsWithNewIds,
        user_id: user?.id,
        is_public: false,
        is_active: true,
      };
      navigate('/editor', { state: { template: newTemplate } });
    } catch (err: any) {
      console.error("Error fetching default template:", err);
      setLocalError(`שגיאה בטעינת תבנית ברירת המחדל: ${err.message}`);
      setSelectingTemplateId(null);
    }
  };

  const templatesToShow = activeTab === 'my' ? myTemplates : publicTemplates;

  const filteredTemplates = useMemo(() => {
    return templatesToShow.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, templatesToShow]);

  const renderContent = () => {
    if (loading) {
        return (
            <div className="flex items-center justify-center pt-20">
                <SpinnerIcon className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }
    if (error || localError) {
        return <div className="text-center text-red-400">{error || localError}</div>;
    }
    
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 ${selectingTemplateId ? 'opacity-50 pointer-events-none' : ''}`}>
          {filteredTemplates.map(template => {
            const isBeingSelected = selectingTemplateId === template.id;
            return (
                <div key={template.id} className="group relative flex flex-col">
                    <div onClick={() => !selectingTemplateId && handleSelectTemplate(template)} className="w-[70%] mx-auto cursor-pointer relative bg-slate-800 rounded-lg shadow-lg overflow-hidden transform group-hover:scale-105 group-hover:shadow-blue-500/50 transition-all duration-300 aspect-[4/5]">
                        <div className="w-full h-full bg-cover bg-center" style={{backgroundImage: `url(${template.previewImage})`}}></div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300"></div>
                        {isBeingSelected && (
                            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                                <SpinnerIcon className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}
                    </div>
                    <div className="w-[70%] mx-auto flex justify-center items-center mt-3 relative">
                        <h3 className="font-semibold text-white text-center truncate">{template.name}</h3>
                        {activeTab === 'my' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); initiateDelete(template); }} 
                            className="absolute left-0 text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-colors"
                            title="מחק תבנית"
                        >
                            <TrashIcon className="w-5 h-5"/>
                        </button>
                        )}
                    </div>
                    {templateToDelete?.id === template.id && (
                        <div 
                            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 rounded-lg text-center transition-opacity duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="text-white font-bold mb-4">האם למחוק את התבנית "{template.name}"?</p>
                            <div className="flex gap-4">
                                <button 
                                    onClick={cancelDelete} 
                                    className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-md transition-colors"
                                >
                                    ביטול
                                </button>
                                <button 
                                    onClick={confirmDelete} 
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md transition-colors"
                                >
                                    מחק
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
          })}
        </div>
    );
  }

  const tabClass = (tabName: 'my' | 'public') => 
    `px-4 py-2 text-sm font-medium rounded-md ${activeTab === tabName ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`;

  return (
    <div className="flex flex-col min-h-screen bg-[#111827]">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">בחר את העיצוב שלך</h1>
          <p className="text-slate-400">התחל מתבנית קיימת או צור עיצוב חדש מאפס.</p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="relative w-full md:w-1/3">
            <input
              type="text"
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pr-10 pl-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          </div>
          <button
            onClick={() => !selectingTemplateId && handleNewDesign()}
            disabled={!!selectingTemplateId}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectingTemplateId === 'new_design' ? (
                <SpinnerIcon className="w-5 h-5 animate-spin" />
            ) : (
                <PlusIcon className="w-5 h-5" />
            )}
            <span>עיצוב חדש</span>
          </button>
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setActiveTab('my')} className={tabClass('my')}>
              העיצובים שלי
            </button>
            <button onClick={() => setActiveTab('public')} className={tabClass('public')}>
              תבניות ציבוריות
            </button>
          </div>
        </div>
        
        {renderContent()}

      </main>
    </div>
  );
};

export default TemplatesPage;