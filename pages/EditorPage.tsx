import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MagazineEditor from '../components/editor/MagazineEditor';
import ImageEditor from '../components/editor/ImageEditor';
import type { Template, ImageElement } from '../types';

interface EditingImageState {
  id: string;
  src: string;
  width: number;
  height: number;
}

const EditorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialTemplate = (): Template | null => {
    const state = location.state as { template: Template };
    return state?.template || null;
  };

  const [template, setTemplate] = useState<Template | null>(getInitialTemplate);
  const [editorKey, setEditorKey] = useState(0);
  const [editingImage, setEditingImage] = useState<EditingImageState | null>(null);

  React.useEffect(() => {
    if (!template) {
      navigate('/templates');
    }
  }, [template, navigate]);

  const handleEditImage = (element: ImageElement) => {
    if (element.src) {
      setEditingImage({ 
        id: element.id, 
        src: element.src,
        width: element.width,
        height: element.height,
      });
    }
  };

  const handleImageEditorComplete = (newSrc: string) => {
    if (template && editingImage) {
      const updatedElements = template.elements.map(el =>
        el.id === editingImage.id ? { ...el, src: newSrc } : el
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

  if (!template) {
    return null; // Or a loading spinner while redirecting
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