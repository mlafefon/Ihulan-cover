// Fix: Removed circular dependency import. CanvasElement is defined in this file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

// Represents the data structure in the 'templates' table.
// Design-specific data is now consolidated into the `template_data` JSONB column.
// `name` and `previewImage` are kept as top-level columns for efficient querying.
export interface TemplateRow {
  id: string;
  name: string;
  template_data: Json;
  previewImage?: string | null;
  user_id?: string | null;
  created_at?: string;
}

// Represents the template object used within the application. Data is unpacked from `template_data` for use.
export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  background_color: string;
  elements: CanvasElement[];
  previewImage?: string | null;
  user_id?: string | null;
  created_at?: string;
}


export interface Database {
  public: {
    Tables: {
      templates: {
        Row: TemplateRow;
        Insert: Omit<TemplateRow, 'id' | 'created_at'>;
        Update: Partial<Omit<TemplateRow, 'id' | 'created_at' | 'user_id'>>;
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

export enum ElementType {
  Text = 'text',
  Image = 'image',
}

export interface ElementBase {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textShadow: string;
}

export interface TextSpan {
  text: string;
  style: TextStyle;
}

export interface TextElement extends ElementBase {
  type: ElementType.Text;
  spans: TextSpan[];
  textAlign: 'right' | 'center' | 'left';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  backgroundColor: string;
  padding: number;
}

export interface ImageEditState {
    zoom: number;
    offset: { x: number; y: number };
    filters: { brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number };
    colorReplace: { from: string; to: string; tolerance: number; enabled: boolean };
    frame: { thickness: number; style: string; color: string };
    isBlurApplied: boolean;
    hasMask: boolean;
    maskDataUrl?: string | null; // Storing mask as a data URL
}

export interface ImageElement extends ElementBase {
  type: ElementType.Image;
  src: string | null; // This will now be the PROCESSED image for display
  originalSrc: string | null; // This will hold the ORIGINAL uploaded image
  objectFit: 'cover' | 'contain' | 'fill';
  editState?: ImageEditState | null;
}

export type CanvasElement = TextElement | ImageElement;