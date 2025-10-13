import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagazineEditor from '../components/editor/MagazineEditor';
import ImageEditor from '../components/editor/ImageEditor';
import type { Template, ImageElement, ImageEditState } from '../types';

interface EditingImageState {
  id: string;
  src: string; // originalSrc
  width: number;
  height: number;
  editState?: ImageEditState;
}

interface LocationState {
    template?: Template;
    templatePath?: string;
}

const EditorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [editingImage, setEditingImage] = useState<EditingImageState | null>(null);

  useEffect(() => {
    const state = location.state as LocationState | null;

    if (state?.template) {
      setTemplate(state.template);
      setLoading(false);
    } else if (state?.templatePath) {
      const fetchTemplate = async () => {
        try {
          setLoading(true);
          const response = await fetch(state.templatePath);
          if (!response.ok) {
            throw new Error('Template not found');
          }
          const data = await response.json();
          setTemplate(data);
        } catch (error) {
          console.error("Failed to load template:", error);
          navigate('/templates'); // Redirect if template fails to load
        } finally {
          setLoading(false);
        }
      };
      fetchTemplate();
    } else {
      // No template or path provided, redirect
      navigate('/templates');
    }
  }, [location.state, navigate]);


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
          initialEditState={editingImage.editState}
        />
      ) : (
        <MagazineEditor
          key={editorKey}
          initialTemplate={template}
          onEditImage={handleEditImage}
        />
      )}
    </>
  );
};

export default EditorPage;