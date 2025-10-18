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
  // Fix: Allowed `name` and `template_data` to be nullable to match the database schema.
  // An incorrect Row type can cause Supabase client to infer `never` for insert/update payloads.
  name: string | null;
  template_data: Json | null;
  previewImage?: string | null;
  user_id?: string | null;
  is_public?: boolean;
  is_active?: boolean;
  created_at?: string;
}

// Represents the lightweight template object for the gallery page, without heavy design data.
export interface TemplatePreview {
  id: string;
  name: string;
  previewImage?: string | null;
  user_id?: string | null;
  is_public?: boolean;
  is_active?: boolean;
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
  is_public?: boolean;
  is_active?: boolean;
  created_at?: string;
}


export interface Database {
  public: {
    Tables: {
      templates: {
        Row: TemplateRow;
        // Fix: Replaced Omit utility type with an explicit definition to resolve Supabase client type inference errors.
        Insert: {
          // Fix: Made `name` and `template_data` optional and nullable to match the database schema and resolve `never` type errors.
          name?: string | null;
          // Fix: Reverted type to `Json` to resolve Supabase client type inference errors.
          template_data?: Json | null;
          previewImage?: string | null;
          user_id?: string | null;
          is_public?: boolean;
          is_active?: boolean;
        };
        // Fix: Replaced Partial<Omit<...>> utility types with an explicit definition to resolve Supabase client type inference errors.
        Update: {
          // Fix: Allowed `null` for `name` and `template_data` to match the database schema and resolve `never` type errors.
          name?: string | null;
          // Fix: Reverted type to `Json` to resolve Supabase client type inference errors.
          template_data?: Json | null;
          previewImage?: string | null;
          is_public?: boolean;
          is_active?: boolean;
        };
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
  Cutter = 'cutter',
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
  lineHeight: number;
}

export interface TextSpan {
  text: string;
  style: TextStyle;
}

export interface TextElement extends ElementBase {
  type: ElementType.Text;
  spans: TextSpan[];
  textAlign: 'right' | 'center' | 'left' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  letterSpacing: number;
  backgroundColor: string;
  padding: number;
  backgroundShape?: 'rectangle' | 'rounded' | 'ellipse' | 'sun';
  outline?: {
    color: string;
    width: number;
    enabled: boolean;
  };
}

export interface ImageEditState {
    zoom: number;
    offset: { x: number; y: number };
    filters: { brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number };
    colorReplace: { from: string[]; to: string; tolerance: number; enabled: boolean };
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

export interface CutterElement extends ElementBase {
    type: ElementType.Cutter;
}

export type CanvasElement = TextElement | ImageElement | CutterElement;