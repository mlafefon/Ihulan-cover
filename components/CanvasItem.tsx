import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { CanvasElement, TextElement, ImageElement, TextSpan, TextStyle, CutterElement } from '../types';
import { ElementType } from '../types';
import { ImageIcon } from './Icons';

interface CanvasItemProps {
    element: CanvasElement;
    isSelected: boolean;
    isEditing: boolean;
    isHoveredFromSidebar?: boolean;
    isCutterTarget?: boolean;
    onSelect: () => void;
    onUpdate: (id: string, updates: Partial<CanvasElement> & { textContent?: string }, withHistory?: boolean, cursorPos?: { start: number; end: number }) => void;
    isInteracting: boolean;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
    onSetSelectionRange: (range: { start: number, end: number } | null) => void;
    onSetEditing: (id: string | null) => void;
    onElementRefsChange: (id: string, refs: { content?: HTMLDivElement | null; wrapper?: HTMLDivElement | null; }) => void;
    onEditImage: (element: ImageElement, newSrc?: string) => void;
    canvasWidth: number;
    canvasHeight: number;
    otherElements: CanvasElement[];
    setSnapLines: (lines: { x: number[], y: number[] }) => void;
    activeStyle: TextStyle | null;
    formatBrushState: { active: boolean; sourceElement: TextElement | null };
    temporaryFontOverride: { elementId: string; fontFamily: string } | null;
    canvasScale: number;
}

const handlePositions: { [key: string]: { top?: string; left?: string; right?: string; bottom?: string; transform: string; } } = {
    tl: { top: '0', left: '0', transform: 'translateX(-50%) translateY(-50%)' },
    t:  { top: '0', left: '50%', transform: 'translateX(-50%) translateY(-50%)' },
    tr: { top: '0', right: '0', transform: 'translateX(50%) translateY(-50%)' },
    l:  { top: '50%', left: '0', transform: 'translateX(-50%) translateY(-50%)' },
    r:  { top: '50%', right: '0', transform: 'translateX(50%) translateY(-50%)' },
    bl: { bottom: '0', left: '0', transform: 'translateX(-50%) translateY(50%)' },
    b:  { bottom: '0', left: '50%', transform: 'translateX(-50%) translateY(50%)' },
    br: { bottom: '0', right: '0', transform: 'translateX(50%) translateY(50%)' },
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

// Custom cursor that combines move and text-edit affordances.
const moveAndTextCursor = "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMlYyMk0yIDEySDIyTTEyIDJMMTAgNk0xMiAyTDE0IDZNMTIgMjJMMTAgMThNMTIgMjJMMTQgMThNMiAxMkw2IDEwTTIgMTJMNiAxNE0yMiAxMkwxOCAxME0yMiAxMkwxOCAxNCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTIgMlYyMk0yIDEySDIyTTEyIDJMMTAgNk0xMiAyTDE0IDZNMTIgMjJMMTAgMThNMTIgMjJMMTQgMThNMiAxMkw2IDEwTTIgMTJMNiAxNE0yMiAxMkwxOCAxME0yMiAxMkwxOCAxNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xMCA5SDE0TTEwIDE1SDE0TTEyIDlWMTUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTEwIDlIMTRNMTAgMTVIMTRNMTIgOVYxNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==') 12 12, move";

const brushCursor = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><path d='m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08'/><path d='M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z'/></svg>\") 2 22, pointer";

// A default style object to ensure all required properties exist on a text style.
export const defaultTextStyle: TextStyle = {
    fontFamily: 'Heebo',
    fontSize: 32,
    fontWeight: 400,
    color: '#FFFFFF',
    textShadow: '',
    lineHeight: 1.2,
};

// Utility to get coordinates from both MouseEvent and TouchEvent
const getEventCoords = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
        // TouchEvent
        const touch = e.touches[0] || e.changedTouches[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
    }
    // MouseEvent
    return { clientX: e.clientX, clientY: e.clientY };
};


const CanvasItem: React.FC<CanvasItemProps> = ({ element, isSelected, isEditing, onSelect, onUpdate, onInteractionEnd, onSetSelectionRange, onSetEditing, onElementRefsChange, onEditImage, canvasWidth, canvasHeight, otherElements, setSnapLines, onInteractionStart, isInteracting, isCutterTarget, activeStyle, isHoveredFromSidebar, formatBrushState, temporaryFontOverride, canvasScale }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const textContentRef = useRef<HTMLDivElement>(null);
    const textWrapperRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastTap = useRef(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [clickToEditCoords, setClickToEditCoords] = useState<{ x: number; y: number } | null>(null);
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string; }>({ visible: false, x: 0, y: 0, text: '' });
    const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);
    const [imageLoadError, setImageLoadError] = useState(false);
    const imageSrc = element.type === ElementType.Image ? (element as ImageElement).src : undefined;

    useEffect(() => {
        if (element.type === ElementType.Image) {
            setImageLoadError(false);
        }
    }, [element.type, imageSrc]);


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
        if (!isSelected) {
            onSetEditing(null);
        }
    }, [isSelected, onSetEditing]);

    useEffect(() => {
        if (isEditing && clickToEditCoords && textContentRef.current) {
            const { x, y } = clickToEditCoords;
            const textNode = textContentRef.current;
            textNode.focus();
    
            let range: Range | null = null;
            // document.caretRangeFromPoint is a non-standard but widely supported alternative.
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(x, y);
// Fix: Cast `document` to `any` to access the non-standard `caretPositionFromPoint` property without a TypeScript error.
            } else if ((document as any).caretPositionFromPoint) {
                // The more standard way
// Fix: Cast `document` to `any` to access the non-standard `caretPositionFromPoint` property without a TypeScript error.
                const pos = (document as any).caretPositionFromPoint(x, y);
                if (pos) {
                    range = document.createRange();
                    range.setStart(pos.offsetNode, pos.offset);
                    range.collapse(true); // collapse to a caret
                }
            }
    
            if (range && textNode.contains(range.startContainer)) {
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            
            setClickToEditCoords(null); // Reset after use
        } else if (isEditing && textContentRef.current) {
            textContentRef.current.focus();
        }
    }, [isEditing, clickToEditCoords]);
    
    useEffect(() => {
        if (isSelected && element.type === ElementType.Text) {
            const handleSelectionChange = () => {
                const selection = document.getSelection();
                const itemNode = textContentRef.current;
                
                if (selection && itemNode && selection.rangeCount > 0 && selection.containsNode(itemNode, true)) {
                    // Update character offset range for styling logic
                    const offsets = getSelectionCharOffsetsWithin(itemNode);
                    onSetSelectionRange(offsets);

                    // Update visual selection overlays
                    const range = selection.getRangeAt(0);
                    if (range.collapsed) {
                        setSelectionRects([]);
                    } else {
                        const textElement = element as TextElement;
                        
                        // Fallback to the first span's style if activeStyle is not available, which can happen during initial selection.
                        const styleForMetrics = activeStyle || textElement.spans[0]?.style || defaultTextStyle;
                        
                        const wrapperNode = textWrapperRef.current;
                        if (!wrapperNode) return;
    
                        const wrapperRect = wrapperNode.getBoundingClientRect();
                        const clientRects = Array.from(range.getClientRects());
                        
                        const rotationRad = (textElement.rotation * Math.PI) / 180;
                        const cos = Math.abs(Math.cos(rotationRad));
                        const sin = Math.abs(Math.sin(rotationRad));

                        const outlineWidth = (textElement.outline?.enabled && textElement.outline.width) ? textElement.outline.width : 0;
    
                        const newSelectionRects = clientRects.map(rect => {
                            const unscaledRectWidth = rect.width / canvasScale;
                            const unscaledRectHeight = rect.height / canvasScale;

                            // Calculate the real width and height of the text content, accounting for rotation.
                            const h_local_line = styleForMetrics.fontSize * styleForMetrics.lineHeight;
                            let w_local: number;

                            if (cos >= sin) {
                                w_local = cos > 1e-6 ? (unscaledRectWidth - h_local_line * sin) / cos : 0;
                            } else {
                                w_local = sin > 1e-6 ? (unscaledRectHeight - h_local_line * cos) / sin : 0;
                            }

                            const h_local_font = styleForMetrics.fontSize;
                            
                            const viewportCenterX = rect.left + rect.width / 2;
                            const viewportCenterY = rect.top + rect.height / 2;
    
                            const rotatedBoundingBoxCenterX = wrapperRect.left + wrapperRect.width / 2;
                            const rotatedBoundingBoxCenterY = wrapperRect.top + wrapperRect.height / 2;
                            
                            let dx = viewportCenterX - rotatedBoundingBoxCenterX;
                            let dy = viewportCenterY - rotatedBoundingBoxCenterY;
    
                            const invRotationRad = -rotationRad;
                            const cos_inv = Math.cos(invRotationRad);
                            const sin_inv = Math.sin(invRotationRad);
                            
                            const local_dx_scaled = dx * cos_inv - dy * sin_inv;
                            const local_dy_scaled = dx * sin_inv + dy * cos_inv;

                            const local_dx = local_dx_scaled / canvasScale;
                            const local_dy = local_dy_scaled / canvasScale;
                            
                            const unrotatedCenterX = textElement.width / 2;
                            const unrotatedCenterY = textElement.height / 2;
                            
                            const local_top = unrotatedCenterY + local_dy - h_local_font / 2;
                            const local_left = unrotatedCenterX + local_dx - w_local / 2;
    
                            return new DOMRect(local_left - outlineWidth, local_top - outlineWidth, w_local, h_local_font);
                        });
                        
                        setSelectionRects(newSelectionRects);
                    }
                } else {
                    // Selection is outside the element or cleared
                    onSetSelectionRange(null);
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
            onSetSelectionRange(null);
            setSelectionRects([]);
        }
    }, [isSelected, element, activeStyle, onSetSelectionRange, canvasScale]);


    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isSelected && element.type === ElementType.Text) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const textElement = element as TextElement;
                const fullText = textElement.spans.map(s => s.text).join('');
                const { start, end } = getSelectionCharOffsetsWithin(e.currentTarget);

                // 1. Find the current line number
                const currentLineIndex = (fullText.substring(0, start).match(/\n/g) || []).length;

                // 2. Determine the alignment of the current line
                const currentLineAlignments = textElement.lineAlignments || [];
                const alignmentOfCurrentLine = currentLineAlignments[currentLineIndex] || textElement.textAlign;

                // 3. Prepare the new line alignments
                const lines = fullText.split('\n');
                const newLineAlignments = [...currentLineAlignments];
                // Pad the array if it's shorter than the number of lines to match current state
                while (newLineAlignments.length < lines.length) {
                    newLineAlignments.push(textElement.textAlign);
                }
                // Insert the new alignment for the new line
                newLineAlignments.splice(currentLineIndex + 1, 0, alignmentOfCurrentLine);

                // 4. Create new text and cursor position
                const newFullText = fullText.substring(0, start) + '\n' + fullText.substring(end);
                const newCursorPos = { start: start + 1, end: start + 1 };

                // 5. Update the element with new text AND new line alignments
                onUpdate(element.id, { textContent: newFullText, lineAlignments: newLineAlignments }, true, newCursorPos);

            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                const textElement = element as TextElement;
                const fullText = textElement.spans.map(s => s.text).join('');
                const selection = getSelectionCharOffsetsWithin(e.currentTarget);

                let newFullText: string;
                let newCursorPos: { start: number; end: number };
                const updatePayload: Partial<TextElement> & { textContent?: string } = {};

                if (selection.start === selection.end) { // Collapsed cursor
                    if (e.key === 'Backspace' && selection.start > 0) {
                        newFullText = fullText.substring(0, selection.start - 1) + fullText.substring(selection.end);
                        newCursorPos = { start: selection.start - 1, end: selection.start - 1 };
                        if (fullText.charAt(selection.start - 1) === '\n') {
                            const lineIndexBeingMerged = (fullText.substring(0, selection.start).match(/\n/g) || []).length;
                            let alignments = textElement.lineAlignments ? [...textElement.lineAlignments] : [];
                            if (lineIndexBeingMerged < alignments.length) {
                                alignments.splice(lineIndexBeingMerged, 1);
                                updatePayload.lineAlignments = alignments.every(a => a === textElement.textAlign) ? [] : alignments;
                            }
                        }
                    } else if (e.key === 'Delete' && selection.start < fullText.length) {
                        newFullText = fullText.substring(0, selection.start) + fullText.substring(selection.end + 1);
                        newCursorPos = { start: selection.start, end: selection.start };
                        if (fullText.charAt(selection.start) === '\n') {
                           const lineIndexAfterMerged = (fullText.substring(0, selection.start).match(/\n/g) || []).length + 1;
                            let alignments = textElement.lineAlignments ? [...textElement.lineAlignments] : [];
                            if (lineIndexAfterMerged < alignments.length) {
                                alignments.splice(lineIndexAfterMerged, 1);
                                updatePayload.lineAlignments = alignments.every(a => a === textElement.textAlign) ? [] : alignments;
                            }
                        }
                    } else {
                        return; // At start/end, do nothing
                    }
                } else { // Range selection
                    newFullText = fullText.substring(0, selection.start) + fullText.substring(selection.end);
                    newCursorPos = { start: selection.start, end: selection.start };
                    
                    const deletedText = fullText.substring(selection.start, selection.end);
                    const newlineCount = (deletedText.match(/\n/g) || []).length;
                    if (newlineCount > 0 && textElement.lineAlignments) {
                        const startLineIndex = (fullText.substring(0, selection.start).match(/\n/g) || []).length;
                        let alignments = [...textElement.lineAlignments];
                        alignments.splice(startLineIndex + 1, newlineCount);
                        updatePayload.lineAlignments = alignments.every(a => a === textElement.textAlign) ? [] : alignments;
                    }
                }
                
                updatePayload.textContent = newFullText;
                onUpdate(element.id, updatePayload, true, newCursorPos);
            }
        }
    };
    
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text/plain');
        if (!pastedText) return;

        const textElement = element as TextElement;
        const fullText = textElement.spans.map(s => s.text).join('');
        const selection = getSelectionCharOffsetsWithin(e.currentTarget);
        
        const newFullText = fullText.substring(0, selection.start) + pastedText + fullText.substring(selection.end);
        const newCursorPos = { start: selection.start + pastedText.length, end: selection.start + pastedText.length };
        
        onUpdate(element.id, { textContent: newFullText }, true, newCursorPos);
    };

    const handleCut = async (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (element.type !== ElementType.Text) return;
    
        const textElement = element as TextElement;
        const fullText = textElement.spans.map(s => s.text).join('');
        const selection = getSelectionCharOffsetsWithin(e.currentTarget);
    
        // Only intervene if the entire text content is selected.
        if (selection.start === 0 && selection.end === fullText.length) {
            e.preventDefault(); // Prevent the browser's native cut behavior.
            try {
                // Manually copy the full text to the clipboard.
                await navigator.clipboard.writeText(fullText);
                // Update the element's state to be empty, which our existing logic handles gracefully.
                onUpdate(element.id, { textContent: '' }, true, { start: 0, end: 0 });
            } catch (err) {
                console.error('Failed to cut text to clipboard:', err);
                // As a fallback if clipboard API fails, just delete the text.
                onUpdate(element.id, { textContent: '' }, true, { start: 0, end: 0 });
            }
        }
        // For partial cuts, we let the default browser behavior proceed,
        // which will trigger the `onInput` handler.
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
        if (e.target) e.target.value = ''; // Reset file input
    };

    const handleDoubleClick = () => {
        if (element.locked) return;
        if (element.type === ElementType.Image) {
            onEditImage(element as ImageElement);
        } else if (element.type === ElementType.Text) {
            onSetEditing(element.id);
        }
    };

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isEditing && element.type === ElementType.Text && textContentRef.current?.contains(e.target as Node)) {
            return;
        }
    
        e.preventDefault();
        e.stopPropagation();

        if (!isSelected) {
            onSelect();
        }

        if (element.locked) {
            if ('button' in e && e.button === 2) { 
                return;
            }
            const handleLockedInteractionEnd = (endEvent: MouseEvent | TouchEvent) => {
                document.removeEventListener('mouseup', handleLockedInteractionEnd as EventListener);
                document.removeEventListener('touchend', handleLockedInteractionEnd as EventListener);
                if (isSelected && element.type === ElementType.Text) {
                    onSetEditing(element.id);
                    const { clientX, clientY } = getEventCoords(endEvent);
                    setClickToEditCoords({ x: clientX, y: clientY });
                } else if (element.type === ElementType.Image) {
                    onEditImage(element as ImageElement);
                }
            };
            document.addEventListener('mouseup', handleLockedInteractionEnd as EventListener);
            document.addEventListener('touchend', handleLockedInteractionEnd as EventListener);
            return; 
        }
    
        const { clientX: startMouseX, clientY: startMouseY } = getEventCoords(e);
        let didDrag = false;
    
        const handleInteractionMove = (moveEvent: MouseEvent | TouchEvent) => {
            const { clientX, clientY } = getEventCoords(moveEvent);
            if (!didDrag && (Math.abs(clientX - startMouseX) > 5 || Math.abs(clientY - startMouseY) > 5)) {
                didDrag = true;
                onInteractionStart();
            }
    
            if (didDrag) {
                const dx = (clientX - startMouseX) / canvasScale;
                const dy = (clientY - startMouseY) / canvasScale;
                const startElX = element.x;
                const startElY = element.y;
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
            }
        };
    
        const handleInteractionEnd = (upEvent: MouseEvent | TouchEvent) => {
            document.removeEventListener('mousemove', handleInteractionMove);
            document.removeEventListener('touchmove', handleInteractionMove);
            document.removeEventListener('mouseup', handleInteractionEnd as EventListener);
            document.removeEventListener('touchend', handleInteractionEnd as EventListener);

            if (didDrag) {
                onInteractionEnd();
            } else { 
                if (isSelected && element.type === ElementType.Text) {
                    onSetEditing(element.id);
                    const { clientX, clientY } = getEventCoords(upEvent);
                    setClickToEditCoords({ x: clientX, y: clientY });
                }
            }
        };
        
        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('touchmove', handleInteractionMove);
        document.addEventListener('mouseup', handleInteractionEnd as EventListener);
        document.addEventListener('touchend', handleInteractionEnd as EventListener);
    };
    
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap.current;
        if (tapLength < 300 && tapLength > 0) {
            handleDoubleClick();
            e.preventDefault(); // Prevent zoom on double tap
        } else {
            handleDragStart(e);
        }
        lastTap.current = currentTime;
    };


    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, corner: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (element.locked) return;
        onInteractionStart();
    
        const { clientX: startMouseX, clientY: startMouseY } = getEventCoords(e);
    
        const { x, y, width, height, rotation } = element;
        
        const centerX = x + width / 2;
        const centerY = y + height / 2;
    
        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
    
        const handleInteractionMove = (moveEvent: MouseEvent | TouchEvent) => {
            const { clientX: currentMouseX, clientY: currentMouseY } = getEventCoords(moveEvent);
            
            const dx = (currentMouseX - startMouseX) / canvasScale;
            const dy = (currentMouseY - startMouseY) / canvasScale;
            
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
            
            if (newWidth > 0 && newHeight > 0) {
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
    
                const newX = newCenterX - newWidth / 2;
                const newY = newCenterY - newHeight / 2;
                
                let finalWidth = newWidth;
                let finalHeight = newHeight;
                let finalX = newX;
                let finalY = newY;
 
                if (element.type !== ElementType.Cutter) {
                    const SNAP_THRESHOLD = 5;
                    const snapTargetsX = [0, canvasWidth / 2, canvasWidth];
                    const snapTargetsY = [0, canvasHeight / 2, canvasHeight];
                    const activeSnapLines: { x: number[], y: number[] } = { x: [], y: [] };

                    for (const targetX of snapTargetsX) {
                        if (isMovingRight && Math.abs((finalX + finalWidth) - targetX) < SNAP_THRESHOLD) {
                            finalWidth = targetX - finalX;
                            activeSnapLines.x.push(targetX);
                            break;
                        }
                        if (isMovingLeft && Math.abs(finalX - targetX) < SNAP_THRESHOLD) {
                            const oldRight = x + width;
                            finalWidth = oldRight - targetX;
                            finalX = targetX;
                            activeSnapLines.x.push(targetX);
                            break;
                        }
                    }

                    for (const targetY of snapTargetsY) {
                        if (isMovingBottom && Math.abs((finalY + finalHeight) - targetY) < SNAP_THRESHOLD) {
                            finalHeight = targetY - finalY;
                            activeSnapLines.y.push(targetY);
                            break;
                        }
                        if (isMovingTop && Math.abs(finalY - targetY) < SNAP_THRESHOLD) {
                            const oldBottom = y + height;
                            finalHeight = oldBottom - targetY;
                            finalY = targetY;
                            activeSnapLines.y.push(targetY);
                            break;
                        }
                    }
                    
                    setSnapLines(activeSnapLines);
                } else {
                    setSnapLines({ x: [], y: [] });
                }

                if (finalWidth < 10) {
                    if (isMovingLeft) finalX += finalWidth - 10;
                    finalWidth = 10;
                }
                if (finalHeight < 10) {
                    if (isMovingTop) finalY += finalHeight - 10;
                    finalHeight = 10;
                }
    
                onUpdate(element.id, { width: finalWidth, height: finalHeight, x: finalX, y: finalY }, false);
            }
        };
        
        const handleInteractionEnd = () => {
            document.removeEventListener('mousemove', handleInteractionMove);
            document.removeEventListener('touchmove', handleInteractionMove);
            document.removeEventListener('mouseup', handleInteractionEnd);
            document.removeEventListener('touchend', handleInteractionEnd);
            onInteractionEnd();
        };
    
        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('touchmove', handleInteractionMove);
        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchend', handleInteractionEnd);
    };

    const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (element.locked) return;
        onInteractionStart();
        setIsRotating(true);
    
        const el = itemRef.current!;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startCoords = getEventCoords(e);
        const startAngle = Math.atan2(startCoords.clientY - centerY, startCoords.clientX - centerX);
        const startRotation = element.rotation;
    
        document.body.style.cursor = `url('${rotateCursorUrl}') 12 12, auto`;
    
        const handleInteractionMove = (moveEvent: MouseEvent | TouchEvent) => {
            const moveCoords = getEventCoords(moveEvent);
            const angle = Math.atan2(moveCoords.clientY - centerY, moveCoords.clientX - centerX);
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
                x: moveCoords.clientX,
                y: moveCoords.clientY,
                text: `${Math.round(finalRotation)}°`
            });
        };
    
        const handleInteractionEnd = () => {
            document.removeEventListener('mousemove', handleInteractionMove);
            document.removeEventListener('touchmove', handleInteractionMove);
            document.removeEventListener('mouseup', handleInteractionEnd);
            document.removeEventListener('touchend', handleInteractionEnd);
            onInteractionEnd();
            setTooltip({ visible: false, x: 0, y: 0, text: '' });
            document.body.style.cursor = '';
            setIsRotating(false);
        };
    
        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('touchmove', handleInteractionMove);
        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchend', handleInteractionEnd);
    };
    
    const verticalAlignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

    const cursorStyle = useMemo(() => {
        if (formatBrushState.active && element.type === ElementType.Text && element.id !== formatBrushState.sourceElement?.id) {
            return { wrapper: brushCursor, content: brushCursor };
        }
        if ((isInteracting && !isSelected) || isRotating) {
            return { wrapper: 'default', content: 'default' };
        }
        if (element.locked) {
            if (element.type === ElementType.Text && isSelected) {
                return { wrapper: 'text', content: 'text' };
            }
            if (element.type === ElementType.Image) {
                return { wrapper: 'pointer', content: 'pointer' };
            }
            return { wrapper: 'default', content: 'default' };
        }
        if (element.type === ElementType.Text) {
            if (isEditing) {
                return { wrapper: 'default', content: 'text' };
            }
            if (isSelected) {
                return { wrapper: moveAndTextCursor, content: moveAndTextCursor };
            }
        }
        return { wrapper: 'move', content: 'move' };
    }, [element, isSelected, isEditing, isInteracting, isRotating, formatBrushState]);


    const itemStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${element.y}px`,
        left: `${element.x}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `rotate(${element.rotation}deg)`,
        zIndex: element.zIndex,
        cursor: cursorStyle.wrapper,
        boxSizing: 'border-box',
    };
    
    // SVG Shape Generation Helpers
    const createStarPath = (points: number, outerRadius: number, innerRadius: number, centerX = 50, centerY = 50): string => {
        let path = '';
        const angle = Math.PI / points;
        for (let i = 0; i < 2 * points; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = centerX + radius * Math.sin(i * angle);
            const y = centerY - radius * Math.cos(i * angle);
            path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)} `;
        }
        return path + 'Z';
    };

    const createPolygonPath = (sides: number, radius: number, centerX = 50, centerY = 50): string => {
        let path = '';
        const angle = (2 * Math.PI) / sides;
        for (let i = 0; i < sides; i++) {
            const x = centerX + radius * Math.sin(i * angle);
            const y = centerY - radius * Math.cos(i * angle);
            path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)} `;
        }
        return path + 'Z';
    };


    const renderElement = () => {
        switch (element.type) {
            case ElementType.Text: {
                const textElement = element as TextElement;
                const isTemporarilyOverridden = temporaryFontOverride && temporaryFontOverride.elementId === textElement.id;
                const tempFontFamily = isTemporarilyOverridden ? temporaryFontOverride.fontFamily : null;

                const createLinesFromSpans = (spans: TextSpan[]) => {
                    const lines: { spans: TextSpan[] }[] = [{ spans: [] }];
                    let currentLine = lines[0];

                    if (spans.length === 0 || (spans.length === 1 && spans[0].text === '')) {
                         return [{ spans: [{ text: '\u00A0', style: spans[0]?.style || defaultTextStyle }] }];
                    }

                    for (const span of spans) {
                        const parts = span.text.split('\n');
                        parts.forEach((part, index) => {
                            if (part) {
                                currentLine.spans.push({ ...span, text: part });
                            }
                            if (index < parts.length - 1) {
                                lines.push({ spans: [] });
                                currentLine = lines[lines.length - 1];
                            }
                        });
                    }
                    return lines;
                };

                const lines = createLinesFromSpans(textElement.spans);
                const lineAlignments = textElement.lineAlignments || [];
                const defaultAlign = textElement.textAlign;

                const backgroundShape = textElement.backgroundShape || 'rectangle';
                const outline = textElement.outline || { enabled: false, width: 0, color: '#FFFFFF' };
                
                const wrapperStyle: React.CSSProperties = {
                    width: '100%',
                    height: '100%',
                    backgroundColor: textElement.backgroundColor,
                    overflow: 'hidden',
                    position: 'relative',
                };

                let shapePath = '';
                const isSvgShape = ['star', 'starburst-8', 'starburst-10', 'starburst-12', 'hexagon', 'octagon', 'rhombus', 'speech-bubble'].includes(backgroundShape);

                if (backgroundShape === 'rounded') {
                    wrapperStyle.borderRadius = '25px';
                } else if (backgroundShape === 'ellipse') {
                    wrapperStyle.borderRadius = '50%';
                } else if (isSvgShape) {
                    wrapperStyle.backgroundColor = 'transparent';
                    if (backgroundShape === 'star') shapePath = createStarPath(5, 50, 20);
                    else if (backgroundShape === 'starburst-8') shapePath = createStarPath(8, 50, 30);
                    else if (backgroundShape === 'starburst-10') shapePath = createStarPath(10, 50, 35);
                    else if (backgroundShape === 'starburst-12') shapePath = createStarPath(12, 50, 38);
                    else if (backgroundShape === 'hexagon') shapePath = createPolygonPath(6, 50);
                    else if (backgroundShape === 'octagon') shapePath = createPolygonPath(8, 50);
                    else if (backgroundShape === 'rhombus') shapePath = 'M50,0 L100,50 L50,100 L0,50Z';
                    else if (backgroundShape === 'speech-bubble') shapePath = 'M0,0 H100 V75 Q100,80,95,80 H25 L15,95 V80 H5 Q0,80,0,75 V0Z';
                }

                if (outline.enabled && outline.width > 0 && !isSvgShape) {
                    wrapperStyle.border = `${outline.width}px solid ${outline.color}`;
                }

                const firstSpanStyle = textElement.spans[0]?.style;
                const editableStyle: React.CSSProperties = {
                    outline: 'none',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: verticalAlignMap[textElement.verticalAlign],
                    padding: `${textElement.padding}px`,
                    letterSpacing: `${textElement.letterSpacing}px`,
                    userSelect: isEditing ? 'text' : 'none',
                    cursor: cursorStyle.content,
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                    zIndex: 1,
                    // Fallback styles to prevent unstyled text on new lines
                    ...(firstSpanStyle && {
                        fontFamily: tempFontFamily || firstSpanStyle.fontFamily,
                        fontSize: `${firstSpanStyle.fontSize}px`,
                        fontWeight: firstSpanStyle.fontWeight,
                        color: firstSpanStyle.color,
                        textShadow: firstSpanStyle.textShadow,
                        lineHeight: firstSpanStyle.lineHeight || 1.2,
                    }),
                };

                return (
                    <div ref={textWrapperRef} style={wrapperStyle}>
                        {isSvgShape && (
                            <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
                            >
                                <path
                                    d={shapePath}
                                    fill={textElement.backgroundColor === 'transparent' ? 'none' : textElement.backgroundColor}
                                    stroke={outline.enabled ? outline.color : 'none'}
                                    strokeWidth={outline.enabled ? outline.width : 0}
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                         {isSelected && selectionRects.map((rect, i) => (
                            <div
                                key={`selection-rect-${i}`}
                                style={{
                                    position: 'absolute',
                                    top: `${rect.y}px`,
                                    left: `${rect.x}px`,
                                    width: `${rect.width}px`,
                                    height: `${rect.height}px`,
                                    backgroundColor: '#64748b',
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                }}
                            />
                         ))}
                        <div 
                            ref={textContentRef} 
                            style={editableStyle}
                            className={isSelected ? 'has-custom-selection' : ''}
                            contentEditable={isEditing}
                            suppressContentEditableWarning={true}
                            dir="auto"
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            onCut={handleCut}
                            onInput={(e) => {
                                const container = e.currentTarget;
                                // The content is inside a wrapper div for layout purposes.
                                const wrapperDiv = container.querySelector('div');
                                if (!wrapperDiv) {
                                    return; // Should not happen in normal flow
                                }
                                
                                // Reconstruct the full text content by joining the text of each line div with a newline.
                                // This correctly handles multi-line content.
                                const reconstructedText = Array.from(wrapperDiv.childNodes)
                                    .map(node => (node as Node).textContent || '')
                                    .join('\n');
                                
                                // Sanitize to match data model (remove zero-width spaces).
                                const sanitizedText = reconstructedText.replace(/\u200b/g, '');
                            
                                const currentText = (element as TextElement).spans.map(s => s.text).join('');
                            
                                if (sanitizedText !== currentText) {
                                    // We get the cursor position from the live DOM.
                                    // The getSelection... function itself will also sanitize.
                                    const cursorPos = getSelectionCharOffsetsWithin(e.currentTarget);
                                    onUpdate(element.id, { textContent: sanitizedText }, true, cursorPos);
                                }
                            }}
                        >
                            <div>
                                {lines.map((line, lineIndex) => {
                                    const effectiveAlign = lineAlignments[lineIndex] || defaultAlign;
                                    const scaleX = textElement.scaleX ?? 1;
                                    const scaleY = textElement.scaleY ?? 1;

                                    // Calculate translateX for this specific line based on its effective alignment.
                                    // This ensures that when scaled, the line aligns correctly from its intended origin (left, center, or right).
                                    let translateX = '0%';
                                    if (effectiveAlign === 'left') {
                                        translateX = `${50 * (scaleX - 1)}%`;
                                    } else if (effectiveAlign === 'right') {
                                        translateX = `${50 * (1 - scaleX)}%`;
                                    }

                                    // Vertical scaling is always from the line's center.
                                    const lineTransform = `translateX(${translateX}) scale(${scaleX}, ${scaleY})`;
                                    
                                    return (
                                        <div
                                            key={lineIndex}
                                            style={{
                                                transform: lineTransform,
                                                textAlign: effectiveAlign,
                                                textAlignLast: effectiveAlign === 'justify' ? 'justify' : 'auto',
                                            }}
                                        >
                                            {line.spans.length > 0 ? line.spans.map((span, spanIndex) => (
                                                <span key={spanIndex} style={{
                                                    fontFamily: tempFontFamily || span.style.fontFamily,
                                                    fontSize: `${span.style.fontSize}px`,
                                                    fontWeight: span.style.fontWeight,
                                                    color: span.style.color,
                                                    textShadow: span.style.textShadow,
                                                    lineHeight: span.style.lineHeight || 1.2,
                                                }}>
                                                    {span.text}
                                                </span>
                                            )) : (
                                                // Render a zero-width space to ensure the div has height and is clickable
                                                <span>&#8203;</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            }
            case ElementType.Image: {
                const imageElement = element as ImageElement;
                if (imageLoadError || !imageElement.src) {
                    return (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 bg-gray-700 flex flex-col items-center justify-center text-center text-gray-300 pointer-events-none">
                            <ImageIcon className="w-8 h-8 mb-2" />
                            <span>{imageLoadError ? 'טעינת תמונה נכשלה' : 'הוסף תמונה'}</span>
                        </div>
                    );
                }
                return (
                    <img
                        src={imageElement.src}
                        alt="Uploaded content"
                        className="w-full h-full pointer-events-none"
                        style={{objectFit: imageElement.objectFit}}
                        crossOrigin="anonymous"
                        onError={() => setImageLoadError(true)}
                    />
                );
            }
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

    const rotationHandleLineHeight = 40 - (16 * canvasScale);

    return (
        <>
            {renderTooltip()}
            <div
                ref={itemRef}
                style={itemStyle}
                onMouseDown={handleDragStart}
                onTouchStart={handleTouchStart}
                onDoubleClick={handleDoubleClick}
                onMouseEnter={() => {
                    if (!isInteracting) {
                        setIsHovered(true);
                    }
                }}
                onMouseLeave={() => {
                    setIsHovered(false);
                }}
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
                    <div className="absolute border-2 border-dashed border-white pointer-events-none" style={{ top: '-1px', left: '-1px', right: '-1px', bottom: '-1px' }} />
                )}
                {isSelected && !isEditing && (
                    <div 
                        className="absolute border-2 border-blue-500 pointer-events-none"
                        style={{
                            top: '-1px', left: '-1px', right: '-1px', bottom: '-1px',
                            ...(element.type === ElementType.Cutter ? { borderRadius: '50%' } : {})
                        }}
                    />
                )}
                {isSelected && isEditing && element.type === ElementType.Text && (
                    <div 
                        className="absolute border-2 border-dashed border-blue-500 pointer-events-none"
                        style={{ top: '-1px', left: '-1px', right: '-1px', bottom: '-1px' }}
                    />
                )}
                {(isHovered || isHoveredFromSidebar) && !isSelected && (
                    <div className="absolute border-2 border-dashed border-slate-400 pointer-events-none" style={{ top: '-1px', left: '-1px', right: '-1px', bottom: '-1px' }} />
                )}
                {isSelected && !isEditing && !element.locked && (
                    <>
                        {handles.map(handle => {
                            const handleProps = handlePositions[handle];
                            return (
                                <div
                                    key={handle}
                                    onMouseDown={(e) => handleResizeStart(e, handle)}
                                    onTouchStart={(e) => handleResizeStart(e, handle)}
                                    style={{
                                        top: handleProps.top,
                                        left: handleProps.left,
                                        right: handleProps.right,
                                        bottom: handleProps.bottom,
                                        transform: `scale(${1 / canvasScale}) ${handleProps.transform}`,
                                    }}
                                    className={`absolute bg-blue-500 border-2 border-white rounded-full w-3 h-3 z-50 ${!isRotating ? handleCursorClasses[handle] : ''}`}
                                />
                            );
                        })}
                        <div
                            onMouseDown={handleRotateStart}
                            onTouchStart={handleRotateStart}
                            style={{ 
                                cursor: `url('${rotateCursorUrl}') 12 12, auto`,
                                top: `${-2 / canvasScale}rem`,
                                transform: `translateX(-50%) scale(${1 / canvasScale})`,
                                transformOrigin: 'bottom center',
                                '--line-height': `${rotationHandleLineHeight}px`,
                            } as React.CSSProperties}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full z-50
                                        before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:top-1/2 before:w-0.5 before:h-[var(--line-height)] before:bg-blue-500"
                        />
                    </>
                )}
            </div>
        </>
    );
};

// --- Rich Text Utility Functions ---

export function getSelectionCharOffsetsWithin(element: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return { start: 0, end: 0 };
    const range = selection.getRangeAt(0);
    const sanitize = (str: string) => str.replace(/\u200b/g, '');

    const calculateOffset = (container: Node, offset: number): number => {
        let charCount = 0;
        const lineDivs = Array.from(element.querySelector('div')?.childNodes || element.childNodes);

        for (let i = 0; i < lineDivs.length; i++) {
            const lineDiv = lineDivs[i];
            if (lineDiv === container || lineDiv.contains(container)) {
                // We are on the correct line. Calculate offset within this line.
                const tempRange = document.createRange();
                tempRange.selectNodeContents(lineDiv);
                tempRange.setEnd(container, offset);
                charCount += sanitize(tempRange.toString()).length;
                return charCount; // Return the final count
            }
            // Add full length of the preceding line.
            charCount += sanitize((lineDiv as Node).textContent || '').length;
            // Add 1 for the newline character between lines.
            if (i < lineDivs.length - 1) {
                charCount++;
            }
        }
        return charCount; // Fallback if container not found
    };
    
    // If selection is not inside our element at all, return cursor at the end.
    if (!element.contains(range.commonAncestorContainer)) {
        const fullText = Array.from(element.childNodes).map(n => sanitize((n as Node).textContent || '')).join('\n');
        return { start: fullText.length, end: fullText.length };
    }

    const start = calculateOffset(range.startContainer, range.startOffset);
    const end = range.collapsed ? start : calculateOffset(range.endContainer, range.endOffset);

    return { start, end };
}


export function setSelectionByOffset(containerEl: HTMLElement, start: number, end: number) {
    const sel = window.getSelection();
    if (!sel) return;

    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    // Fix: Cast the result of `childNodes` to `Node[]`. The default `ChildNode` type lacks properties
    // like `textContent` and is not compatible with APIs like `createTreeWalker`, causing type errors.
    const lineDivs: Node[] = Array.from(containerEl.querySelector('div')?.childNodes || containerEl.childNodes) as Node[];

    const findPosition = (charPos: number): { node: Node; offset: number } | null => {
        let totalCharsProcessed = 0;
        for (let i = 0; i < lineDivs.length; i++) {
            const lineDiv = lineDivs[i];
            const lineContentLength = lineDiv.textContent?.length || 0;

            if (charPos >= totalCharsProcessed && charPos <= totalCharsProcessed + lineContentLength) {
                let lineCharOffset = 0;
                const targetOffsetInLine = charPos - totalCharsProcessed;
                const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT);
                let textNode;
                // Fix: Cast the result of nextNode() to Node | null to resolve an 'unknown' type error.
                while ((textNode = walker.nextNode() as Node | null)) {
                    const nodeLength = textNode.textContent?.length || 0;
                    if (targetOffsetInLine >= lineCharOffset && targetOffsetInLine <= lineCharOffset + nodeLength) {
                        return { node: textNode, offset: targetOffsetInLine - lineCharOffset };
                    }
                    lineCharOffset += nodeLength;
                }
                 if (lineContentLength === 0 && targetOffsetInLine === 0) {
                    return { node: lineDiv, offset: 0 };
                }
            }

            totalCharsProcessed += lineContentLength;
            if (i < lineDivs.length - 1) {
                totalCharsProcessed++;
            }
        }
        return null;
    };

    const startPos = findPosition(start);
    const endPos = findPosition(end);

    let totalCharCount = 0;
    for (let i = 0; i < lineDivs.length; i++) {
        totalCharCount += lineDivs[i].textContent?.length || 0;
        if (i < lineDivs.length - 1) {
            totalCharCount++;
        }
    }
    
    const setPositionAtEnd = (): { node: Node, offset: number } => {
        let lastTextNode: Node | null = null;
        
        const parentForWalker = containerEl.querySelector('div') || containerEl;
        if (parentForWalker.lastChild) {
             const walker = document.createTreeWalker(parentForWalker.lastChild, NodeFilter.SHOW_TEXT);
             let n;
             // Fix: Cast the result of nextNode() to Node | null to resolve a potential 'unknown' type error, consistent with other fixes.
             while ((n = walker.nextNode() as Node | null)) lastTextNode = n;
        }

        if (lastTextNode) {
            return { node: lastTextNode, offset: lastTextNode.textContent?.length || 0 };
        } else if (parentForWalker.lastChild) {
            // Handles empty last line
            return { node: parentForWalker.lastChild, offset: 0 };
        } else {
             // Handles completely empty editor
             return { node: parentForWalker, offset: 0 };
        }
    };

    if (startPos) {
        startNode = startPos.node;
        startOffset = startPos.offset;
    } else if (start >= totalCharCount) {
        const { node, offset } = setPositionAtEnd();
        startNode = node;
        startOffset = offset;
    }

    if (endPos) {
        endNode = endPos.node;
        endOffset = endPos.offset;
    } else {
        // If end position was not found but start was, collapse selection to start
        endNode = startNode;
        endOffset = startOffset;
    }

    if (startNode && endNode) {
        try {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            console.error("Failed to set selection range", e);
        }
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