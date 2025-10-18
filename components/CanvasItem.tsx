import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { CanvasElement, TextElement, ImageElement, TextSpan, TextStyle, CutterElement } from '../types';
import { ElementType } from '../types';
import { ImageIcon } from './Icons';

interface CanvasItemProps {
    element: CanvasElement;
    isSelected: boolean;
    isCutterTarget?: boolean;
    onSelect: () => void;
    onUpdate: (id: string, updates: Partial<CanvasElement> & { textContent?: string }, withHistory?: boolean, cursorPos?: { start: number; end: number }) => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
    onTextSelect: (range: { start: number, end: number } | null) => void;
    onElementRefsChange: (id: string, refs: { content?: HTMLDivElement | null; wrapper?: HTMLDivElement | null; }) => void;
    onEditImage: (element: ImageElement, newSrc?: string) => void;
    canvasWidth: number;
    canvasHeight: number;
    otherElements: CanvasElement[];
    setSnapLines: (lines: { x: number[], y: number[] }) => void;
    activeStyle: TextStyle | null;
}

const handlePositionClasses: { [key: string]: string } = {
    tl: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
    t: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    tr: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
    l: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
    r: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
    bl: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
    b: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    br: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
};

const handleCursorClasses: { [key: string]: string } = {
    tl: 'cursor-nwse-resize',
    br: 'cursor-nwse-resize',
    tr: 'cursor-nesw-resize',
    bl: 'cursor-nesw-resize',
    t: 'cursor-ns-resize',
    b: 'cursor-ns-resize',
    l: 'cursor-ew-resize',
    r: 'cursor-ew-resize',
};

const rotateCursorUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDJ2NmgtNiIvPjxwYXRoIGQ9Ik0zIDEyYTkgOSAwIDAgMSAxNS02LjdMMjEgOCIvPjwvc3ZnPg==";

const getSunClipPath = () => {
    const points = [];
    const numRays = 10;
    const outerRadius = 50; 
    const innerRadius = 40; 
    const centerX = 50;
    const centerY = 50;

    for (let i = 0; i < numRays * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / numRays - (Math.PI / 2); 
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
    return `polygon(${points.join(', ')})`;
};

// A default style object to ensure all required properties exist on a text style.
export const defaultTextStyle: TextStyle = {
    fontFamily: 'Heebo',
    fontSize: 32,
    fontWeight: 400,
    color: '#FFFFFF',
    textShadow: '',
    lineHeight: 1.2,
};


const CanvasItem: React.FC<CanvasItemProps> = ({ element, isSelected, onSelect, onUpdate, onInteractionEnd, onTextSelect, onElementRefsChange, onEditImage, canvasWidth, canvasHeight, otherElements, setSnapLines, onInteractionStart, isCutterTarget, activeStyle }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const textContentRef = useRef<HTMLDivElement>(null);
    const textWrapperRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string; }>({ visible: false, x: 0, y: 0, text: '' });
    const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);


    useEffect(() => {
        if (element.type === ElementType.Text) {
            onElementRefsChange(element.id, { 
                content: textContentRef.current,
                wrapper: textWrapperRef.current
            });
        }
        return () => {
             if (element.type === ElementType.Text) {
                onElementRefsChange(element.id, { content: null, wrapper: null });
             }
        }
    }, [element.id, element.type, onElementRefsChange]);
    
    useEffect(() => {
        if (isSelected && element.type === ElementType.Text) {
            const handleSelectionChange = () => {
                const selection = document.getSelection();
                const itemNode = textContentRef.current;
                
                if (selection && itemNode && selection.rangeCount > 0 && selection.containsNode(itemNode, true)) {
                    // Update character offset range for styling logic
                    const offsets = getSelectionCharOffsetsWithin(itemNode);
                    onTextSelect(offsets);

                    // Update visual selection overlays
                    if (selection.isCollapsed) {
                        setSelectionRects([]);
                    } else {
                        const textElement = element as TextElement;
                        
                        // Fallback to the first span's style if activeStyle is not available, which can happen during initial selection.
                        const styleForMetrics = activeStyle || textElement.spans[0]?.style || defaultTextStyle;
                        
                        const range = selection.getRangeAt(0);
                        const wrapperNode = textWrapperRef.current;
                        if (!wrapperNode) return;
    
                        const wrapperRect = wrapperNode.getBoundingClientRect();
                        const clientRects = Array.from(range.getClientRects());
                        
                        const rotationRad = (textElement.rotation * Math.PI) / 180;
                        const cos = Math.abs(Math.cos(rotationRad));
                        const sin = Math.abs(Math.sin(rotationRad));
    
                        const newSelectionRects = clientRects.map(rect => {
                            // 1. Calculate true height (h_local)
                            const h_local = styleForMetrics.fontSize * styleForMetrics.lineHeight;
    
                            // 2. Calculate true width (w_local) using the more stable formula
                            let w_local: number;
                            if (cos >= sin) { // More horizontal rotation
                                w_local = cos > 1e-6 ? (rect.width - h_local * sin) / cos : 0;
                            } else { // More vertical rotation
                                w_local = sin > 1e-6 ? (rect.height - h_local * cos) / sin : 0;
                            }
                            
                            // 3. Find center of ClientRect in viewport space
                            const viewportCenterX = rect.left + rect.width / 2;
                            const viewportCenterY = rect.top + rect.height / 2;
    
                            // 4. Transform viewport center into the wrapper's local (un-rotated) space
                            const rotatedBoundingBoxCenterX = wrapperRect.left + wrapperRect.width / 2;
                            const rotatedBoundingBoxCenterY = wrapperRect.top + wrapperRect.height / 2;
                            
                            let dx = viewportCenterX - rotatedBoundingBoxCenterX;
                            let dy = viewportCenterY - rotatedBoundingBoxCenterY;
    
                            // Apply inverse rotation to get vector from un-rotated center
                            const invRotationRad = -rotationRad;
                            const cos_inv = Math.cos(invRotationRad);
                            const sin_inv = Math.sin(invRotationRad);
                            
                            const local_dx = dx * cos_inv - dy * sin_inv;
                            const local_dy = dx * sin_inv + dy * cos_inv;
                            
                            // 5. Calculate the top-left of the overlay relative to the un-rotated element's center
                            const unrotatedCenterX = textElement.width / 2;
                            const unrotatedCenterY = textElement.height / 2;
                            
                            const local_top = unrotatedCenterY + local_dy - h_local / 2;
                            const local_left = unrotatedCenterX + local_dx - w_local / 2;
    
                            // Return a new DOMRect with local coordinates and dimensions
                            return new DOMRect(local_left, local_top, w_local, h_local);
                        });
                        
                        setSelectionRects(newSelectionRects);
                    }
                } else {
                    // Selection is outside the element or cleared
                    onTextSelect(null);
                    setSelectionRects([]);
                }
            };

            document.addEventListener('selectionchange', handleSelectionChange);
            handleSelectionChange(); // Initial check

            return () => {
                document.removeEventListener('selectionchange', handleSelectionChange);
            };
        } else {
            // Cleanup when element is deselected or not a text element
            onTextSelect(null);
            setSelectionRects([]);
        }
    }, [isSelected, element, activeStyle, onTextSelect]);


    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isSelected && element.type === ElementType.Text) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const textElement = element as TextElement;
                const fullText = textElement.spans.map(s => s.text).join('');
                const { start, end } = getSelectionCharOffsetsWithin(e.currentTarget);
                const newFullText = fullText.substring(0, start) + '\n' + fullText.substring(end);
                const newCursorPos = { start: start + 1, end: start + 1 };
                onUpdate(element.id, { textContent: newFullText }, true, newCursorPos);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                const textElement = element as TextElement;
                const fullText = textElement.spans.map(s => s.text).join('');
                const selection = getSelectionCharOffsetsWithin(e.currentTarget);

                // Fix: Intercept deletion of any selected text range to prevent a browser bug
                // that could otherwise delete the entire application DOM.
                if (selection.start !== selection.end) {
                    e.preventDefault();
                    const newFullText = fullText.substring(0, selection.start) + fullText.substring(selection.end);
                    const newCursorPos = { start: selection.start, end: selection.start };
                    onUpdate(element.id, { textContent: newFullText }, true, newCursorPos);
                }
            }
        }
    };

    const handleDoubleClick = () => {
        if (element.type !== ElementType.Image) return;
        const imageElement = element as ImageElement;
        if (imageElement.src) {
            onEditImage(imageElement);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (element.type !== ElementType.Image) return;
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const newSrc = event.target?.result as string;
                if (newSrc) {
                    onEditImage(element as ImageElement, newSrc);
                }
            };
            reader.readAsDataURL(file);
        }
        if (e.target) e.target.value = '';
    };


    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (element.type === ElementType.Text) {
            if (textContentRef.current && textContentRef.current.contains(e.target as Node)) {
                e.stopPropagation();
                onSelect();
                return;
            }
        }

        e.preventDefault();
        e.stopPropagation();
        onSelect();
        onInteractionStart();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startElX = element.x;
        const startElY = element.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            let newX = startElX + dx;
            let newY = startElY + dy;
            
            if (element.type !== ElementType.Cutter) {
                const SNAP_THRESHOLD = 5;
                const currentElementPoints = {
                    left: newX,
                    right: newX + element.width,
                    top: newY,
                    bottom: newY + element.height,
                    hCenter: newX + element.width / 2,
                    vCenter: newY + element.height / 2,
                };

                const snapTargetsX = [0, canvasWidth / 2, canvasWidth];
                const snapTargetsY = [0, canvasHeight / 2, canvasHeight];
                
                const activeSnapLines: { x: number[], y: number[] } = { x: [], y: [] };

                for (const targetX of snapTargetsX) {
                    if (Math.abs(currentElementPoints.left - targetX) < SNAP_THRESHOLD) { newX = targetX; activeSnapLines.x.push(targetX); break; }
                    if (Math.abs(currentElementPoints.hCenter - targetX) < SNAP_THRESHOLD) { newX = targetX - element.width / 2; activeSnapLines.x.push(targetX); break; }
                    if (Math.abs(currentElementPoints.right - targetX) < SNAP_THRESHOLD) { newX = targetX - element.width; activeSnapLines.x.push(targetX); break; }
                }
                for (const targetY of snapTargetsY) {
                    if (Math.abs(currentElementPoints.top - targetY) < SNAP_THRESHOLD) { newY = targetY; activeSnapLines.y.push(targetY); break; }
                    if (Math.abs(currentElementPoints.vCenter - targetY) < SNAP_THRESHOLD) { newY = targetY - element.height / 2; activeSnapLines.y.push(targetY); break; }
                    if (Math.abs(currentElementPoints.bottom - targetY) < SNAP_THRESHOLD) { newY = targetY - element.height; activeSnapLines.y.push(targetY); break; }
                }

                setSnapLines(activeSnapLines);
            } else {
                 setSnapLines({ x: [], y: [] });
            }
            onUpdate(element.id, { x: newX, y: newY }, false);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            onInteractionEnd();
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResize = (e: React.MouseEvent, corner: string) => {
        e.preventDefault();
        e.stopPropagation();
        onInteractionStart();
    
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
    
        const { x, y, width, height, rotation } = element;
        
        const centerX = x + width / 2;
        const centerY = y + height / 2;
    
        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
    
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const currentMouseX = moveEvent.clientX;
            const currentMouseY = moveEvent.clientY;
            
            const dx = currentMouseX - startMouseX;
            const dy = currentMouseY - startMouseY;
            
            const negRad = -rad;
            const cosNeg = Math.cos(negRad);
            const sinNeg = Math.sin(negRad);
            const localDx = dx * cosNeg - dy * sinNeg;
            const localDy = dx * sinNeg + dy * cosNeg;
    
            let newWidth = width;
            let newHeight = height;
    
            const isMovingRight = corner.includes('r');
            const isMovingLeft = corner.includes('l');
            const isMovingBottom = corner.includes('b');
            const isMovingTop = corner.includes('t');
    
            if (isMovingRight) newWidth = width + localDx;
            if (isMovingLeft) newWidth = width - localDx;
            if (isMovingBottom) newHeight = height + localDy;
            if (isMovingTop) newHeight = height - localDy;
            
            if (newWidth > 10 && newHeight > 10) {
                const dw = newWidth - width;
                const dh = newHeight - height;
    
                let shiftLocalX = 0;
                if (isMovingLeft) shiftLocalX = -dw / 2;
                if (isMovingRight) shiftLocalX = dw / 2;
    
                let shiftLocalY = 0;
                if (isMovingTop) shiftLocalY = -dh / 2;
                if (isMovingBottom) shiftLocalY = dh / 2;
    
                const shiftWorldX = shiftLocalX * cos - shiftLocalY * sin;
                const shiftWorldY = shiftLocalX * sin + shiftLocalY * cos;
    
                const newCenterX = centerX + shiftWorldX;
                const newCenterY = centerY + shiftWorldY;
    
                let newX = newCenterX - newWidth / 2;
                let newY = newCenterY - newHeight / 2;
 
                if (element.type !== ElementType.Cutter) {
                    const SNAP_THRESHOLD = 5;
                    const snapTargetsX = [0, canvasWidth / 2, canvasWidth];
                    const snapTargetsY = [0, canvasHeight / 2, canvasHeight];
                    const activeSnapLines: { x: number[], y: number[] } = { x: [], y: [] };

                    const elementPoints = {
                        left: newX, right: newX + newWidth, top: newY, bottom: newY + newHeight,
                        hCenter: newX + newWidth / 2, vCenter: newY + newHeight / 2,
                    };
                    
                    for (const target of snapTargetsX) {
                        if (Math.abs(elementPoints.left - target) < SNAP_THRESHOLD) { newX = target; activeSnapLines.x.push(target); break; }
                        if (Math.abs(elementPoints.hCenter - target) < SNAP_THRESHOLD) { newX = target - newWidth / 2; activeSnapLines.x.push(target); break; }
                        if (Math.abs(elementPoints.right - target) < SNAP_THRESHOLD) { newX = target - newWidth; activeSnapLines.x.push(target); break; }
                    }
                    for (const target of snapTargetsY) {
                        if (Math.abs(elementPoints.top - target) < SNAP_THRESHOLD) { newY = target; activeSnapLines.y.push(target); break; }
                        if (Math.abs(elementPoints.vCenter - target) < SNAP_THRESHOLD) { newY = target - newHeight / 2; activeSnapLines.y.push(target); break; }
                        if (Math.abs(elementPoints.bottom - target) < SNAP_THRESHOLD) { newY = target - newHeight; activeSnapLines.y.push(target); break; }
                    }
                    setSnapLines(activeSnapLines);
                } else {
                    setSnapLines({ x: [], y: [] });
                }
    
                onUpdate(element.id, { width: newWidth, height: newHeight, x: newX, y: newY }, false);
            }
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            onInteractionEnd();
        };
    
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleRotate = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onInteractionStart();
        setIsRotating(true);
    
        const el = itemRef.current!;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const startRotation = element.rotation;
    
        document.body.style.cursor = `url('${rotateCursorUrl}') 12 12, auto`;
    
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
            const angleDiff = (angle - startAngle) * (180 / Math.PI);
            const newRotation = startRotation + angleDiff;

            let finalRotation = newRotation;
            if (element.type !== ElementType.Cutter) {
                const SNAP_ANGLE = 5;
                finalRotation = Math.round(newRotation / SNAP_ANGLE) * SNAP_ANGLE;
            }
            
            onUpdate(element.id, { rotation: finalRotation }, false);
            
            setTooltip({
                visible: true,
                x: moveEvent.clientX,
                y: moveEvent.clientY,
                text: `${Math.round(finalRotation)}°`
            });
        };
    
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            onInteractionEnd();
            setTooltip({ visible: false, x: 0, y: 0, text: '' });
            document.body.style.cursor = '';
            setIsRotating(false);
        };
    
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };
    
    const verticalAlignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
    
    const dragBorderWidth = 3;
    const itemStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${element.y}px`,
        left: `${element.x}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `rotate(${element.rotation}deg)`,
        zIndex: element.zIndex,
        cursor: isRotating ? `url('${rotateCursorUrl}') 12 12, auto` : 'move',
        boxSizing: 'border-box',
    };
    
    if (element.type === ElementType.Text) {
        itemStyle.padding = `${dragBorderWidth}px`;
    }

    const renderElement = () => {
        switch (element.type) {
            case ElementType.Text:
                const textElement = element as TextElement;
                const backgroundShape = textElement.backgroundShape || 'rectangle';
                const outline = textElement.outline || { enabled: false, width: 0, color: '#FFFFFF' };
                
                const wrapperStyle: React.CSSProperties = {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: verticalAlignMap[textElement.verticalAlign],
                    backgroundColor: textElement.backgroundColor,
                    overflow: 'hidden',
                    position: 'relative',
                };

                if (backgroundShape === 'rounded') {
                    wrapperStyle.borderRadius = '25px';
                } else if (backgroundShape === 'ellipse') {
                    wrapperStyle.borderRadius = '50%';
                } else if (backgroundShape === 'sun') {
                    wrapperStyle.clipPath = getSunClipPath();
                }

                if (outline.enabled && outline.width > 0) {
                    wrapperStyle.border = `${outline.width}px solid ${outline.color}`;
                }

                const firstSpanStyle = textElement.spans[0]?.style;
                const editableStyle: React.CSSProperties = {
                    outline: 'none',
                    padding: `${textElement.padding}px`,
                    letterSpacing: `${textElement.letterSpacing}px`,
                    textAlign: textElement.textAlign,
                    userSelect: 'text',
                    cursor: 'text',
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                    zIndex: 1,
                    // Fallback styles to prevent unstyled text on new lines
                    ...(firstSpanStyle && {
                        fontFamily: firstSpanStyle.fontFamily,
                        fontSize: `${firstSpanStyle.fontSize}px`,
                        fontWeight: firstSpanStyle.fontWeight,
                        color: firstSpanStyle.color,
                        textShadow: firstSpanStyle.textShadow,
                        lineHeight: firstSpanStyle.lineHeight || 1.2,
                    }),
                };
                
                return (
                    <div ref={textWrapperRef} style={wrapperStyle}>
                         {isSelected && selectionRects.map((rect, i) => {
                            const visualHeight = rect.height * 0.7;
                            const visualTop = rect.y + (rect.height * (1 - 0.7) / 2);
                            return (
                                <div
                                    key={`selection-rect-${i}`}
                                    style={{
                                        position: 'absolute',
                                        top: `${visualTop}px`,
                                        left: `${rect.x}px`,
                                        width: `${rect.width}px`,
                                        height: `${visualHeight}px`,
                                        backgroundColor: '#64748b',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                    }}
                                />
                            );
                         })}
                        <div 
                            ref={textContentRef} 
                            style={editableStyle}
                            className={isSelected ? 'has-custom-selection' : ''}
                            contentEditable={isSelected}
                            suppressContentEditableWarning={true}
                            dir="auto"
                            onKeyDown={handleKeyDown}
                            onInput={(e) => {
                                const newText = e.currentTarget.innerText;
                                const currentText = textElement.spans.map(s => s.text).join('');
                                if (newText !== currentText) {
                                    const cursorPos = getSelectionCharOffsetsWithin(e.currentTarget);
                                    onUpdate(element.id, { textContent: newText }, true, cursorPos);
                                }
                            }}
                        >
                            {textElement.spans.map((span, index) => (
                                <span key={index} style={{
                                    fontFamily: span.style.fontFamily,
                                    fontSize: `${span.style.fontSize}px`,
                                    fontWeight: span.style.fontWeight,
                                    color: span.style.color,
                                    textShadow: span.style.textShadow,
                                    lineHeight: span.style.lineHeight || 1.2,
                                }}>
                                    {span.text}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            case ElementType.Image:
                const imageElement = element as ImageElement;
                return (
                    <>
                        {imageElement.src ? (
                            <img src={imageElement.src} alt="Uploaded content" className="w-full h-full pointer-events-none" style={{objectFit: imageElement.objectFit}} />
                        ) : (
                            <div className="w-full h-full border-2 border-dashed border-gray-400 bg-gray-700 flex flex-col items-center justify-center text-center text-gray-300 pointer-events-none">
                                <ImageIcon className="w-8 h-8 mb-2" />
                                <span>הוסף תמונה</span>
                            </div>
                        )}
                    </>
                );
            case ElementType.Cutter:
                return (
                    <div
                        className="w-full h-full bg-red-500/30 border-2 border-dashed border-red-500 pointer-events-none flex items-center justify-center text-center p-4"
                        style={{ borderRadius: '50%' }}
                    >
                        <span className="text-white text-sm">
                            מקם את הצורה כדי ליצור אזור שקוף בתמונה או בטקסט שמתחתיה.
                        </span>
                    </div>
                );
            default:
                return null;
        }
    }
    
    const handles = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
    
    const renderTooltip = () => {
        if (!tooltip.visible) return null;

        return ReactDOM.createPortal(
            <div
                style={{
                    position: 'fixed',
                    top: `${tooltip.y}px`,
                    left: `${tooltip.x}px`,
                    transform: 'translate(15px, -25px)',
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 10000,
                    whiteSpace: 'nowrap',
                }}
            >
                {tooltip.text}
            </div>,
            document.body
        );
    };

    return (
        <>
            {renderTooltip()}
            <div
                ref={itemRef}
                style={itemStyle}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                data-element-id={element.id}
            >
                {element.type === ElementType.Image && (
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                )}
                
                {renderElement()}

                {isCutterTarget && (
                    <div className="absolute inset-0 border-2 border-dashed border-white pointer-events-none" />
                )}
                {isSelected && (
                    <div 
                        className="absolute inset-0 border-2 border-blue-500 pointer-events-none"
                        style={element.type === ElementType.Cutter ? { borderRadius: '50%' } : {}}
                    />
                )}
                {isHovered && !isSelected && (
                    <div className="absolute inset-0 border-2 border-dashed border-slate-400 pointer-events-none" />
                )}
                {isSelected && (
                    <>
                        {handles.map(handle => (
                        <div
                                key={handle}
                                onMouseDown={(e) => handleResize(e, handle)}
                                style={isRotating ? { cursor: `url('${rotateCursorUrl}') 12 12, auto` } : {}}
                                className={`absolute bg-blue-500 border-2 border-white rounded-full w-3 h-3 z-50 ${handlePositionClasses[handle]} ${handleCursorClasses[handle]}`}
                            />
                        ))}
                        <div
                            onMouseDown={handleRotate}
                            style={{ cursor: `url('${rotateCursorUrl}') 12 12, auto` }}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full z-50
                                        before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:top-full before:w-0.5 before:h-4 before:bg-blue-500"
                        />
                    </>
                )}
            </div>
        </>
    );
};

// --- Rich Text Utility Functions ---

export function getSelectionCharOffsetsWithin(element: HTMLElement) {
    let start = 0;
    let end = 0;
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        if (element.contains(range.commonAncestorContainer)) {
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            start = preCaretRange.toString().length;
            
            end = start + range.toString().length;
        } else {
            // Fallback: if selection is not in the element (e.g. element lost focus),
            // place cursor at the end.
            start = end = element.innerText.length;
        }
    }
    return { start, end };
}

export function setSelectionByOffset(containerEl: HTMLElement, start: number, end: number) {
    const sel = window.getSelection();
    if (!sel) return;
  
    let startNode: Node | null = null, startOffset = 0;
    let endNode: Node | null = null, endOffset = 0;
  
    const nodeIterator = document.createNodeIterator(containerEl, NodeFilter.SHOW_TEXT);
    let currentNode: Node | null;
    let charCount = 0;
  
    while ((currentNode = nodeIterator.nextNode()) && !endNode) {
      const nodeLength = currentNode.textContent?.length || 0;
      const nextCharCount = charCount + nodeLength;
  
      if (!startNode && start >= charCount && start <= nextCharCount) {
        startNode = currentNode;
        startOffset = start - charCount;
      }
      if (!endNode && end >= charCount && end <= nextCharCount) {
        endNode = currentNode;
        endOffset = end - charCount;
      }
      
      charCount = nextCharCount;
    }
  
    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

export function applyStyleToSpans(
    spans: TextSpan[],
    range: { start: number; end: number } | null,
    styleUpdate: Partial<TextStyle>
): TextSpan[] {
    if (!range) {
        return spans;
    }
    
    const mergeSpans = (spansToMerge: TextSpan[]): TextSpan[] => {
        if (spansToMerge.length < 2) return spansToMerge.filter(s => s.text.length > 0 || spansToMerge.length === 1);
        const merged: TextSpan[] = [];
        if (spansToMerge.length > 0) {
            merged.push(spansToMerge[0]);
            for (let i = 1; i < spansToMerge.length; i++) {
                const prev = merged[merged.length - 1];
                const current = spansToMerge[i];
                if (current.text && JSON.stringify(prev.style) === JSON.stringify(current.style)) {
                    prev.text += current.text;
                } else if (current.text || (spansToMerge.length === 1 && current.text === '')) {
                    merged.push(current);
                }
            }
        }
        return merged.filter(s => s.text.length > 0 || merged.length === 1);
    };

    const { start, end } = range;

    if (start === end) {
        let charIndex = 0;
        const newSpans = spans.map(span => {
            const spanEnd = charIndex + span.text.length;
            const isCursorInSpan = start >= charIndex && start <= spanEnd;
            charIndex = spanEnd;
            if (isCursorInSpan) {
                return { ...span, style: { ...defaultTextStyle, ...span.style, ...styleUpdate } };
            }
            return span;
        });
        return mergeSpans(newSpans);
    }
    
    const newSpans: TextSpan[] = [];
    let currentIndex = 0;

    for (const span of spans) {
        const spanEnd = currentIndex + span.text.length;

        if (spanEnd <= start || currentIndex >= end) {
            newSpans.push({ ...span });
        } else { 
            const beforeText = span.text.substring(0, Math.max(0, start - currentIndex));
            const selectedText = span.text.substring(Math.max(0, start - currentIndex), Math.min(span.text.length, end - currentIndex));
            const afterText = span.text.substring(Math.min(span.text.length, end - currentIndex));

            if (beforeText) newSpans.push({ ...span, text: beforeText });
            if (selectedText) {
                const newStyle = { ...defaultTextStyle, ...span.style, ...styleUpdate };
                newSpans.push({ ...span, text: selectedText, style: newStyle });
            }
            if (afterText) newSpans.push({ ...span, text: afterText });
        }
        
        currentIndex = spanEnd;
    }
    
    return mergeSpans(newSpans);
}


export default CanvasItem;