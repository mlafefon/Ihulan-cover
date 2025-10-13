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
    maskDataUrl?: string; // Storing mask as a data URL
}

export interface ImageElement extends ElementBase {
  type: ElementType.Image;
  src: string | null; // This will now be the PROCESSED image for display
  originalSrc: string | null; // This will hold the ORIGINAL uploaded image
  objectFit: 'cover' | 'contain' | 'fill';
  editState?: ImageEditState;
}

export type CanvasElement = TextElement | ImageElement;

export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  elements: CanvasElement[];
  previewImage?: string;
}

export interface TemplateMetaData {
  id: string;
  name: string;
  path: string;
  previewImage?: string;
}