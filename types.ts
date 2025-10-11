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

export interface ImageElement extends ElementBase {
  type: ElementType.Image;
  src: string | null;
  objectFit: 'cover' | 'contain' | 'fill';
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
