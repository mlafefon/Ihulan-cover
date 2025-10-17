import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagazineEditor from '../components/editor/MagazineEditor';
import ImageEditor from '../components/editor/ImageEditor';
import type { Template, ImageElement, ImageEditState, CanvasElement, TemplateRow, TemplatePreview } from '../types';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { useTemplates } from '../components/TemplateContext';

interface EditingImageState {
  id: string;
  src: string; // originalSrc
  width: number;
  height: number;
  editState?: ImageEditState | null;
}

interface LocationState {
    template?: Template;
}

const EditorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upsertTemplate } = useTemplates();

  const [template, setTemplate] = useState<Template | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [editingImage, setEditingImage] = useState<EditingImageState | null>(null);

  useEffect(() => {
    const state = location.state as LocationState | null;

    if (state?.template) {
      setTemplate(state.template);
      setOriginalTemplate(state.template);
      setLoading(false);
    } else {
      navigate('/templates');
    }
  }, [location.state, navigate]);

  const handleSaveTemplate = async (templateToSave: Template, newPreview: string | undefined) => {
    if (!user || !originalTemplate) return;

    const isOriginallyPublic = originalTemplate.is_public === true;
    const nameHasChanged = templateToSave.name !== originalTemplate.name;
    // Force a new record if it's a new design, a public template, or a rename (fork).
    const isNew = templateToSave.id.startsWith('new_') || isOriginallyPublic || nameHasChanged;
    
    const sanitizeForSupabase = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => sanitizeForSupabase(item));
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                newObj[key] = (typeof value !== 'undefined') ? sanitizeForSupabase(value) : null;
            }
        }
        return newObj;
    };
    
    const templateDataToSave = {
        width: templateToSave.width,
        height: templateToSave.height,
        backgroundColor: templateToSave.background_color,
        items: sanitizeForSupabase(templateToSave.elements)
    };

    const commonData = {
      name: templateToSave.name,
      previewImage: newPreview ?? null,
      template_data: templateDataToSave,
    };

    try {
      const { data, error } = isNew
        ? await supabase.from('templates').insert({ ...commonData, user_id: user.id, is_public: false, is_active: true }).select()
        : await supabase.from('templates').update(commonData).eq('id', templateToSave.id).select();

      if (error) throw error;

      if (data && data[0]) {
        const savedRow = data[0] as TemplateRow;
        
        // Unpack data for local editor state
        const savedTemplateData = savedRow.template_data as unknown as {
            width: number;
            height: number;
            backgroundColor?: string;
            items?: CanvasElement[];
        };
        const sanitizedTemplate: Template = {
            id: savedRow.id,
            name: savedRow.name || 'תבנית ללא שם',
            user_id: savedRow.user_id,
            created_at: savedRow.created_at,
            previewImage: savedRow.previewImage,
            is_public: savedRow.is_public ?? false,
            is_active: savedRow.is_active ?? true,
            width: savedTemplateData.width,
            height: savedTemplateData.height,
            background_color: savedTemplateData.backgroundColor || '#1a202c',
            elements: savedTemplateData.items || [],
        };

        // Create a lightweight preview object to update the global context
        const templatePreview: TemplatePreview = {
          id: savedRow.id,
          name: savedRow.name || 'תבנית ללא שם',
          previewImage: savedRow.previewImage,
          user_id: savedRow.user_id,
          is_public: savedRow.is_public ?? false,
          is_active: savedRow.is_active ?? true,
          created_at: savedRow.created_at,
        };
        
        // Update the global state so the templates page is instantly updated.
        // Also pass the full template data to populate the cache.
        if (!templatePreview.is_public) {
            upsertTemplate(templatePreview, sanitizedTemplate);
        }

        // Update local state to continue editing
        setTemplate(sanitizedTemplate);
        if (isNew) {
          setOriginalTemplate(sanitizedTemplate);
        }
        setEditorKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error saving template:', error);
      const errorMessage = error?.message || 'An unexpected error occurred.';
      alert(`שגיאה בשמירת התבנית: ${errorMessage}`);
    }
  };

  const handleEditImage = (element: ImageElement, currentTemplate: Template, newSrc?: string) => {
    const imageToEdit = newSrc || element.originalSrc || element.src;
    setTemplate(currentTemplate);
    setEditingImage({ 
      id: element.id, 
      src: imageToEdit || '',
      width: element.width,
      height: element.height,
      editState: element.editState,
    });
  };

  const handleImageEditorComplete = (data: { newSrc: string; newOriginalSrc: string; editState: ImageEditState; }) => {
    if (template && editingImage) {
      const { newSrc, newOriginalSrc, editState } = data;
      const updatedElements = template.elements.map(el =>
        el.id === editingImage.id ? { ...el, src: newSrc, originalSrc: newOriginalSrc, editState: editState } : el
      );
      const newTemplate = { ...template, elements: updatedElements };
      setTemplate(newTemplate);
      setEditorKey(prev => prev + 1);
    }
    setEditingImage(null);
  };

  const handleImageEditorCancel = () => {
    setEditingImage(null);
  };

  if (loading || !template) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
            טוען עורך...
        </div>
    );
  }

  return (
    <>
      {editingImage ? (
        <ImageEditor
          imageSrc={editingImage.src}
          elementWidth={editingImage.width}
          elementHeight={editingImage.height}
          onComplete={handleImageEditorComplete}
          onCancel={handleImageEditorCancel}
          initialEditState={editingImage.editState ?? undefined}
        />
      ) : (
        <MagazineEditor
          key={editorKey}
          initialTemplate={template}
          onEditImage={handleEditImage}
          onSaveTemplate={handleSaveTemplate}
        />
      )}
    </>
  );
};

export default EditorPage;