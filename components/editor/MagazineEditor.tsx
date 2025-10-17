import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextSpan, TextStyle, CutterElement } from '../../types';
import { ElementType } from '../../types';
import Sidebar from './Sidebar';
import { UndoIcon, RedoIcon, MagazineIcon } from '../Icons';
import CanvasItem, { applyStyleToSpans, setSelectionByOffset, defaultTextStyle } from '../CanvasItem';
import { useFonts } from '../fonts/FontLoader';


interface MagazineEditorProps {
    initialTemplate: Template;
    onEditImage: (element: ImageElement, currentTemplate: Template, newSrc?: string) => void;
    onSaveTemplate: (template: Template, newPreview: string | undefined) => Promise<void>;
}

const MagazineEditor: React.FC<MagazineEditorProps> = ({ initialTemplate, onEditImage, onSaveTemplate }) => {
    const navigate = useNavigate();
    const { fontCss } = useFonts();
    const [cutterTargetId, setCutterTargetId] = useState<string | null>(null);
    const [snapLines, setSnapLines] = useState<{ x: number[], y: number[] }>({ x: [], y: [] });

    const [template, setTemplate] = useState<Template>(initialTemplate);
    const templateRef = useRef(template);
    templateRef.current = template;
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);
    const [history, setHistory] = useState<Template[]>([initialTemplate]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canvasRef = useRef<HTMLDivElement>(null);
    const elementRefMap = useRef<Record<string, {
        content?: HTMLDivElement | null;
        wrapper?: HTMLDivElement | null;
    }>>({});
    const [nextCursorPos, setNextCursorPos] = useState<{ id: string; pos: { start: number; end: number } } | null>(null);

    useEffect(() => {
        // Deep compare is the most reliable way to detect any change.
        // After a successful save, the component remounts with an updated `initialTemplate`,
        // which resets the `template` state via its initializer. This effect then runs,
        // finds no difference, and correctly sets `isDirty` to false.
        const dirty = JSON.stringify(template) !== JSON.stringify(initialTemplate);
        setIsDirty(dirty);
    }, [template, initialTemplate]);

    useLayoutEffect(() => {
        if (nextCursorPos) {
            const { id, pos } = nextCursorPos;
            const node = elementRefMap.current[id]?.content;
            if (node) {
                node.focus({ preventScroll: true });
                setSelectionByOffset(node, pos.start, pos.end);
            }
            setNextCursorPos(null);
        }
    }, [nextCursorPos]);

    useEffect(() => {
        const style = isInteracting ? 'none' : '';
        document.body.style.userSelect = style;
        document.body.style.webkitUserSelect = style; // For Safari
        
        return () => {
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
        };
    }, [isInteracting]);
    
    const onElementRefsChange = useCallback((id: string, refs: { content?: HTMLDivElement | null; wrapper?: HTMLDivElement | null; }) => {
        if (!elementRefMap.current[id]) {
            elementRefMap.current[id] = {};
        }
        Object.assign(elementRefMap.current[id], refs);
    }, []);

    const updateHistory = useCallback((newTemplate: Template) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push(newTemplate);
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
    }, [historyIndex]);

    const handleTemplateChange = useCallback((newTemplate: Template, withHistory: boolean = true) => {
        setTemplate(newTemplate);
        if (withHistory) {
            updateHistory(newTemplate);
        }
    }, [updateHistory]);
    
    const findElementUnder = useCallback((cutterEl: CutterElement, allElements: CanvasElement[]): CanvasElement | null => {
        const sortedElements = allElements
            .filter(el => el.id !== cutterEl.id && (el.type === 'image' || el.type === 'text'))
            .sort((a, b) => b.zIndex - a.zIndex);
    
        for (const el of sortedElements) {
            // 1. Define ellipse (cutter) and rectangle (el) properties in world coordinates.
            const cutterCenter = { x: cutterEl.x + cutterEl.width / 2, y: cutterEl.y + cutterEl.height / 2 };
            const cutterRadii = { a: cutterEl.width / 2, b: cutterEl.height / 2 };
            if (cutterRadii.a <= 0 || cutterRadii.b <= 0) continue; // Skip if cutter has no area
            const cutterAngleRad = cutterEl.rotation * (Math.PI / 180);
    
            const rectCenter = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
            const rectHalfSize = { w: el.width / 2, h: el.height / 2 };
            const rectAngleRad = el.rotation * (Math.PI / 180);
    
            // 2. Get rectangle's corner vertices in world coordinates.
            const rectCorners = [
                { x: -rectHalfSize.w, y: -rectHalfSize.h },
                { x:  rectHalfSize.w, y: -rectHalfSize.h },
                { x:  rectHalfSize.w, y:  rectHalfSize.h },
                { x: -rectHalfSize.w, y:  rectHalfSize.h }
            ].map(p => {
                const cosRect = Math.cos(rectAngleRad);
                const sinRect = Math.sin(rectAngleRad);
                const rotatedX = p.x * cosRect - p.y * sinRect;
                const rotatedY = p.x * sinRect + p.y * cosRect;
                return { x: rotatedX + rectCenter.x, y: rotatedY + rectCenter.y };
            });
    
            // 3. Transform rectangle's vertices into the ellipse's "squashed" space where it becomes a circle.
            const circleRadius = cutterRadii.a;
            const scaleY = cutterRadii.b > 0 ? cutterRadii.a / cutterRadii.b : 0;
    
            const transformedCorners = rectCorners.map(p => {
                // a. Translate so ellipse's center is the origin
                let tx = p.x - cutterCenter.x;
                let ty = p.y - cutterCenter.y;
    
                // b. Rotate into ellipse's local coordinate system (un-rotate the world)
                const cosCutter = Math.cos(-cutterAngleRad);
                const sinCutter = Math.sin(-cutterAngleRad);
                let rx = tx * cosCutter - ty * sinCutter;
                let ry = tx * sinCutter + ty * cosCutter;
                
                // c. Scale Y-axis to transform ellipse into a circle
                let scaledY = ry * scaleY;
                
                return { x: rx, y: scaledY };
            });
    
            // 4. Check for intersection between the transformed polygon and a circle centered at (0,0) with radius `circleRadius`.
            
            // 4a. Check if circle center (origin) is inside the transformed polygon.
            let isOriginInside = false;
            for (let i = 0, j = transformedCorners.length - 1; i < transformedCorners.length; j = i++) {
                const p1 = transformedCorners[i];
                const p2 = transformedCorners[j];
                const isBetweenY = (p1.y > 0) !== (p2.y > 0);
                if (isBetweenY) {
                     const xIntersection = (p2.x - p1.x) * (0 - p1.y) / (p2.y - p1.y) + p1.x;
                     if (xIntersection > 0) { // Ray goes to positive X
                         isOriginInside = !isOriginInside;
                     }
                }
            }
            if (isOriginInside) return el;
    
            // 4b. Check if any edge of the polygon intersects the circle.
            for (let i = 0, j = transformedCorners.length - 1; i < transformedCorners.length; j = i++) {
                const p1 = transformedCorners[i];
                const p2 = transformedCorners[j];
    
                const edgeVec = { x: p2.x - p1.x, y: p2.y - p1.y };
                const p1ToOriginVec = { x: -p1.x, y: -p1.y };
    
                const edgeLenSq = edgeVec.x * edgeVec.x + edgeVec.y * edgeVec.y;
                if (edgeLenSq === 0) continue; 
    
                const dot = p1ToOriginVec.x * edgeVec.x + p1ToOriginVec.y * edgeVec.y;
                const t = Math.max(0, Math.min(1, dot / edgeLenSq));
                
                const closestPoint = { 
                    x: p1.x + t * edgeVec.x, 
                    y: p1.y + t * edgeVec.y 
                };
    
                const distSq = closestPoint.x * closestPoint.x + closestPoint.y * closestPoint.y;
                
                if (distSq <= circleRadius * circleRadius) return el;
            }
        }
        return null;
    }, []);
    
    const handleInteractionEnd = useCallback(() => {
        updateHistory(templateRef.current);
        setIsInteracting(false);
        setSnapLines({ x: [], y: [] });
        setCutterTargetId(null);
    }, [updateHistory]);

    const updateElement = (id: string, updates: Partial<CanvasElement> & { textContent?: string }, withHistory: boolean = true, cursorPos?: { start: number; end: number }) => {
        const newElements = template.elements.map(el => {
            if (el.id !== id) return el;
    
            if (el.type === ElementType.Text) {
                const { textContent, ...restOfUpdates } = updates;
                let spans = el.spans;
    
                if (textContent !== undefined) {
                    const oldText = el.spans.map(s => s.text).join('');
                    const newText = textContent;
    
                    if (oldText === newText) {
                        spans = el.spans;
                    } else {
                        let prefixLen = 0;
                        while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
                            prefixLen++;
                        }
    
                        let suffixLen = 0;
                        while (
                            suffixLen < oldText.length - prefixLen &&
                            suffixLen < newText.length - prefixLen &&
                            oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
                        ) {
                            suffixLen++;
                        }
    
                        const newMiddleText = newText.substring(prefixLen, newText.length - suffixLen);
                        
                        let styleForMiddle: TextStyle = el.spans[0]?.style || { fontFamily: 'Heebo', fontSize: 16, fontWeight: 400, color: '#FFFFFF', textShadow: '', lineHeight: 1.2 };
                        let currentIndex = 0;
                        for (const span of el.spans) {
                            const spanEnd = currentIndex + span.text.length;
                            if (prefixLen >= currentIndex && prefixLen <= spanEnd) {
                                styleForMiddle = span.style;
                                break;
                            }
                             if (el.spans.length > 0 && prefixLen > spanEnd) { 
                                styleForMiddle = el.spans[el.spans.length - 1].style;
                            }
                            currentIndex = spanEnd;
                        }
                        
                        const prefixSpans: TextSpan[] = [];
                        const suffixSpans: TextSpan[] = [];
                        currentIndex = 0;
    
                        for (const span of el.spans) {
                            const spanStart = currentIndex;
                            const spanEnd = spanStart + span.text.length;
    
                            if (spanEnd <= prefixLen) {
                                prefixSpans.push({ ...span });
                            } else if (spanStart < prefixLen) {
                                const part = span.text.substring(0, prefixLen - spanStart);
                                prefixSpans.push({ text: part, style: span.style });
                            }
                            
                            if (spanStart >= oldText.length - suffixLen) {
                                suffixSpans.push({ ...span });
                            } else if (spanEnd > oldText.length - suffixLen) {
                                const part = span.text.substring(oldText.length - suffixLen - spanStart);
                                suffixSpans.push({ text: part, style: span.style });
                            }
                            
                            currentIndex = spanEnd;
                        }
                        
                        const middleSpan: TextSpan[] = newMiddleText ? [{ text: newMiddleText, style: styleForMiddle }] : [];
    
                        const combinedSpans = [...prefixSpans, ...middleSpan, ...suffixSpans];
                        
                        const mergedSpans: TextSpan[] = [];
                        if (combinedSpans.length > 0) {
                            mergedSpans.push(combinedSpans[0]);
                            for (let i = 1; i < combinedSpans.length; i++) {
                                const prev = mergedSpans[mergedSpans.length - 1];
                                const current = combinedSpans[i];
                                if (current.text && JSON.stringify(prev.style) === JSON.stringify(current.style)) {
                                    prev.text += current.text;
                                } else if (current.text) {
                                    mergedSpans.push(current);
                                }
                            }
                        }
                        spans = mergedSpans.filter(s => s.text.length > 0);
                        
                        if (spans.length === 0) {
                             spans.push({ text: '', style: styleForMiddle });
                        }
                        
                        // Fix: Sanitize the newly constructed spans to ensure they have a complete style object.
                        // This prevents crashes when an incomplete style (e.g., missing `fontSize`) is passed to other components.
                        spans = spans.map(s => ({ ...s, style: { ...defaultTextStyle, ...s.style } }));
                    }
                }
    
                return { ...el, ...restOfUpdates, spans } as TextElement;
            }

            // Fix: Cast the result to the specific element type. This is necessary because the `updates` object's type
            // is a broad partial of all possible canvas elements. Spreading it widens the type of the resulting
            // object in a way TypeScript cannot reconcile without a cast. This pattern is consistent with how
            // TextElement updates are handled above.
            if (el.type === ElementType.Image) {
                const updatedElement: ImageElement = { ...el, ...updates } as ImageElement;
                return updatedElement;
            }
            if (el.type === ElementType.Cutter) {
                const updatedElement: CutterElement = { ...el, ...updates } as CutterElement;
                return updatedElement;
            }
            return el;
        });

        const movedElement = newElements.find(el => el.id === id);
        if (movedElement) {
            if (movedElement.type === ElementType.Cutter) {
                const cutterElement = movedElement as CutterElement;
                const target = findElementUnder(cutterElement, newElements);
                setCutterTargetId(target ? target.id : null);

                // Save cutter state to sessionStorage for persistence within the session
                const { x, y, width, height, rotation } = cutterElement;
                const stateToSave = { x, y, width, height, rotation };
                const storageKey = `cutterState_${template.id}`;
                try {
                    sessionStorage.setItem(storageKey, JSON.stringify(stateToSave));
                } catch (e) {
                    console.error("Failed to save cutter state to sessionStorage", e);
                }
            }
        }

        handleTemplateChange({ ...template, elements: newElements }, withHistory);

        if (cursorPos) {
            setNextCursorPos({ id, pos: cursorPos });
        }

        if (updates.id && updates.id !== id && selectedElementId === id) {
            setSelectedElementId(updates.id as string);
        }
    };

    const handleStyleUpdate = (styleUpdate: Partial<TextStyle>) => {
        if (!selectedElementId) return;
    
        const newElements = template.elements.map(el => {
            if (el.id === selectedElementId && el.type === ElementType.Text) {
                // If no specific text is selected (i.e., the whole element frame is selected),
                // create a range that covers the entire text content to apply the style globally.
                // Otherwise, use the existing selection range (which could be a cursor position).
                const rangeToStyle = selectionRange === null
                    ? { start: 0, end: el.spans.reduce((acc, span) => acc + span.text.length, 0) }
                    : selectionRange;

                const newSpans = applyStyleToSpans(el.spans, rangeToStyle, styleUpdate);
                const updatedElement: TextElement = { ...el, spans: newSpans };
                return updatedElement;
            }
            return el;
        });
    
        handleTemplateChange({ ...template, elements: newElements });
    
        // After updating, restore the selection if one existed to maintain user context.
        setTimeout(() => {
            const node = elementRefMap.current[selectedElementId]?.content;
            if (node && selectionRange) {
                node.focus({ preventScroll: true });
                setSelectionByOffset(node, selectionRange.start, selectionRange.end);
            }
        }, 0);
    };

    const addElement = (type: ElementType, payload?: { src: string }) => {
        const newZIndex = template.elements.length > 0 ? Math.max(...template.elements.map(e => e.zIndex)) + 1 : 1;
        let newElement: CanvasElement;
        const newId = `el_${Date.now()}`;

        if (type === ElementType.Text) {
            const elementWidth = 300;
            const elementHeight = 100;
            newElement = {
                id: newId,
                type: ElementType.Text,
                x: (template.width - elementWidth) / 2,
                y: (template.height - elementHeight) / 2,
                width: elementWidth,
                height: elementHeight,
                rotation: 0,
                zIndex: newZIndex,
                spans: [{
                    text: 'טקסט לדוגמה',
                    style: {
                        ...defaultTextStyle,
                        fontSize: 48,
                        fontWeight: 700,
                    }
                }],
                textAlign: 'right',
                verticalAlign: 'middle',
                letterSpacing: 0,
                backgroundColor: 'transparent',
                padding: 10,
                backgroundShape: 'rectangle',
                outline: {
                    enabled: false,
                    color: '#FFFFFF',
                    width: 2,
                }
            } as TextElement;
        } else if (type === ElementType.Cutter) {
            const storageKey = `cutterState_${template.id}`;
            const savedStateJSON = sessionStorage.getItem(storageKey);
            let savedState = null;
            if (savedStateJSON) {
                try {
                    savedState = JSON.parse(savedStateJSON);
                } catch (e) {
                    console.error("Failed to parse cutter state from sessionStorage", e);
                }
            }
            const defaultSize = 250;
            newElement = {
                id: newId,
                type: ElementType.Cutter,
                x: savedState?.x ?? (template.width - defaultSize) / 2,
                y: savedState?.y ?? (template.height - defaultSize) / 2,
                width: savedState?.width ?? defaultSize,
                height: savedState?.height ?? defaultSize,
                rotation: savedState?.rotation ?? 0,
                zIndex: 9999, // Always on top
            } as CutterElement;
        } else { // Image
            const elementWidth = 400;
            const elementHeight = 300;
            newElement = {
                id: newId,
                type: ElementType.Image,
                x: (template.width - elementWidth) / 2,
                y: (template.height - elementHeight) / 2,
                width: elementWidth,
                height: elementHeight,
                rotation: 0,
                zIndex: newZIndex,
                src: payload?.src || null,
                originalSrc: payload?.src || null,
                objectFit: 'cover',
            } as ImageElement;
        }
        
        const newElements = [...template.elements, newElement];
        handleTemplateChange({ ...template, elements: newElements });
        setSelectedElementId(newId);

        if (type === ElementType.Image && payload?.src) {
            passUpImageEdit(newElement as ImageElement, payload.src);
        }
    };
    
    const passUpImageEdit = (element: ImageElement, newSrc?: string) => {
        onEditImage(element, template, newSrc);
    };

    const deleteElement = (id: string) => {
        const newElements = template.elements.filter(el => el.id !== id);
        handleTemplateChange({ ...template, elements: newElements });
        setSelectedElementId(null);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setTemplate(history[newIndex]);
        }
    };
    
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setTemplate(history[newIndex]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        handleSelectElement(null);
        await new Promise(resolve => setTimeout(resolve, 50));
    
        let previewImage: string | undefined = template.previewImage || undefined;
        
        if (canvasRef.current && (window as any).htmlToImage) {
            try {
                previewImage = await (window as any).htmlToImage.toPng(canvasRef.current, {
                    pixelRatio: 2, // For better quality on high-DPI screens
                    fontEmbedCSS: fontCss ?? undefined,
                });
            } catch (e) {
                console.error("html-to-image failed for preview:", e);
            }
        }
        
        await onSaveTemplate({ ...template }, previewImage);
        setIsSaving(false);
        // On success, page will navigate away or update state
    };

    const handleApplyCut = async () => {
        const cutter = template.elements.find(el => el.id === selectedElementId && el.type === ElementType.Cutter) as CutterElement | undefined;
        if (!cutter) return;
    
        const targetElement = findElementUnder(cutter, template.elements);
        if (!targetElement) {
            alert("לא נמצא אלמנט לחיתוך מתחת לצורה.");
            return;
        }
    
        setIsSaving(true);
    
        let imageToClipSrc: string | null = null;
        let originalSrcForNewElement: string | null = null;
    
        if (targetElement.type === ElementType.Text) {
            const domNode = elementRefMap.current[targetElement.id]?.wrapper;
            if (!domNode || !fontCss) {
                alert("שגיאה בעיבוד אלמנט הטקסט. ודא שהפונטים נטענו.");
                setIsSaving(false);
                return;
            }
            try {
                const capturedImage = await (window as any).htmlToImage.toPng(domNode, {
                    backgroundColor: 'transparent',
                    pixelRatio: 2,
                    fontEmbedCSS: fontCss,
                });
                imageToClipSrc = capturedImage;
                originalSrcForNewElement = capturedImage;
            } catch (e) {
                console.error("html-to-image failed for text element:", e);
                alert("שגיאה בהמרת הטקסט לתמונה.");
                setIsSaving(false);
                return;
            }
        } else if (targetElement.type === ElementType.Image) {
            imageToClipSrc = (targetElement as ImageElement).src;
        }
    
        if (!imageToClipSrc) {
            alert("לא ניתן היה למצוא מקור תמונה לחיתוך.");
            setIsSaving(false);
            return;
        }
    
        const image = new Image();
        image.crossOrigin = "Anonymous";
    
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetElement.width;
            canvas.height = targetElement.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setIsSaving(false);
                return;
            }
    
            ctx.drawImage(image, 0, 0, targetElement.width, targetElement.height);
            ctx.globalCompositeOperation = 'destination-out';
            
            const targetCenter = { x: targetElement.x + targetElement.width / 2, y: targetElement.y + targetElement.height / 2 };
            const cutterCenter = { x: cutter.x + cutter.width / 2, y: cutter.y + cutter.height / 2 };
            const delta = { x: cutterCenter.x - targetCenter.x, y: cutterCenter.y - targetCenter.y };
            const unrotateRad = -targetElement.rotation * (Math.PI / 180);
            const cos_un = Math.cos(unrotateRad);
            const sin_un = Math.sin(unrotateRad);
            const delta_local = { x: delta.x * cos_un - delta.y * sin_un, y: delta.x * sin_un + delta.y * cos_un };
            const cutterCenter_local = { x: targetElement.width / 2 + delta_local.x, y: targetElement.height / 2 + delta_local.y };
            const relativeRotationRad = (cutter.rotation - targetElement.rotation) * (Math.PI / 180);
    
            ctx.save();
            ctx.translate(cutterCenter_local.x, cutterCenter_local.y);
            ctx.rotate(relativeRotationRad);
            
            ctx.beginPath();
            ctx.ellipse(0, 0, cutter.width / 2, cutter.height / 2, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
    
            const clippedDataUrl = canvas.toDataURL('image/png');
            
            let finalElements: CanvasElement[];
            let newSelectedId: string;
    
            if (targetElement.type === ElementType.Image) {
                // Non-destructive update for images
                finalElements = template.elements
                    .map(el => {
                        if (el.id === targetElement.id) {
                            return { ...el, src: clippedDataUrl, objectFit: 'fill' } as ImageElement;
                        }
                        return el;
                    })
                    .filter(el => el.id !== cutter.id);
                
                newSelectedId = targetElement.id;
            } else { // Text element was converted
                const newImageElement: ImageElement = {
                    id: `clipped_${Date.now()}`,
                    type: ElementType.Image,
                    x: targetElement.x,
                    y: targetElement.y,
                    width: targetElement.width,
                    height: targetElement.height,
                    rotation: targetElement.rotation,
                    zIndex: targetElement.zIndex,
                    src: clippedDataUrl,
                    originalSrc: originalSrcForNewElement, // Use the captured full text image
                    objectFit: 'fill',
                    editState: null,
                };
    
                finalElements = template.elements
                    .filter(el => el.id !== cutter.id && el.id !== targetElement.id)
                    .concat(newImageElement);
                    
                newSelectedId = newImageElement.id;
            }
    
            handleTemplateChange({ ...template, elements: finalElements });
            setSelectedElementId(newSelectedId);
            setIsSaving(false);
        };
    
        image.onerror = () => {
            alert("שגיאה בטעינת התמונה לחיתוך.");
            setIsSaving(false);
        };
    
        image.src = imageToClipSrc;
    };


    const handleLayerOrderChange = (elementId: string, direction: 'front' | 'back' | 'forward' | 'backward') => {
        let elements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
        const currentIndex = elements.findIndex(el => el.id === elementId);
    
        if (currentIndex === -1) return;
    
        if (direction === 'forward') {
            if (currentIndex < elements.length - 1) {
                [elements[currentIndex], elements[currentIndex + 1]] = [elements[currentIndex + 1], elements[currentIndex]];
            }
        } else if (direction === 'backward') {
            if (currentIndex > 0) {
                [elements[currentIndex], elements[currentIndex - 1]] = [elements[currentIndex - 1], elements[currentIndex]];
            }
        } else if (direction === 'front') {
            const [element] = elements.splice(currentIndex, 1);
            elements.push(element);
        } else if (direction === 'back') {
            const [element] = elements.splice(currentIndex, 1);
            elements.unshift(element);
        }
        
        const finalElements = elements.map((el, index) => ({
            ...el,
            zIndex: index + 1,
        }));
    
        handleTemplateChange({ ...template, elements: finalElements });
    };

    const selectedElement = template.elements.find(el => el.id === selectedElementId) || null;

    const activeStyle = useMemo(() => {
        if (selectedElement?.type !== ElementType.Text || !selectionRange) {
            return selectedElement?.type === ElementType.Text ? selectedElement.spans[0]?.style || null : null;
        }

        let charIndex = 0;
        for (const span of selectedElement.spans) {
            const spanEnd = charIndex + span.text.length;
            if (selectionRange.start >= charIndex && selectionRange.start < spanEnd) {
                return span.style;
            }
            charIndex = spanEnd;
        }
        return selectedElement.spans[0]?.style || null;
    }, [selectedElement, selectionRange]);
    
    const handleSelectElement = useCallback((id: string | null) => {
        const previouslySelectedId = selectedElementId;
    
        // If the selection is changing and the previously selected element was a Cutter, delete it.
        if (previouslySelectedId && previouslySelectedId !== id) {
            const previousElement = templateRef.current.elements.find(el => el.id === previouslySelectedId);
            if (previousElement && previousElement.type === ElementType.Cutter) {
                const newElements = templateRef.current.elements.filter(el => el.id !== previouslySelectedId);
                // This updates the template and history, and triggers a re-render
                handleTemplateChange({ ...templateRef.current, elements: newElements });
            }
        }
        
        const newSelectedElement = id ? templateRef.current.elements.find(el => el.id === id) : null;
        if (!newSelectedElement || newSelectedElement.type !== ElementType.Cutter) {
            setCutterTargetId(null);
        }

        // Standard selection logic
        if (id !== previouslySelectedId) {
            // Deselect any text that might be selected in the window.
            window.getSelection()?.removeAllRanges();
        }
        setSelectedElementId(id);
        setSelectionRange(null);
    }, [selectedElementId, handleTemplateChange]);
    
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleSelectElement(null);
        }
    };

    const handleExportPNG = async () => {
        if (canvasRef.current && (window as any).htmlToImage && (window as any).saveAs) {
            handleSelectElement(null);
            await new Promise(resolve => setTimeout(resolve, 50)); // Wait for re-render
            try {
                const blob = await (window as any).htmlToImage.toBlob(canvasRef.current, {
                    pixelRatio: 3, // Use higher quality for export
                    fontEmbedCSS: fontCss ?? undefined,
                });
                if (blob) {
                    (window as any).saveAs(blob, `${template.name}.png`);
                }
            } catch (e) {
                console.error("Error exporting to PNG with html-to-image:", e);
                alert("שגיאה בייצוא התמונה. נסה שוב.");
            }
        }
    };

    const handleExportJSON = () => {
        const exportData = {
            width: template.width,
            height: template.height,
            backgroundColor: template.background_color,
            items: template.elements,
        };

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(exportData, null, 2)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `${template.name}.json`;
        link.click();
    };

    const updateTemplateSettings = (settings: Partial<Template>) => {
        handleTemplateChange({ ...template, ...settings });
    };

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden" dir="rtl">
            <div className="flex-grow flex flex-col">
                <header className="bg-slate-800 px-4 py-2 flex justify-between items-center text-white border-b border-slate-700">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/templates')} className="flex items-center gap-2 font-bold text-lg">
                            <MagazineIcon className="w-6 h-6 text-blue-400" />
                            איחולן
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            <UndoIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            <RedoIcon className="w-5 h-5"/>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving || !isDirty} 
                            className={`bg-green-600 hover:bg-green-700 text-sm font-medium py-2 px-4 rounded-md transition-all duration-200 disabled:opacity-50 ${isDirty ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-red-500' : ''}`}
                        >
                            {isSaving ? 'שומר...' : 'שמור'}
                        </button>
                        <button onClick={handleExportJSON} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-2 px-4 rounded-md transition-colors">
                            ייצא קובץ
                        </button>
                        <button onClick={handleExportPNG} className="bg-blue-600 hover:bg-blue-700 text-sm font-medium py-2 px-4 rounded-md transition-colors">
                            שמור כתמונה
                        </button>
                    </div>
                </header>
                <main className="flex-grow bg-slate-900 flex items-start justify-center p-8 overflow-auto">
                    <div
                        ref={canvasRef}
                        className="shadow-2xl relative"
                        style={{
                            width: `${template.width}px`,
                            height: `${template.height}px`,
                            backgroundColor: template.background_color,
                        }}
                        onMouseDown={handleCanvasMouseDown}
                    >
                        {template.elements.map(element => (
                            <CanvasItem 
                                key={element.id}
                                element={element}
                                isSelected={selectedElementId === element.id}
                                isCutterTarget={cutterTargetId === element.id}
                                onSelect={() => handleSelectElement(element.id)}
                                onUpdate={updateElement}
                                onInteractionStart={() => setIsInteracting(true)}
                                onInteractionEnd={handleInteractionEnd}
                                onTextSelect={setSelectionRange}
                                onElementRefsChange={onElementRefsChange}
                                onEditImage={passUpImageEdit}
                                canvasWidth={template.width}
                                canvasHeight={template.height}
                                otherElements={template.elements.filter(e => e.id !== element.id)}
                                setSnapLines={setSnapLines}
                            />
                        ))}
                        {snapLines.x.map((x, i) => (
                            <div key={`snap-x-${i}`} className="absolute bg-red-500 opacity-75" style={{ left: x, top: 0, width: 1, height: '100%', zIndex: 9999 }} />
                        ))}
                        {snapLines.y.map((y, i) => (
                            <div key={`snap-y-${i}`} className="absolute bg-red-500 opacity-75" style={{ top: y, left: 0, height: 1, width: '100%', zIndex: 9999 }} />
                        ))}
                    </div>
                </main>
            </div>
            <Sidebar
                selectedElement={selectedElement}
                onUpdateElement={updateElement}
                onStyleUpdate={handleStyleUpdate}
                activeStyle={activeStyle}
                onAddElement={addElement}
                onDeleteElement={deleteElement}
                template={template}
                onUpdateTemplate={updateTemplateSettings}
                onEditImage={passUpImageEdit}
                onDeselect={() => handleSelectElement(null)}
                onLayerOrderChange={handleLayerOrderChange}
                onApplyCut={handleApplyCut}
                isApplyingCut={isSaving}
            />
        </div>
    );
};

export default MagazineEditor;