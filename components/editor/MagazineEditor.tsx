import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextSpan, TextStyle, CutterElement, ImageEditState } from '../../types';
import { ElementType } from '../../types';
import Sidebar from './Sidebar';
import { UndoIcon, RedoIcon, MagazineIcon, CameraIcon, EditIcon, SpinnerIcon, SaveIcon, ExportIcon, LockIcon, UnlockIcon, XIcon, MenuIcon, MaximizeIcon, MinimizeIcon } from '../Icons';
import CanvasItem, { applyStyleToSpans, setSelectionByOffset, defaultTextStyle } from '../CanvasItem';
import { useFonts } from '../fonts/FontLoader';


interface MagazineEditorProps {
    initialTemplate: Template;
    onEditImage: (element: ImageElement, newSrc?: string) => void;
    onSaveTemplate: (template: Template, newPreview: string | undefined) => Promise<void>;
}

export interface MagazineEditorHandle {
    updateTemplateFromParent: (newTemplate: Template) => void;
    applyImageEdit: (elementId: string, data: { newSrc: string; newOriginalSrc: string; editState: ImageEditState; }) => void;
}

const MagazineEditor = forwardRef<MagazineEditorHandle, MagazineEditorProps>(({ initialTemplate, onEditImage, onSaveTemplate }, ref) => {
    const navigate = useNavigate();
    const { fontCss } = useFonts();
    const [cutterTargetId, setCutterTargetId] = useState<string | null>(null);
    const [snapLines, setSnapLines] = useState<{ x: number[], y: number[] }>({ x: [], y: [] });
    const [temporaryFontOverride, setTemporaryFontOverride] = useState<{ elementId: string; fontFamily: string } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [template, setTemplate] = useState<Template>(initialTemplate);
    const templateRef = useRef(template);
    templateRef.current = template;
    const templateBeforeImageEdit = useRef<Template | null>(null);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
    const [editingElementId, setEditingElementId] = useState<string | null>(null);
    const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);
    const [history, setHistory] = useState<Template[]>([initialTemplate]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canvasRef = useRef<HTMLDivElement>(null);
    const elementRefMap = useRef<Record<string, {
        content?: HTMLDivElement | null;
        wrapper?: HTMLDivElement | null;
    }>>({});
    const [nextCursorPos, setNextCursorPos] = useState<{ id: string; pos: { start: number; end: number } } | null>(null);

    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [isSavingOnExit, setIsSavingOnExit] = useState(false);
    const [nextLocation, setNextLocation] = useState<string | null>(null);
    const [formatBrushState, setFormatBrushState] = useState<{ active: boolean; sourceElement: TextElement | null }>({ active: false, sourceElement: null });

    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [canvasScale, setCanvasScale] = useState(1);
    const [isFullSize, setIsFullSize] = useState(false);

    useLayoutEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;
    
        const calculateScale = () => {
            if (isFullSize) {
                setCanvasScale(1);
                return;
            }

            if (template.width > 0 && template.height > 0) {
                const style = window.getComputedStyle(container);
                const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

                const availableWidth = container.offsetWidth - paddingX;
                const availableHeight = container.offsetHeight - paddingY;

                const scaleX = availableWidth / template.width;
                const scaleY = availableHeight / template.height;
                const scale = Math.min(1, scaleX, scaleY);
                
                setCanvasScale(scale);
            }
        };
        calculateScale();
    
        const resizeObserver = new ResizeObserver(calculateScale);
        resizeObserver.observe(container);
    
        return () => {
            resizeObserver.unobserve(container);
            resizeObserver.disconnect();
        };
    }, [template.width, template.height, isFullSize]);


    const handleAttemptNavigation = (to: string) => {
        if (isDirty) {
            setNextLocation(to);
            setShowExitConfirm(true);
        } else {
            navigate(to);
        }
    };
    
    // This effect syncs the editor's internal state whenever the `initialTemplate` prop changes.
    // This is crucial for resetting the 'isDirty' flag after a save operation, as the parent
    // component passes the newly saved template data back as the new 'initialTemplate'.
    // By updating the internal `template` state to match, the `isDirty` check will correctly
    // evaluate to false. The undo/redo history is preserved across saves.
    useEffect(() => {
        setTemplate(initialTemplate);
    }, [initialTemplate]);

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

    // Fix: Corrected typo from 'useImperivativeHandle' to 'useImperativeHandle'.
    useImperativeHandle(ref, () => ({
        updateTemplateFromParent: (newTemplate: Template) => {
            handleTemplateChange(newTemplate, true);
        },
        applyImageEdit: (elementId, data) => {
            const baseTemplate = templateBeforeImageEdit.current;
            if (!baseTemplate) return;

            const { newSrc, newOriginalSrc, editState } = data;
            const updatedElements = baseTemplate.elements.map(el =>
                el.id === elementId ? { ...el, src: newSrc, originalSrc: newOriginalSrc, editState: editState } : el
            );
            const newTemplate: Template = { ...baseTemplate, elements: updatedElements as CanvasElement[] };
            handleTemplateChange(newTemplate, true);
            templateBeforeImageEdit.current = null; // Clear the ref
        }
    }), [handleTemplateChange]);
    
    const findElementUnder = useCallback((cutterEl: CutterElement, allElements: CanvasElement[]): CanvasElement | null => {
        const sortedElements = allElements
            .filter(el => el.id !== cutterEl.id && el.type === 'image')
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
        let finalCursorPos = cursorPos; // Create a mutable copy.
    
        const newElements = template.elements.map(el => {
            if (el.id !== id) return el;
    
            if (el.type === ElementType.Text) {
                const { textContent, ...restOfUpdates } = updates;
                let spans = el.spans;
    
                if (textContent !== undefined) {
                    const newText = textContent;
    
                    if (newText === '') {
                        // Bug Fix: When text content is empty, insert a non-breaking space to prevent
                        // the contentEditable element from collapsing, which causes cursor and input issues in RTL.
                        const styleForEmpty = el.spans[0]?.style || defaultTextStyle;
                        spans = [{ text: '\u00A0', style: styleForEmpty }];
                        // Also, force the cursor position to the start of the element for a smooth typing experience.
                        finalCursorPos = { start: 0, end: 0 };
                    } else {
                        const oldText = el.spans.map(s => s.text).join('');
    
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
                            
                            spans = spans.map(s => ({ ...s, style: { ...defaultTextStyle, ...s.style } }));
                        }
                    }
                }
    
                return { ...el, ...restOfUpdates, spans } as TextElement;
            }
    
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
    
        if (finalCursorPos) {
            setNextCursorPos({ id, pos: finalCursorPos });
        }
    
        if (updates.id && updates.id !== id && selectedElementId === id) {
            setSelectedElementId(updates.id as string);
        }
    };

    const handleStyleUpdate = (styleUpdate: Partial<TextStyle>, isPreset: boolean = false) => {
        if (!selectedElementId) return;
    
        const newElements = template.elements.map(el => {
            if (el.id === selectedElementId && el.type === ElementType.Text) {
                // If changing font size with stepper/input (not preset) and no text is selected, apply proportionally.
                if (styleUpdate.fontSize !== undefined && selectionRange === null && !isPreset) {
                    const oldBaseSize = activeStyle?.fontSize || el.spans[0]?.style.fontSize || defaultTextStyle.fontSize;
                    const newBaseSize = styleUpdate.fontSize;

                    if (oldBaseSize > 0 && newBaseSize !== oldBaseSize) {
                        const ratio = newBaseSize / oldBaseSize;
                        const newSpans = el.spans.map(span => ({
                            ...span,
                            style: {
                                ...span.style,
                                fontSize: Math.round((span.style.fontSize * ratio) * 10) / 10,
                            },
                        }));
                        return { ...el, spans: newSpans };
                    }
                    return el; // No change needed
                }
                
                // For all other style changes, or for font size changes from presets or with a selection, apply absolutely.
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

    const handleAlignmentUpdate = (align: 'right' | 'center' | 'left' | 'justify') => {
        if (!selectedElementId) return;

        const isEditing = selectedElementId === editingElementId;
        const element = template.elements.find(el => el.id === selectedElementId) as TextElement;
        if (!element || element.type !== ElementType.Text) return;

        if (!isEditing) {
            // Block-level alignment: update textAlign and clear any line-specific alignments.
            updateElement(selectedElementId, { textAlign: align, lineAlignments: [] });
        } else {
            // Per-line alignment
            const fullText = element.spans.map(s => s.text).join('');
            const lines = fullText.split('\n');
            
            if (!selectionRange) return;

            // Find which lines are affected by the selection
            let selectionStartLine = -1;
            let selectionEndLine = -1;
            let charCount = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineStart = charCount;
                // A line "contains" characters from its start up to its end, including the newline character conceptually
                const lineEnd = lineStart + line.length;
                
                // Check if the selection start point falls within this line
                if (selectionStartLine === -1 && selectionRange.start >= lineStart && selectionRange.start <= lineEnd) {
                    selectionStartLine = i;
                }
                // Check if the selection end point falls within this line
                if (selectionRange.end >= lineStart && selectionRange.end <= lineEnd) {
                    selectionEndLine = i;
                }
                
                charCount += line.length + 1; // +1 for the newline char
            }
            
            // If the cursor is at the very end of the text, it might not be caught by the loop
            if (selectionStartLine === -1 && selectionRange.start > 0 && selectionRange.start >= charCount -1) {
                selectionStartLine = lines.length - 1;
            }
            if (selectionEndLine === -1 && selectionRange.end > 0 && selectionRange.end >= charCount -1) {
                 selectionEndLine = lines.length - 1;
            }

            // A collapsed selection (a cursor) should only affect one line
            if (selectionRange.start === selectionRange.end) {
                selectionEndLine = selectionStartLine;
            }

            if (selectionStartLine === -1) return; // No line found for selection, should not happen

            const newAlignments = [...(element.lineAlignments || [])];
            // Ensure the array is long enough, padding with the element's default alignment
            while (newAlignments.length < lines.length) {
                newAlignments.push(element.textAlign);
            }

            for (let i = selectionStartLine; i <= selectionEndLine; i++) {
                if (i >= 0 && i < newAlignments.length) {
                    newAlignments[i] = align;
                }
            }
            
            updateElement(selectedElementId, { lineAlignments: newAlignments });
        }
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
        setIsSidebarOpen(true);

        if (type === ElementType.Image && payload?.src) {
            handleImageEditRequest(newElement as ImageElement, payload.src);
        }
    };
    
    const handleImageEditRequest = (element: ImageElement, newSrc?: string) => {
        // Store the "before" state
        templateBeforeImageEdit.current = template; 
        // Tell the parent to open the editor
        onEditImage(element, newSrc);
    };

    const deleteElement = (id: string) => {
        const newElements = template.elements.filter(el => el.id !== id);
        handleTemplateChange({ ...template, elements: newElements });
        setSelectedElementId(null);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const currentTemplate = history[historyIndex];
            const previousTemplate = history[historyIndex - 1];
            const newIndex = historyIndex - 1;
    
            setHistoryIndex(newIndex);
            setTemplate(previousTemplate);
    
            // Check if a cutter element was restored by this undo action.
            const currentElementIds = new Set(currentTemplate.elements.map(el => el.id));
            const restoredCutter = previousTemplate.elements.find(el => 
                el.type === ElementType.Cutter && !currentElementIds.has(el.id)
            );
    
            // If a cutter was restored, select it automatically.
            if (restoredCutter) {
                setSelectedElementId(restoredCutter.id);
            }
        }
    };
    
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const currentTemplate = history[historyIndex];
            const nextTemplate = history[historyIndex + 1];
            const newIndex = historyIndex + 1;
    
            // Check if a cutter element is about to be removed by this redo action (i.e., redoing a cut).
            const nextElementIds = new Set(nextTemplate.elements.map(el => el.id));
            const removedCutter = currentTemplate.elements.find(el => 
                el.type === ElementType.Cutter && !nextElementIds.has(el.id)
            );
    
            let newSelectedId: string | null = null;
            if (removedCutter) {
                // Find the image that was under the cutter *before* the cut was applied.
                // Fix: Cast `removedCutter` to `CutterElement` to satisfy the type requirement of the `findElementUnder` function. The type is guaranteed to be correct due to the predicate in the preceding `find` call.
                const targetElement = findElementUnder(removedCutter as CutterElement, currentTemplate.elements);
                if (targetElement) {
                    newSelectedId = targetElement.id;
                }
            }
    
            setHistoryIndex(newIndex);
            setTemplate(nextTemplate);
            
            // If we identified a target image, select it after the state updates.
            if (newSelectedId) {
                setSelectedElementId(newSelectedId);
            }
        }
    };

    const performSave = async () => {
        handleSelectElement(null);
        await new Promise(resolve => setTimeout(resolve, 50));
    
        let previewImage: string | undefined = template.previewImage || undefined;
        
        if (canvasRef.current && (window as any).htmlToImage) {
            try {
                const fullResDataUrl = await (window as any).htmlToImage.toPng(canvasRef.current, {
                    pixelRatio: 1,
                    fontEmbedCSS: fontCss ?? undefined,
                });

                const image = new Image();
                const promise = new Promise<string>((resolve, reject) => {
                    image.onload = () => {
                        const THUMBNAIL_WIDTH = 400;
                        const aspectRatio = image.height / image.width;
                        const thumbnailHeight = Math.round(THUMBNAIL_WIDTH * aspectRatio);

                        const canvas = document.createElement('canvas');
                        canvas.width = THUMBNAIL_WIDTH;
                        canvas.height = thumbnailHeight;
                        const ctx = canvas.getContext('2d');

                        if (ctx) {
                            ctx.drawImage(image, 0, 0, THUMBNAIL_WIDTH, thumbnailHeight);
                            resolve(canvas.toDataURL('image/png'));
                        } else {
                            reject(new Error('Could not get 2D context for thumbnail canvas.'));
                        }
                    };
                    image.onerror = (err) => {
                        console.error('Image loading for thumbnail failed:', err);
                        reject(new Error('Failed to load full-resolution image for resizing.'));
                    };
                    image.src = fullResDataUrl;
                });
                
                previewImage = await promise;

            } catch (e) {
                console.error("html-to-image failed for preview:", e);
            }
        }
        
        await onSaveTemplate({ ...template }, previewImage);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await performSave();
        setIsSaving(false);
    };

    const handleSaveAndLeave = async () => {
        if (nextLocation) {
            setIsSavingOnExit(true);
            await performSave();
            navigate(nextLocation);
        }
    };

    const handleLeaveWithoutSaving = () => {
        if (nextLocation) {
            navigate(nextLocation);
        }
        setShowExitConfirm(false);
    };

    const handleCancelExit = () => {
        setShowExitConfirm(false);
        setNextLocation(null);
    };

    const handleApplyCut = async () => {
        const cutter = template.elements.find(el => el.id === selectedElementId && el.type === ElementType.Cutter) as CutterElement | undefined;
        if (!cutter) return;
    
        const targetElement = findElementUnder(cutter, template.elements) as ImageElement | null;
        if (!targetElement) {
            alert("לא נמצאה תמונה לחיתוך מתחת לצורה.");
            return;
        }

        const imageToClipSrc = targetElement.src;

        if (!imageToClipSrc) {
            alert("לא ניתן לחתוך תמונה ללא מקור.");
            return;
        }
    
        setIsSaving(true);
    
        const image = new Image();
        image.crossOrigin = "Anonymous";
    
        image.onload = () => {
            const scaleFactor = 2.5; // Increase resolution for smoother edges and better quality.
            const canvas = document.createElement('canvas');
            canvas.width = targetElement.width * scaleFactor;
            canvas.height = targetElement.height * scaleFactor;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setIsSaving(false);
                return;
            }
    
            // Enable high-quality image smoothing.
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
    
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-out';
            
            const targetCenter = { x: targetElement.x + targetElement.width / 2, y: targetElement.y + targetElement.height / 2 };
            const cutterCenter = { x: cutter.x + cutter.width / 2, y: cutter.y + cutter.height / 2 };
            const delta = { x: cutterCenter.x - targetCenter.x, y: cutterCenter.y - targetCenter.y };
            const unrotateRad = -targetElement.rotation * (Math.PI / 180);
            const cos_un = Math.cos(unrotateRad);
            const sin_un = Math.sin(unrotateRad);
            const delta_local = { x: delta.x * cos_un - delta.y * sin_un, y: delta.x * sin_un + delta.y * cos_un };
            
            // Scale all coordinates and dimensions for the high-resolution canvas.
            const cutterCenter_local_scaled = {
                x: (targetElement.width / 2 + delta_local.x) * scaleFactor,
                y: (targetElement.height / 2 + delta_local.y) * scaleFactor
            };
            const cutterWidth_scaled = cutter.width * scaleFactor;
            const cutterHeight_scaled = cutter.height * scaleFactor;
            const relativeRotationRad = (cutter.rotation - targetElement.rotation) * (Math.PI / 180);
    
            ctx.save();
            ctx.translate(cutterCenter_local_scaled.x, cutterCenter_local_scaled.y);
            ctx.rotate(relativeRotationRad);
            
            ctx.beginPath();
            ctx.ellipse(0, 0, cutterWidth_scaled / 2, cutterHeight_scaled / 2, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
    
            const clippedDataUrl = canvas.toDataURL('image/png');
            
            // Non-destructive update for images
            const finalElements = template.elements
                .map(el => {
                    if (el.id === targetElement.id) {
                        return { ...el, src: clippedDataUrl, objectFit: 'fill' } as ImageElement;
                    }
                    return el;
                })
                .filter(el => el.id !== cutter.id);
            
            const newSelectedId = targetElement.id;
    
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

    const handleConvertTextToImage = async (elementId: string) => {
        const element = template.elements.find(el => el.id === elementId && el.type === ElementType.Text) as TextElement | undefined;
        if (!element) return;

        setIsSaving(true);
        // Deselect to hide controls before capturing
        const previouslySelected = selectedElementId;
        setSelectedElementId(null);
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for re-render

        const domNode = elementRefMap.current[elementId]?.wrapper;
        if (!domNode || !fontCss || !(window as any).htmlToImage) {
            alert("שגיאה בהכנה לצילום האלמנט.");
            setIsSaving(false);
            setSelectedElementId(previouslySelected); // Reselect
            return;
        }

        try {
            const dataUrl = await (window as any).htmlToImage.toPng(domNode, {
                pixelRatio: 3, // High quality
                fontEmbedCSS: fontCss,
            });

            const newImageElement: ImageElement = {
                id: element.id, // Keep same ID
                type: ElementType.Image,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                rotation: element.rotation,
                zIndex: element.zIndex,
                src: dataUrl,
                originalSrc: dataUrl, // The generated image is the new original
                objectFit: 'fill', // To fit the exact dimensions
                editState: null, // Reset edit state
                locked: element.locked,
            };

            const newElements = template.elements.map(el => (el.id === elementId ? newImageElement : el));
            handleTemplateChange({ ...template, elements: newElements });
            setSelectedElementId(elementId); // Select the new image element
            
        } catch (e) {
            console.error("html-to-image failed for text-to-image conversion:", e);
            alert("שגיאה בהמרת הטקסט לתמונה.");
            setSelectedElementId(previouslySelected); // Reselect original on error
        } finally {
            setIsSaving(false);
        }
    };

    const selectedElement = template.elements.find(el => el.id === selectedElementId) || null;

    const toggleFormatBrush = () => {
        if (!selectedElement || selectedElement.type !== ElementType.Text) {
            setFormatBrushState({ active: false, sourceElement: null });
            return;
        }
    
        setFormatBrushState(prevState => {
            if (prevState.active) {
                return { active: false, sourceElement: null };
            } else {
                return { active: true, sourceElement: selectedElement as TextElement };
            }
        });
    };

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
        const newSelectedElement = id ? templateRef.current.elements.find(el => el.id === id) : null;
    
        // 1. Handle format brush logic first
        if (
            formatBrushState.active &&
            formatBrushState.sourceElement &&
            newSelectedElement?.type === 'text' &&
            newSelectedElement.id !== formatBrushState.sourceElement.id
        ) {
            const source = formatBrushState.sourceElement;
            const target = newSelectedElement as TextElement;

            const blockUpdates: Partial<TextElement> = {
                backgroundColor: source.backgroundColor,
                padding: source.padding,
                backgroundShape: source.backgroundShape,
                outline: source.outline,
                letterSpacing: source.letterSpacing,
            };

            const sourceStyle = source.spans[0]?.style || defaultTextStyle;
            const styleUpdates: Partial<TextStyle> = {
                fontFamily: sourceStyle.fontFamily,
                fontSize: sourceStyle.fontSize,
                fontWeight: sourceStyle.fontWeight,
                color: sourceStyle.color,
                textShadow: sourceStyle.textShadow,
                lineHeight: sourceStyle.lineHeight,
            };

            const newTargetSpans = target.spans.map(span => ({
                ...span,
                style: { ...span.style, ...styleUpdates }
            }));

            const finalTargetElement = { ...target, ...blockUpdates, spans: newTargetSpans };
            const newElements = templateRef.current.elements.map(el => (el.id === target.id ? finalTargetElement : el));

            handleTemplateChange({ ...templateRef.current, elements: newElements });
            setFormatBrushState({ active: false, sourceElement: null });
        }

        // If the selection is changing and the previously selected element was a Cutter, delete it.
        if (previouslySelectedId && previouslySelectedId !== id) {
            const previousElement = templateRef.current.elements.find(el => el.id === previouslySelectedId);
            if (previousElement && previousElement.type === ElementType.Cutter) {
                const newElements = templateRef.current.elements.filter(el => el.id !== previouslySelectedId);
                // This updates the template and history, and triggers a re-render
                handleTemplateChange({ ...templateRef.current, elements: newElements });
            }
        }
        
        const currentSelectedElement = id ? templateRef.current.elements.find(el => el.id === id) : null;
        if (!currentSelectedElement || currentSelectedElement.type !== ElementType.Cutter) {
            setCutterTargetId(null);
        }

        // Standard selection logic
        if (id !== previouslySelectedId) {
            // Deselect any text that might be selected in the window.
            window.getSelection()?.removeAllRanges();
        }
        setSelectedElementId(id);
        setSelectionRange(null);
        if (id !== previouslySelectedId) {
            setEditingElementId(null);
        }
    }, [selectedElementId, handleTemplateChange, formatBrushState]);
    
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current) {
            handleSelectElement(null);
        }
    };

    const handleDownloadImage = async () => {
        setIsGeneratingImage(true);
        handleSelectElement(null);
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for re-render to hide selection box

        if (canvasRef.current && (window as any).htmlToImage && (window as any).saveAs) {
            try {
                const dataUrl = await (window as any).htmlToImage.toPng(canvasRef.current, {
                    pixelRatio: 3, // High quality for preview & save
                    fontEmbedCSS: fontCss ?? undefined,
                });
                
                // Use FileSaver.js to trigger download
                fetch(dataUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        (window as any).saveAs(blob, `${template.name || 'design'}.png`);
                    })
                    .catch(e => {
                        console.error("Error converting data URL to blob for saving:", e);
                        alert("שגיאה בהכנת התמונה להורדה.");
                    });
                
            } catch (e) {
                console.error("html-to-image failed for download:", e);
                alert("שגיאה ביצירת תמונה להורדה.");
            }
        } else {
             alert("ספריה חסרה, לא ניתן להוריד את התמונה.");
        }
        setIsGeneratingImage(false);
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

    const handleSetTemporaryFont = (fontFamily: string) => {
        if (selectedElementId) {
            setTemporaryFontOverride({ elementId: selectedElementId, fontFamily });
        }
    };

    const handleClearTemporaryFont = () => {
        setTemporaryFontOverride(null);
    };

    const allElementsLocked = template.elements.length > 0 && template.elements.every(el => el.locked);

    const handleToggleAllLocks = () => {
        if (template.elements.length === 0) return;
        const shouldLockAll = !allElementsLocked;
        const newElements = template.elements.map(el => ({ ...el, locked: shouldLockAll }));
        handleTemplateChange({ ...template, elements: newElements });
    };

    return (
        <div className="flex flex-col h-screen bg-slate-900 overflow-hidden" dir="rtl">
            <header className="bg-slate-800 px-4 py-2 flex justify-between items-center text-white border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleAttemptNavigation('/templates')} className="flex items-center gap-2 font-bold text-lg">
                        <MagazineIcon className="w-6 h-6 text-blue-400" />
                        <span className="hidden sm:inline">איחולן</span>
                    </button>
                </div>
                {/* Mobile-only controls */}
                <div className="flex md:hidden items-center gap-4">
                    <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <UndoIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <RedoIcon className="w-5 h-5"/>
                    </button>
                    <button
                        onClick={handleDownloadImage}
                        disabled={isGeneratingImage}
                        className="p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait bg-slate-700 hover:bg-slate-600 text-white"
                        title="הורד תמונה"
                    >
                        {isGeneratingImage ? (
                            <SpinnerIcon className="w-5 h-5 animate-spin" />
                        ) : (
                            <CameraIcon className="w-5 h-5" />
                        )}
                    </button>
                </div>
                {/* Desktop-only controls */}
                <div className="hidden md:flex items-center gap-4">
                    <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <UndoIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <RedoIcon className="w-5 h-5"/>
                    </button>
                    <div className="h-6 w-px bg-slate-600" />
                    <button
                        onClick={() => setIsFullSize(prev => !prev)}
                        className="p-2 rounded-md transition-colors bg-slate-700 hover:bg-slate-600"
                        title={isFullSize ? "הצג בהתאמה לחלון" : "הצג בגודל מלא"}
                    >
                        {isFullSize ? <MinimizeIcon className="w-5 h-5" /> : <MaximizeIcon className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={handleExportJSON} 
                        title="ייצא קובץ"
                        className="bg-slate-700 hover:bg-slate-600 p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <ExportIcon className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={handleToggleAllLocks}
                        disabled={template.elements.length === 0}
                        className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${allElementsLocked ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title={allElementsLocked ? "שחרר את כל הרכיבים" : "נעל את כל הרכיבים"}
                    >
                        {allElementsLocked ? <UnlockIcon className="w-5 h-5"/> : <LockIcon className="w-5 h-5"/>}
                    </button>
                    <button
                        onClick={handleDownloadImage}
                        disabled={isGeneratingImage}
                        className="p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait bg-slate-700 hover:bg-slate-600 text-white"
                        title="הורד תמונה"
                    >
                        {isGeneratingImage ? (
                            <SpinnerIcon className="w-5 h-5 animate-spin" />
                        ) : (
                            <CameraIcon className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || !isDirty} 
                        title={isSaving ? 'שומר...' : 'שמור'}
                        className={`bg-green-600 hover:bg-green-700 text-white font-bold p-2 rounded-md transition-all duration-200 disabled:opacity-50 ${isDirty ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-red-500' : ''}`}
                    >
                        {isSaving ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded hover:bg-slate-700 md:hidden" aria-label="פתח תפריט עריכה">
                        <MenuIcon className="w-5 h-5"/>
                    </button>
                </div>
            </header>
            <div className="flex-grow flex overflow-hidden">
                <main
                    ref={canvasContainerRef}
                    className={`flex-grow bg-slate-900 flex p-4 sm:p-8 ${isFullSize ? 'overflow-auto justify-center items-start' : 'overflow-hidden justify-center items-center'}`}
                >
                    <div
                        ref={canvasRef}
                        className="shadow-2xl relative flex-shrink-0"
                        style={{
                            width: `${template.width}px`,
                            height: `${template.height}px`,
                            backgroundColor: template.background_color,
                            transform: `scale(${canvasScale})`,
                            transformOrigin: 'center',
                        }}
                        onMouseDown={handleCanvasMouseDown}
                    >
                        {template.elements.map(element => (
                            <CanvasItem 
                                key={element.id}
                                element={element}
                                isSelected={selectedElementId === element.id}
                                isEditing={editingElementId === element.id}
                                isHoveredFromSidebar={hoveredElementId === element.id}
                                isCutterTarget={cutterTargetId === element.id}
                                onSelect={() => handleSelectElement(element.id)}
                                isInteracting={isInteracting}
                                onUpdate={updateElement}
                                onInteractionStart={() => setIsInteracting(true)}
                                onInteractionEnd={handleInteractionEnd}
                                onSetSelectionRange={setSelectionRange}
                                onSetEditing={setEditingElementId}
                                onElementRefsChange={onElementRefsChange}
                                onEditImage={handleImageEditRequest}
                                canvasWidth={template.width}
                                canvasHeight={template.height}
                                otherElements={template.elements.filter(e => e.id !== element.id)}
                                setSnapLines={setSnapLines}
                                activeStyle={selectedElementId === element.id ? activeStyle : null}
                                formatBrushState={formatBrushState}
                                temporaryFontOverride={temporaryFontOverride}
                                canvasScale={canvasScale}
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
                <Sidebar
                    selectedElement={selectedElement}
                    isEditing={editingElementId === selectedElementId}
                    onUpdateElement={updateElement}
                    onStyleUpdate={handleStyleUpdate}
                    onAlignmentUpdate={handleAlignmentUpdate}
                    activeStyle={activeStyle}
                    onAddElement={addElement}
                    onDeleteElement={deleteElement}
                    template={template}
                    onUpdateTemplate={updateTemplateSettings}
                    onEditImage={handleImageEditRequest}
                    onDeselect={() => handleSelectElement(null)}
                    onLayerOrderChange={handleLayerOrderChange}
                    onApplyCut={handleApplyCut}
                    isApplyingCut={isSaving}
                    onSelectElement={handleSelectElement}
                    onHoverElement={setHoveredElementId}
                    formatBrushState={formatBrushState}
                    onToggleFormatBrush={toggleFormatBrush}
                    onConvertTextToImage={handleConvertTextToImage}
                    onSetTemporaryFont={handleSetTemporaryFont}
                    onClearTemporaryFont={handleClearTemporaryFont}
                    isMobileOpen={isSidebarOpen}
                    onMobileClose={() => setIsSidebarOpen(false)}
                />
            </div>
            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[50000] flex items-center justify-center" dir="rtl">
                    <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">שינויים שלא נשמרו</h3>
                        <p className="text-slate-300 mb-6">
                            ערכת את התבנית, אך השינויים עדיין לא נשמרו. מה תרצה לעשות?
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={handleCancelExit}
                                className="px-6 py-2 rounded-md text-sm font-medium bg-slate-600 hover:bg-slate-500 transition-colors"
                            >
                                בטל
                            </button>
                            <button
                                onClick={handleLeaveWithoutSaving}
                                className="px-6 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                צא ללא שמירה
                            </button>
                            <button
                                onClick={handleSaveAndLeave}
                                disabled={isSavingOnExit}
                                className="px-6 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isSavingOnExit ? 'שומר...' : 'שמור וצא'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default MagazineEditor;