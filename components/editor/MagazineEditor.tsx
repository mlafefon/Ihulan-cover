import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextSpan, TextStyle, CutterElement } from '../../types';
import { ElementType } from '../../types';
import Sidebar from './Sidebar';
import { UndoIcon, RedoIcon, MagazineIcon } from '../Icons';
import CanvasItem, { applyStyleToSpans, setSelectionByOffset } from '../CanvasItem';


interface MagazineEditorProps {
    initialTemplate: Template;
    onEditImage: (element: ImageElement, currentTemplate: Template, newSrc?: string) => void;
    onSaveTemplate: (template: Template, newPreview: string | undefined) => Promise<void>;
}

const MagazineEditor: React.FC<MagazineEditorProps> = ({ initialTemplate, onEditImage, onSaveTemplate }) => {
    const navigate = useNavigate();
    const [snapLines, setSnapLines] = useState<{ x: number[], y: number[] }>({ x: [], y: [] });

    const [template, setTemplate] = useState<Template>(initialTemplate);
    const templateRef = useRef(template);
    templateRef.current = template;
    
    const [isSaving, setIsSaving] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);
    const [history, setHistory] = useState<Template[]>([initialTemplate]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canvasRef = useRef<HTMLDivElement>(null);
    const lastSelectionRangeRef = useRef<{ start: number, end: number } | null>(null);
    const textContentRefMap = useRef<Record<string, HTMLDivElement | null>>({});
    const [nextCursorPos, setNextCursorPos] = useState<{ id: string; pos: { start: number; end: number } } | null>(null);

    useLayoutEffect(() => {
        if (nextCursorPos) {
            const { id, pos } = nextCursorPos;
            const node = textContentRefMap.current[id];
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
    
    useEffect(() => {
        if (selectionRange && selectionRange.start !== selectionRange.end) {
            lastSelectionRangeRef.current = selectionRange;
        }
    }, [selectionRange]);
    
    const onTextContentRefChange = useCallback((id: string, node: HTMLDivElement | null) => {
        textContentRefMap.current[id] = node;
    }, []);

    const updateHistory = useCallback((newTemplate: Template) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push(newTemplate);
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
    }, [historyIndex]);

    const handleTemplateChange = (newTemplate: Template, withHistory: boolean = true) => {
        setTemplate(newTemplate);
        if (withHistory) {
            updateHistory(newTemplate);
        }
    }
    
    const handleInteractionEnd = useCallback(() => {
        updateHistory(templateRef.current);
        setIsInteracting(false);
        setSnapLines({ x: [], y: [] });
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
                        
                        let styleForMiddle: TextStyle = el.spans[0]?.style || { fontFamily: 'Heebo', fontSize: 16, fontWeight: 400, color: '#FFFFFF', textShadow: '' };
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
                    }
                }
    
                return { ...el, ...restOfUpdates, spans } as TextElement;
            }

            return { ...el, ...updates };
        });

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
    
        const rangeToStyle = lastSelectionRangeRef.current;
    
        const newElements = template.elements.map(el => {
            if (el.id === selectedElementId && el.type === ElementType.Text) {
                const newSpans = applyStyleToSpans(el.spans, rangeToStyle, styleUpdate);
                return { ...el, spans: newSpans };
            }
            return el;
        });
    
        handleTemplateChange({ ...template, elements: newElements });
    
        setTimeout(() => {
            const node = textContentRefMap.current[selectedElementId];
            if (node && rangeToStyle) {
                node.focus({ preventScroll: true });
                setSelectionByOffset(node, rangeToStyle.start, rangeToStyle.end);
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
                        fontFamily: 'Heebo',
                        fontSize: 48,
                        fontWeight: 700,
                        color: '#FFFFFF',
                        textShadow: '',
                    }
                }],
                textAlign: 'right',
                verticalAlign: 'middle',
                lineHeight: 1.2,
                letterSpacing: 0,
                backgroundColor: 'transparent',
                padding: 10,
            } as TextElement;
        } else if (type === ElementType.Cutter) {
            const elementSize = 250;
            newElement = {
                id: newId,
                type: ElementType.Cutter,
                x: (template.width - elementSize) / 2,
                y: (template.height - elementSize) / 2,
                width: elementSize,
                height: elementSize,
                rotation: 0,
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
        
        if (canvasRef.current && (window as any).html2canvas) {
            try {
                const canvas = await (window as any).html2canvas(canvasRef.current, { 
                    backgroundColor: null,
                    useCORS: true 
                });
                previewImage = canvas.toDataURL('image/png');
            } catch (e) {
                console.error("html2canvas failed:", e);
            }
        }
        
        await onSaveTemplate({ ...template }, previewImage);
        setIsSaving(false);
        // On success, page will navigate away or update state
    };

    const handleApplyCut = async () => {
        const cutter = template.elements.find(el => el.id === selectedElementId && el.type === ElementType.Cutter) as CutterElement | undefined;
        if (!cutter) return;
    
        const findElementUnder = (cutterEl: CutterElement): CanvasElement | null => {
            const sortedElements = template.elements
                .filter(el => el.id !== cutterEl.id && (el.type === 'image' || el.type === 'text'))
                .sort((a, b) => b.zIndex - a.zIndex);
    
            for (const el of sortedElements) {
                const intersect = !(
                    cutterEl.x > el.x + el.width ||
                    cutterEl.x + cutterEl.width < el.x ||
                    cutterEl.y > el.y + el.height ||
                    cutterEl.y + cutterEl.height < el.y
                );
                if (intersect) return el;
            }
            return null;
        };
    
        let targetElement = findElementUnder(cutter);
        if (!targetElement) {
            alert("לא נמצא אלמנט לחיתוך מתחת לצורה.");
            return;
        }
    
        let imageToClipSrc: string | null = null;
        let imageToClipElement: ImageElement;
    
        setIsSaving(true);
    
        if (targetElement.type === ElementType.Text) {
            const domNode = canvasRef.current?.querySelector(`[data-element-id="${targetElement.id}"]`) as HTMLElement;
            if (domNode) {
                try {
                    imageToClipSrc = await (window as any).html2canvas(domNode, { backgroundColor: null, useCORS: true }).then((canvas: any) => canvas.toDataURL());
                } catch (e) {
                    console.error("html2canvas failed for text element:", e);
                    alert("שגיאה בהמרת הטקסט לתמונה.");
                    setIsSaving(false);
                    return;
                }
            }
        } else if (targetElement.type === ElementType.Image) {
            imageToClipSrc = (targetElement as ImageElement).originalSrc || (targetElement as ImageElement).src;
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
            canvas.width = targetElement!.width;
            canvas.height = targetElement!.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
    
            // Draw the image first, filling the target element's bounds
            ctx.drawImage(image, 0, 0, targetElement!.width, targetElement!.height);
    
            // Now, prepare to clip using the cutter shape
            ctx.globalCompositeOperation = 'destination-out';
            
            // Transform context to draw the cutter relative to the target element
            ctx.translate(cutter.x - targetElement!.x, cutter.y - targetElement!.y);
            ctx.translate(cutter.width / 2, cutter.height / 2);
            ctx.rotate(cutter.rotation * Math.PI / 180);
            ctx.translate(-cutter.width / 2, -cutter.height / 2);
    
            // Draw the clipping ellipse
            ctx.beginPath();
            ctx.ellipse(cutter.width / 2, cutter.height / 2, cutter.width / 2, cutter.height / 2, 0, 0, 2 * Math.PI);
            ctx.fill();
    
            const clippedDataUrl = canvas.toDataURL('image/png');
            
            const newImageElement: ImageElement = {
                id: `clipped_${Date.now()}`,
                type: ElementType.Image,
                x: targetElement!.x,
                y: targetElement!.y,
                width: targetElement!.width,
                height: targetElement!.height,
                rotation: targetElement!.rotation,
                zIndex: targetElement!.zIndex,
                src: clippedDataUrl,
                originalSrc: clippedDataUrl,
                objectFit: 'fill',
            };
    
            const newElements = template.elements
                .filter(el => el.id !== cutter.id && el.id !== targetElement!.id)
                .concat(newImageElement);
    
            handleTemplateChange({ ...template, elements: newElements });
            setSelectedElementId(newImageElement.id);
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
    
    const handleSelectElement = (id: string | null) => {
        if (id !== selectedElementId) {
            lastSelectionRangeRef.current = null;
        }
        setSelectedElementId(id);
        setSelectionRange(null);
    }
    
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleSelectElement(null);
        }
    };

    const handleExportPNG = async () => {
        if (canvasRef.current && (window as any).html2canvas && (window as any).saveAs) {
            handleSelectElement(null);
            await new Promise(resolve => setTimeout(resolve, 50)); // Wait for re-render
            const canvas = await (window as any).html2canvas(canvasRef.current, {
                backgroundColor: null,
                useCORS: true,
            });
            canvas.toBlob(function(blob: Blob) {
                if(blob) (window as any).saveAs(blob, `${template.name}.png`);
            });
        }
    };

    const handleExportJSON = () => {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(template, null, 2)
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
                        <button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-sm font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50">
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
                                onSelect={() => handleSelectElement(element.id)}
                                onUpdate={updateElement}
                                onInteractionStart={() => setIsInteracting(true)}
                                onInteractionEnd={handleInteractionEnd}
                                onTextSelect={setSelectionRange}
                                onTextContentRefChange={onTextContentRefChange}
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