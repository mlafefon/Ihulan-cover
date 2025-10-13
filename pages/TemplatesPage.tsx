import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { PlusIcon, SearchIcon, TrashIcon } from '../components/Icons';
import type { Template, CanvasElement, TemplateRow } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

const TemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [myTemplates, setMyTemplates] = useState<Template[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transformRowToTemplate = (row: TemplateRow): Template => {
    const data = row.template_data as {
        width?: number;
        height?: number;
        backgroundColor?: string;
        items?: CanvasElement[];
    } | null;

    return {
        id: row.id,
        name: row.name || 'תבנית ללא שם',
        previewImage: row.previewImage,
        user_id: row.user_id,
        created_at: row.created_at,
        width: data?.width || 800,
        height: data?.height || 1000,
        background_color: data?.backgroundColor || '#1a202c',
        elements: data?.items || [],
    };
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!user) return;
      try {
        setLoading(true);
        setError(null);
        
        const { data: myData, error: myError } = await supabase
          .from('templates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (myError) throw myError;
        setMyTemplates((myData || []).map(transformRowToTemplate));

        const { data: publicData, error: publicError } = await supabase
          .from('templates')
          .select('*')
          .is('user_id', null);

        if (publicError) throw publicError;
        setPublicTemplates((publicData || []).map(transformRowToTemplate));

      } catch (e: any) {
        console.error("Failed to fetch templates:", e);
        setError('לא ניתן לטעון את התבניות. נסה שוב מאוחר יותר.');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [user]);
  
  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק תבנית זו?')) {
        try {
            const { error } = await supabase.from('templates').delete().eq('id', templateId);
            if (error) throw error;
            setMyTemplates(myTemplates.filter(t => t.id !== templateId));
        } catch (error: any) {
            console.error('Error deleting template:', error);
            setError(`שגיאה במחיקת התבנית: ${error.message}`);
        }
    }
  };

  const handleSelectTemplate = (template: Template) => {
    navigate('/editor', { state: { template } });
  };
  
  const handleNewDesign = () => {
    const newTemplate: Template = {
      id: `new_${Date.now()}`,
      name: 'עיצוב חדש',
      width: 800,
      height: 1000,
      background_color: '#1a202c',
      elements: [],
    };
    navigate('/editor', { state: { template: newTemplate } });
  };

  const templatesToShow = activeTab === 'my' ? myTemplates : publicTemplates;

  const filteredTemplates = useMemo(() => {
    return templatesToShow.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, templatesToShow]);

  const renderContent = () => {
    if (loading) {
        return <div className="text-center text-slate-400">טוען תבניות...</div>;
    }
    if (error) {
        return <div className="text-center text-red-400">{error}</div>;
    }
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {activeTab === 'my' && (
            <button
              onClick={handleNewDesign}
              className="flex flex-col items-center justify-center bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg hover:bg-slate-700 hover:border-blue-500 transition-colors duration-300 aspect-[4/5] p-6"
            >
              <PlusIcon className="w-16 h-16 text-slate-500 mb-4" />
              <span className="text-xl font-semibold text-white">עיצוב חדש</span>
            </button>
          )}

          {filteredTemplates.map(template => (
            <div key={template.id} className="group flex flex-col">
              <div onClick={() => handleSelectTemplate(template)} className="cursor-pointer relative bg-slate-800 rounded-lg shadow-lg overflow-hidden transform group-hover:scale-105 group-hover:shadow-blue-500/50 transition-all duration-300 aspect-[4/5]">
                <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-20 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">ערוך תבנית</span>
                </div>
                <div className="w-full h-full bg-cover bg-center" style={{backgroundImage: `url(${template.previewImage})`}}></div>
              </div>
              <div className="flex justify-between items-center mt-3">
                <h3 className="font-semibold text-white truncate pr-2">{template.name}</h3>
                {activeTab === 'my' && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }} className="text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-colors">
                      <TrashIcon className="w-5 h-5"/>
                  </button>
                )}
              </div>
            </div>
          ))}
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