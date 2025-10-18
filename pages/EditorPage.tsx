import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagazineEditor, { MagazineEditorHandle } from '../components/editor/MagazineEditor';
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
  const editorRef = useRef<MagazineEditorHandle>(null);
  
  const [initialTemplateData, setInitialTemplateData] = useState<Template | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingImage, setEditingImage] = useState<EditingImageState | null>(null);

  useEffect(() => {
    const state = location.state as LocationState | null;

    if (state?.template) {
      setInitialTemplateData(state.template);
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

        // This is the fix: Update the "base" templates after save.
        // `initialTemplateData` is passed as a prop to the editor. When it changes,
        // the editor's `isDirty` flag will be re-evaluated and turn false, removing the red ring.
        setInitialTemplateData(sanitizedTemplate);
        // `originalTemplate` is used to determine if a "Save As" operation is needed (e.g., on rename).
        // It must also be updated to prevent incorrect "Save As" on subsequent saves.
        setOriginalTemplate(sanitizedTemplate);
        
        // If it was a "Save As", we also need to update the template state inside the editor
        // to reflect the new template ID, so that future saves update the new record instead of the old one.
        // This will add a new state to the history, which is acceptable for a "Save As".
        if (isNew) {
          editorRef.current?.updateTemplateFromParent(sanitizedTemplate);
        }
      }
    } catch (error: any) {
      console.error('Error saving template:', error);
      const errorMessage = error?.message || 'An unexpected error occurred.';
      alert(`שגיאה בשמירת התבנית: ${errorMessage}`);
    }
  };

  const handleEditImageRequest = (element: ImageElement, newSrc?: string) => {
    const imageToEdit = newSrc || element.originalSrc || element.src;
    setEditingImage({ 
      id: element.id, 
      src: imageToEdit || '',
      width: element.width,
      height: element.height,
      editState: element.editState,
    });
  };

  const handleImageEditorComplete = (data: { newSrc: string; newOriginalSrc: string; editState: ImageEditState; }) => {
    if (editorRef.current && editingImage) {
        editorRef.current.applyImageEdit(editingImage.id, data);
    }
    setEditingImage(null);
  };

  const handleImageEditorCancel = () => {
    setEditingImage(null);
  };

  if (loading || !initialTemplateData) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
            טוען עורך...
        </div>
    );
  }

  return (
    <>
      <MagazineEditor
        ref={editorRef}
        initialTemplate={initialTemplateData}
        onEditImage={handleEditImageRequest}
        onSaveTemplate={handleSaveTemplate}
      />
      {editingImage && (
        <ImageEditor
          imageSrc={editingImage.src}
          elementWidth={editingImage.width}
          elementHeight={editingImage.height}
          onComplete={handleImageEditorComplete}
          onCancel={handleImageEditorCancel}
          initialEditState={editingImage.editState ?? undefined}
        />
      )}
    </>
  );
};

export default EditorPage;
