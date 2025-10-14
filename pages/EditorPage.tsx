import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagazineEditor from '../components/editor/MagazineEditor';
import ImageEditor from '../components/editor/ImageEditor';
// Fix: Import `Json` type to correctly type payloads for Supabase.
import type { Template, ImageElement, ImageEditState, CanvasElement, TemplateRow, Json } from '../types';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { ElementType } from '../types';

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

  const [template, setTemplate] = useState<Template | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null); // To track name changes
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
      // No template provided, redirect
      navigate('/templates');
    }
  }, [location.state, navigate]);

  const handleSaveTemplate = async (templateToSave: Template, newPreview: string | undefined) => {
    if (!user || !originalTemplate) return;

    const nameHasChanged = templateToSave.name !== originalTemplate.name;

    // A template is considered "new" and should be inserted if:
    // 1. It's a temporary template created from scratch.
    // 2. It's a fork of another user's template or a public template.
    // 3. The user has changed its name, triggering a "Save As" behavior.
    const isFork = templateToSave.user_id !== user.id;
    const isNew = templateToSave.id.startsWith('new_') || isFork || nameHasChanged;

    const sanitizeForSupabase = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeForSupabase(item));
        }
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (typeof value !== 'undefined') {
                    newObj[key] = sanitizeForSupabase(value);
                } else {
                    newObj[key] = null;
                }
            }
        }
        return newObj;
    };
    
    // "Pack" design data into a single JSON object for storage in `template_data`.
    // Fix: Explicitly type `templateDataToSave` as `Json` to match the expected Supabase type.
    // This resolves TypeScript errors in the `.insert()` and `.update()` calls.
    const templateDataToSave: Json = {
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
        ? await supabase.from('templates').insert({ ...commonData, user_id: user.id, is_public: false }).select()
        : await supabase.from('templates').update(commonData).eq('id', templateToSave.id).select();

      if (error) throw error;

      if (data && data[0]) {
        const savedRow = data[0] as TemplateRow;
        
        // "Unpack" the data from the DB row into the application's Template model.
        // Fix: Cast through `unknown` to fix unsafe type conversion from `Json`.
        const savedTemplateData = savedRow.template_data as unknown as {
            width: number;
            height: number;
            backgroundColor?: string;
            items?: CanvasElement[];
        };
        const sanitizedTemplate: Template = {
            id: savedRow.id,
            name: savedRow.name,
            user_id: savedRow.user_id,
            created_at: savedRow.created_at,
            previewImage: savedRow.previewImage,
            is_public: savedRow.is_public ?? false,
            width: savedTemplateData.width,
            height: savedTemplateData.height,
            background_color: savedTemplateData.backgroundColor || '#1a202c',
            elements: savedTemplateData.items || [],
        };

        // After saving, update the editor's state to reflect the saved version.
        // This prevents the user from being navigated away and allows them to continue editing.
        setTemplate(sanitizedTemplate);
        
        // If it was a "Save As" or fork, the "original" template is now the one just saved.
        if (isNew) {
          setOriginalTemplate(sanitizedTemplate);
        }

        // Re-key the editor to force it to re-render with the latest template data.
        setEditorKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error saving template:', error);
      const errorMessage = error?.message || 'An unexpected error occurred. Check the console for details.';
      alert(`שגיאה בשמירת התבנית: ${errorMessage}`);
    }
  };

  const handleEditImage = (element: ImageElement, currentTemplate: Template, newSrc?: string) => {
    const imageToEdit = newSrc || element.originalSrc || element.src;
    setTemplate(currentTemplate); // Sync state from MagazineEditor before switching views
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