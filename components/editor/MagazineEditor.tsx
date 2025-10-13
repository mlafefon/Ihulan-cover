
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextSpan, TextStyle } from '../../types';
import { ElementType } from '../../types';
import Sidebar from './Sidebar';
import { UndoIcon, RedoIcon, MagazineIcon } from '../Icons';
import CanvasItem, { applyStyleToSpans, setSelectionByOffset } from '../CanvasItem';


interface MagazineEditorProps {
    initialTemplate: Template;
    onEditImage: (element: ImageElement, currentTemplate: Template) => void;
}

const MagazineEditor: React.FC<MagazineEditorProps> = ({ initialTemplate, onEditImage }) => {
    const navigate = useNavigate();
    const [snapLines, setSnapLines] = useState<{ x: number[], y: number[] }>({ x: [], y: [] });

    if (!initialTemplate) {
        React.useEffect(() => {
            navigate('/templates');
        }, [navigate]);
        return null; 
    }

    const [template, setTemplate] = useState<Template>(initialTemplate);
    const templateRef = useRef(template);
    templateRef.current = template;

    const [isInteracting, setIsInteracting] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);
    const [history, setHistory] = useState<Template[]>([initialTemplate]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canvasRef = useRef<HTMLDivElement>(null);
    const lastSelectionRangeRef = useRef<{ start: number, end: number } | null>(null);
    const textContentRefMap = useRef<Record<string, HTMLDivElement | null>>({});

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

    const updateElement = (id: string, updates: Partial<CanvasElement> & { textContent?: string }, withHistory: boolean = true) => {
        const newElements = template.elements.map(el => {
            if (el.id !== id) return el;

            if (el.type === ElementType.Text) {
                const { textContent, ...restOfUpdates } = updates;
                let spans = el.spans;

                if (textContent !== undefined) {
                    const newText = textContent;
                    const oldSpans = el.spans;
                    const newSpans: TextSpan[] = [];
                    let textIndex = 0;
        
                    for (const oldSpan of oldSpans) {
                        const oldLen = oldSpan.text.length;
                        if (textIndex >= newText.length) break;
                        
                        const newTextSlice = newText.substring(textIndex, textIndex + oldLen);
                        newSpans.push({
                            text: newTextSlice,
                            style: oldSpan.style
                        });
                        textIndex += oldLen;
                    }
        
                    if (textIndex < newText.length) {
                        const remainingText = newText.substring(textIndex);
                        if (newSpans.length > 0) {
                            newSpans[newSpans.length - 1].text += remainingText;
                        } else {
                            newSpans.push({
                                text: remainingText,
                                style: oldSpans[0]?.style || { fontFamily: 'Heebo', fontSize: 16, fontWeight: 400, color: '#FFFFFF', textShadow: '' }
                            });
                        }
                    }
                    
                    const finalSpans = newSpans.filter(s => s.text.length > 0);
                    
                    if (finalSpans.length === 0 && newText.length > 0) {
                         finalSpans.push({
                            text: newText,
                            style: oldSpans[0]?.style || { fontFamily: 'Heebo', fontSize: 16, fontWeight: 400, color: '#FFFFFF', textShadow: '' }
                         });
                    } else if (finalSpans.length === 0 && newText.length === 0) {
                        finalSpans.push({
                            text: '',
                            style: oldSpans[0]?.style || { fontFamily: 'Heebo', fontSize: 16, fontWeight: 400, color: '#FFFFFF', textShadow: '' }
                         });
                    }
                    spans = finalSpans;
                }
    
                return { ...el, ...restOfUpdates, spans } as TextElement;
            }

            if (el.type === ElementType.Image) {
                return { ...el, ...updates } as ImageElement;
            }

            return el;
        });
        handleTemplateChange({ ...template, elements: newElements }, withHistory);

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
            passUpImageEdit(newElement as ImageElement);
        }
    };
    
    const passUpImageEdit = (element: ImageElement) => {
        onEditImage(element, template);
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
    
    const handleCanvasClick = (e: React.MouseEvent) => {
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
                        <button onClick={handleExportJSON} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-2 px-4 rounded-md transition-colors">
                            שמור קובץ
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
                            backgroundColor: template.backgroundColor,
                        }}
                        onClick={handleCanvasClick}
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
            />
        </div>
    );
};

export default MagazineEditor;