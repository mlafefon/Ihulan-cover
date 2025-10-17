import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import type { Template, TemplatePreview, TemplateRow, CanvasElement, TextStyle, TextSpan, TextElement, ImageElement, CutterElement } from '../types';
import { ElementType } from '../types';

// State and context type definitions
interface TemplateState {
  myTemplates: TemplatePreview[];
  publicTemplates: TemplatePreview[];
  loading: boolean;
  error: string | null;
  initialLoadComplete: boolean;
}

interface TemplateContextType extends TemplateState {
  upsertTemplate: (template: TemplatePreview, fullTemplate?: Template) => void;
  removeTemplate: (templateId: string) => void;
  fetchFullTemplate: (templateId: string) => Promise<Template | null>;
  getTemplateFromCache: (templateId: string) => Template | undefined;
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

// Helper function to transform a full DB row into a lightweight preview object
const transformRowToTemplatePreview = (row: Pick<TemplateRow, 'id' | 'name' | 'previewImage' | 'user_id' | 'is_public' | 'is_active' | 'created_at'>): TemplatePreview => {
  return {
    id: row.id,
    name: row.name || 'תבנית ללא שם',
    previewImage: row.previewImage,
    user_id: row.user_id,
    is_public: row.is_public ?? false,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
  };
};

// A default style object to ensure all required properties exist on a text style.
const defaultTextStyle: TextStyle = {
    fontFamily: 'Heebo',
    fontSize: 32,
    fontWeight: 400,
    color: '#FFFFFF',
    textShadow: '',
    lineHeight: 1.2,
};

// Helper function to transform a full DB row into a complete Template object for the editor
const transformRowToTemplate = (row: TemplateRow): Template => {
    const data = row.template_data as {
        width?: number;
        height?: number;
        backgroundColor?: string;
        items?: any[];
    } | null;

    const elements = (data?.items || []).map((el: any): CanvasElement | null => {
        if (!el || !el.type) return null;

        const baseElement = {
            id: el.id,
            type: el.type,
            x: el.x ?? 0,
            y: el.y ?? 0,
            width: el.width ?? 100,
            height: el.height ?? 100,
            rotation: el.rotation ?? 0,
            zIndex: el.zIndex ?? 1,
        };

        if (el.type === 'text') {
            const spans = Array.isArray(el.spans) ? el.spans : [];
            let globalLineHeight: number | undefined = el.lineHeight;

            const sanitizedSpans = spans.map((span: any): TextSpan => {
                const existingStyle = (span.style && typeof span.style === 'object') ? span.style : {};
                const newStyle: TextStyle = { ...defaultTextStyle, ...existingStyle };
                if (globalLineHeight !== undefined) {
                    newStyle.lineHeight = existingStyle.lineHeight ?? globalLineHeight;
                }
                return {
                    text: typeof span.text === 'string' ? span.text : '',
                    style: newStyle,
                };
            });
            if (sanitizedSpans.length === 0) {
                sanitizedSpans.push({ text: '', style: defaultTextStyle });
            }

            const textElement: TextElement = {
                ...baseElement,
                type: ElementType.Text,
                spans: sanitizedSpans,
                textAlign: el.textAlign ?? 'right',
                verticalAlign: el.verticalAlign ?? 'middle',
                letterSpacing: el.letterSpacing ?? 0,
                backgroundColor: el.backgroundColor ?? 'transparent',
                padding: el.padding ?? 10,
                backgroundShape: el.backgroundShape ?? 'rectangle',
                outline: {
                    enabled: el.outline?.enabled ?? false,
                    color: el.outline?.color ?? '#FFFFFF',
                    width: el.outline?.width ?? 2,
                },
            };
            return textElement;
        }

        if (el.type === 'image') {
            const imageElement: ImageElement = {
                ...baseElement,
                type: ElementType.Image,
                src: el.src ?? null,
                originalSrc: el.originalSrc ?? el.src ?? null,
                objectFit: el.objectFit ?? 'cover',
                editState: el.editState ?? null,
            };
            return imageElement;
        }

        if (el.type === 'cutter') {
            const cutterElement: CutterElement = {
                ...baseElement,
                type: ElementType.Cutter,
            };
            return cutterElement;
        }

        return null;
    }).filter((el): el is CanvasElement => el !== null);

    return {
        id: row.id,
        name: row.name || 'תבנית ללא שם',
        previewImage: row.previewImage,
        user_id: row.user_id,
        is_public: row.is_public ?? false,
        is_active: row.is_active ?? true,
        created_at: row.created_at,
        width: data?.width || 800,
        height: data?.height || 1000,
        background_color: data?.backgroundColor || '#1a202c',
        elements: elements,
    };
};


export const TemplateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<TemplateState>({
    myTemplates: [],
    publicTemplates: [],
    loading: true,
    error: null,
    initialLoadComplete: false,
  });
  const [fullTemplateCache, setFullTemplateCache] = useState<Record<string, Template>>({});

  useEffect(() => {
    // Fetch all templates (full data) once after user logs in.
    if (user && !state.initialLoadComplete) {
      const fetchTemplates = async () => {
        setState(s => ({ ...s, loading: true, error: null }));
        try {
          // Fetch full data for user's templates
          const { data: myData, error: myError } = await supabase
            .from('templates')
            .select('*') // Fetch all data
            .eq('user_id', user.id)
            .eq('is_active', true)
            .eq('is_public', false)
            .order('created_at', { ascending: false });

          if (myError) throw myError;

          // Fetch full data for public templates
          const { data: publicData, error: publicError } = await supabase
            .from('templates')
            .select('*') // Fetch all data
            .eq('is_public', true)
            .eq('is_active', true);

          if (publicError) throw publicError;
          
          const myTemplateRows = (myData as TemplateRow[]) || [];
          const publicTemplateRows = (publicData as TemplateRow[]) || [];

          const myFullTemplates = myTemplateRows.map(transformRowToTemplate);
          const publicFullTemplates = publicTemplateRows.map(transformRowToTemplate);

          const newCache: Record<string, Template> = {};
          myFullTemplates.forEach(t => { newCache[t.id] = t; });
          publicFullTemplates.forEach(t => { newCache[t.id] = t; });
          
          setFullTemplateCache(newCache);
          
          setState({
            myTemplates: myTemplateRows.map(transformRowToTemplatePreview),
            publicTemplates: publicTemplateRows.map(transformRowToTemplatePreview),
            loading: false,
            error: null,
            initialLoadComplete: true,
          });
        } catch (e: any) {
          console.error("Failed to fetch templates in context:", e);
          setState(s => ({ ...s, loading: false, error: 'לא ניתן לטעון את התבניות. נסה שוב מאוחר יותר.' }));
        }
      };
      fetchTemplates();
    } else if (!user) {
        // Reset state on logout to ensure fresh data for the next user.
        setState({
            myTemplates: [],
            publicTemplates: [],
            loading: false,
            error: null,
            initialLoadComplete: false,
        });
        setFullTemplateCache({}); // Clear the cache on logout
    }
  }, [user, state.initialLoadComplete]);

  // Adds a new template or updates an existing one in the state.
  const upsertTemplate = useCallback((template: TemplatePreview, fullTemplate?: Template) => {
    setState(prevState => {
      // We only manage 'myTemplates' here, as users can't save public templates.
      const existingIndex = prevState.myTemplates.findIndex(t => t.id === template.id);
      let newMyTemplates;
      if (existingIndex > -1) {
        // Update existing template in place.
        newMyTemplates = [...prevState.myTemplates];
        newMyTemplates[existingIndex] = template;
      } else {
        // Add new template to the beginning of the list.
        newMyTemplates = [template, ...prevState.myTemplates];
      }
      return { ...prevState, myTemplates: newMyTemplates };
    });

    // If the full template data is provided (e.g., after a save), update the cache.
    if (fullTemplate) {
      setFullTemplateCache(prevCache => ({
        ...prevCache,
        [fullTemplate.id]: fullTemplate,
      }));
    }
  }, []);

  // Removes a template from the state, used after a successful soft-delete.
  const removeTemplate = useCallback((templateId: string) => {
    setState(prevState => ({
      ...prevState,
      myTemplates: prevState.myTemplates.filter(t => t.id !== templateId),
    }));
    // Also remove from the full template cache
    setFullTemplateCache(prevCache => {
      const newCache = { ...prevCache };
      delete newCache[templateId];
      return newCache;
    });
  }, []);
  
  const getTemplateFromCache = useCallback((templateId: string): Template | undefined => {
    return fullTemplateCache[templateId];
  }, [fullTemplateCache]);

  // Fetches the full data for a single template, using a cache to avoid redundant network calls.
  const fetchFullTemplate = useCallback(async (templateId: string): Promise<Template | null> => {
    // 1. Check cache first
    const cachedTemplate = getTemplateFromCache(templateId);
    if (cachedTemplate) {
      return cachedTemplate;
    }
    
    // 2. If not in cache, fetch from Supabase
    try {
        const { data: row, error } = await supabase
            .from('templates')
            .select('*')
            .eq('id', templateId)
            .single();
        if (error) throw error;

        if (row) {
          const fullTemplate = transformRowToTemplate(row as TemplateRow);
          // 3. Add to cache for future requests
          setFullTemplateCache(prevCache => ({
            ...prevCache,
            [templateId]: fullTemplate,
          }));
          return fullTemplate;
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch full template in context:", e);
        return null;
    }
  }, [getTemplateFromCache]);

  const value = { ...state, upsertTemplate, removeTemplate, fetchFullTemplate, getTemplateFromCache };

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
};

// Custom hook to consume the template context.
export const useTemplates = () => {
  const context = useContext(TemplateContext);
  if (context === undefined) {
    throw new Error('useTemplates must be used within a TemplateProvider');
  }
  return context;
};