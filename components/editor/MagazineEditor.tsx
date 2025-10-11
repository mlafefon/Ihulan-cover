import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextSpan, TextStyle } from '../../types';
import { ElementType } from '../../types';
import Sidebar from './Sidebar';
import { UndoIcon, RedoIcon, MagazineIcon, ImageIcon, RotateCcw } from '../Icons';


interface MagazineEditorProps {
    initialTemplate: Template;
    onEditImage: (element: ImageElement) => void;
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
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);
    const [history, setHistory] = useState<Template[]>([initialTemplate]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const canvasRef = useRef<HTMLDivElement>(null);
    const lastSelectionRangeRef = useRef<{ start: number, end: number } | null>(null);
    const textContentRefMap = useRef<Record<string, HTMLDivElement | null>>({});


    useEffect(() => {
        lastSelectionRangeRef.current = selectionRange;
    }, [selectionRange]);
    
    const onTextContentRefChange = useCallback((id: string, node: HTMLDivElement | null) => {
        textContentRefMap.current[id] = node;
    }, []);

    const updateHistory = (newTemplate: Template) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newTemplate);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleTemplateChange = (newTemplate: Template, withHistory: boolean = true) => {
        setTemplate(newTemplate);
        if (withHistory) {
            updateHistory(newTemplate);
        }
    }
    
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
            newElement = {
                id: newId,
                type: ElementType.Text,
                x: 50,
                y: 50,
                width: 300,
                height: 100,
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
            newElement = {
                id: newId,
                type: ElementType.Image,
                x: 100,
                y: 100,
                width: 400,
                height: 300,
                rotation: 0,
                zIndex: newZIndex,
                src: payload?.src || null,
                objectFit: 'cover',
            } as ImageElement;
        }
        
        const newElements = [...template.elements, newElement];
        handleTemplateChange({ ...template, elements: newElements });
        setSelectedElementId(newId);

        if (type === ElementType.Image && payload?.src) {
            onEditImage(newElement as ImageElement);
        }
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
                <main className="flex-grow bg-slate-900 flex items-center justify-center p-8 overflow-auto">
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
                                onInteractionEnd={() => updateHistory(template)}
                                onTextSelect={setSelectionRange}
                                onTextContentRefChange={onTextContentRefChange}
                                onEditImage={onEditImage}
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
                onEditImage={onEditImage}
            />
        </div>
    );
};

interface CanvasItemProps {
    element: CanvasElement;
    isSelected: boolean;
    onSelect: () => void;
    onUpdate: (id: string, updates: Partial<CanvasElement> & { textContent?: string }, withHistory?: boolean) => void;
    onInteractionEnd: () => void;
    onTextSelect: (range: { start: number, end: number } | null) => void;
    onTextContentRefChange: (id: string, node: HTMLDivElement | null) => void;
    onEditImage: (element: ImageElement) => void;
    canvasWidth: number;
    canvasHeight: number;
    otherElements: CanvasElement[];
    setSnapLines: (lines: { x: number[], y: number[] }) => void;
}

const CanvasItem: React.FC<CanvasItemProps> = ({ element, isSelected, onSelect, onUpdate, onInteractionEnd, onTextSelect, onTextContentRefChange, onEditImage, canvasWidth, canvasHeight, otherElements, setSnapLines }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const textContentRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (element.type === ElementType.Text) {
            onTextContentRefChange(element.id, textContentRef.current);
        }
        return () => {
             if (element.type === ElementType.Text) {
                onTextContentRefChange(element.id, null);
             }
        }
    }, [element.id, element.type, onTextContentRefChange]);
    
    useEffect(() => {
        if (isSelected && element.type === ElementType.Text) {
            const handleSelectionChange = () => {
                const selection = document.getSelection();
                const itemNode = textContentRef.current;
                if (!selection || !itemNode || !selection.containsNode(itemNode, true)) {
                    if (selection && selection.isCollapsed) {
                        onTextSelect(null);
                    }
                    return;
                }
                
                const range = getSelectionCharOffsetsWithin(itemNode);
                onTextSelect(range);
            };

            document.addEventListener('selectionchange', handleSelectionChange);
            return () => {
                document.removeEventListener('selectionchange', handleSelectionChange);
            };
        } else {
             onTextSelect(null);
        }
    }, [isSelected, element.type, onTextSelect]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (element.type === ElementType.Text) {
            if (textContentRef.current && textContentRef.current.contains(e.target as Node)) {
                e.stopPropagation();
                onSelect();
                return;
            }
        }

        if (element.type === ElementType.Image && !element.src) {
            e.stopPropagation();
            onSelect();
            imageInputRef.current?.click();
            return;
        }

        e.stopPropagation();
        onSelect();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startElX = element.x;
        const startElY = element.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            let newX = startElX + dx;
            let newY = startElY + dy;

            const SNAP_THRESHOLD = 5;
            const currentElementPoints = {
                left: newX,
                right: newX + element.width,
                top: newY,
                bottom: newY + element.height,
                hCenter: newX + element.width / 2,
                vCenter: newY + element.height / 2,
            };

            const snapTargetsX = [
                0, canvasWidth / 2, canvasWidth,
                ...otherElements.flatMap(el => [el.x, el.x + el.width / 2, el.x + el.width])
            ];
            const snapTargetsY = [
                0, canvasHeight / 2, canvasHeight,
                ...otherElements.flatMap(el => [el.y, el.y + el.height / 2, el.y + el.height])
            ];
            
            const activeSnapLines: { x: number[], y: number[] } = { x: [], y: [] };

            let snappedX = false;
            for (const targetX of snapTargetsX) {
                if (Math.abs(currentElementPoints.left - targetX) < SNAP_THRESHOLD) {
                    newX = targetX;
                    activeSnapLines.x.push(targetX);
                    snappedX = true;
                    break;
                }
                if (Math.abs(currentElementPoints.hCenter - targetX) < SNAP_THRESHOLD) {
                    newX = targetX - element.width / 2;
                    activeSnapLines.x.push(targetX);
                    snappedX = true;
                    break;
                }
                if (Math.abs(currentElementPoints.right - targetX) < SNAP_THRESHOLD) {
                    newX = targetX - element.width;
                    activeSnapLines.x.push(targetX);
                    snappedX = true;
                    break;
                }
            }

            let snappedY = false;
            for (const targetY of snapTargetsY) {
                if (Math.abs(currentElementPoints.top - targetY) < SNAP_THRESHOLD) {
                    newY = targetY;
                    activeSnapLines.y.push(targetY);
                    snappedY = true;
                    break;
                }
                if (Math.abs(currentElementPoints.vCenter - targetY) < SNAP_THRESHOLD) {
                    newY = targetY - element.height / 2;
                    activeSnapLines.y.push(targetY);
                    snappedY = true;
                    break;
                }
                if (Math.abs(currentElementPoints.bottom - targetY) < SNAP_THRESHOLD) {
                    newY = targetY - element.height;
                    activeSnapLines.y.push(targetY);
                    snappedY = true;
                    break;
                }
            }

            setSnapLines(activeSnapLines);
            onUpdate(element.id, { x: newX, y: newY }, false);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            onInteractionEnd();
            setSnapLines({ x: [], y: [] });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if(event.target?.result) {
                    onEditImage({ ...element, src: event.target.result as string } as ImageElement);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        if (e.target) e.target.value = '';
    };

    const handleResize = (e: React.MouseEvent, corner: string) => {
        e.stopPropagation();
    
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
    
                const newX = newCenterX - newWidth / 2;
                const newY = newCenterY - newHeight / 2;
    
                onUpdate(element.id, { width: newWidth, height: newHeight, x: newX, y: newY }, false);
            }
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            onInteractionEnd();
            setSnapLines({ x: [], y: [] });
        };
    
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleRotate = (e: React.MouseEvent) => {
        e.stopPropagation();

        const el = itemRef.current!;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const startRotation = element.rotation;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
            const angleDiff = (angle - startAngle) * (180 / Math.PI);
            onUpdate(element.id, { rotation: startRotation + angleDiff }, false);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            onInteractionEnd();
            setSnapLines({ x: [], y: [] });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
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
        cursor: (element.type === ElementType.Image && !element.src) ? 'pointer' : 'move',
        boxSizing: 'border-box',
    };
    
    if (element.type === ElementType.Text) {
        itemStyle.padding = `${dragBorderWidth}px`;
    }

    const renderElement = () => {
        switch (element.type) {
            case ElementType.Text:
                const textElement = element as TextElement;
                const innerStyle: React.CSSProperties = {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    outline: 'none',
                    alignItems: verticalAlignMap[textElement.verticalAlign],
                    justifyContent: 'center',
                    flexDirection: 'column',
                    padding: `${textElement.padding}px`,
                    backgroundColor: textElement.backgroundColor,
                    lineHeight: textElement.lineHeight,
                    letterSpacing: `${textElement.letterSpacing}px`,
                    textAlign: textElement.textAlign,
                    userSelect: 'text',
                    cursor: 'text'
                };

                return (
                    <div 
                        ref={textContentRef} 
                        style={innerStyle}
                        contentEditable={isSelected}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => {
                            const newText = e.currentTarget.innerText;
                            const currentText = textElement.spans.map(s => s.text).join('');
                            if (newText !== currentText) {
                                onUpdate(element.id, { textContent: newText });
                            }
                        }}
                    >
                        <div style={{ width: '100%'}}>
                            {textElement.spans.map((span, index) => (
                                <span key={index} style={{
                                    fontFamily: span.style.fontFamily,
                                    fontSize: `${span.style.fontSize}px`,
                                    fontWeight: span.style.fontWeight,
                                    color: span.style.color,
                                    textShadow: span.style.textShadow,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
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
                        <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload}/>
                        {imageElement.src ? (
                            <img src={imageElement.src} alt="Uploaded content" className="w-full h-full pointer-events-none" style={{objectFit: imageElement.objectFit}} />
                        ) : (
                            <div className="w-full h-full border-2 border-dashed border-gray-500 bg-gray-700/50 flex flex-col items-center justify-center text-center text-gray-400 pointer-events-none">
                                <ImageIcon className="w-8 h-8 mb-2" />
                                <span>הוסף תמונה</span>
                            </div>
                        )}
                    </>
                );
            default:
                return null;
        }
    }
    
    const handles = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
    
    return (
        <div ref={itemRef} style={itemStyle} onMouseDown={handleMouseDown}>
            {isSelected && <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />}
            {renderElement()}
            {isSelected && (
                <>
                    {handles.map(handle => (
                        <div
                            key={handle}
                            onMouseDown={(e) => handleResize(e, handle)}
                            className={`absolute bg-white border border-slate-500 w-3 h-3 -m-1.5 z-50 ${
                                handle.includes('t') ? 'top-0' : ''
                            } ${handle.includes('b') ? 'bottom-0' : ''} ${
                                handle.includes('l') ? 'left-0' : ''
                            } ${handle.includes('r') ? 'right-0' : ''} ${
                                handle.length === 1 ? (handle === 't' || handle === 'b' ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2') : ''
                            } ${
                                (handle === 'tl' || handle === 'br') && 'cursor-nwse-resize'
                            } ${
                                (handle === 'tr' || handle === 'bl') && 'cursor-nesw-resize'
                            } ${
                                (handle === 't' || handle === 'b') && 'cursor-ns-resize'
                            } ${
                                (handle === 'l' || handle === 'r') && 'cursor-ew-resize'
                            }`}
                        />
                    ))}
                    <div onMouseDown={handleRotate} className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full border border-slate-500 flex items-center justify-center cursor-alias z-50">
                        <RotateCcw className="w-4 h-4 text-slate-800" />
                    </div>
                </>
            )}
        </div>
    );
};

// --- Rich Text Utility Functions ---

function getSelectionCharOffsetsWithin(element: HTMLElement) {
    let start = 0, end = 0;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
            return { start: range.startOffset, end: range.endOffset };
        }
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        start = preCaretRange.toString().length;

        preCaretRange.setEnd(range.endContainer, range.endOffset);
        end = preCaretRange.toString().length;
    }
    return { start, end };
}

function setSelectionByOffset(containerEl: HTMLElement, start: number, end: number) {
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

function applyStyleToSpans(
    spans: TextSpan[],
    range: { start: number; end: number } | null,
    styleUpdate: Partial<TextStyle>
): TextSpan[] {
    if (!range || range.start === range.end) {
        return spans.map(span => ({
            ...span,
            style: { ...span.style, ...styleUpdate },
        }));
    }

    const { start, end } = range;
    const newSpans: TextSpan[] = [];
    let currentIndex = 0;

    for (const span of spans) {
        const spanEnd = currentIndex + span.text.length;

        if (spanEnd <= start || currentIndex >= end) { // No overlap
            newSpans.push(span);
        } else { // Overlap
            const beforeText = span.text.substring(0, Math.max(0, start - currentIndex));
            const selectedText = span.text.substring(Math.max(0, start - currentIndex), Math.min(span.text.length, end - currentIndex));
            const afterText = span.text.substring(Math.min(span.text.length, end - currentIndex));

            if (beforeText) newSpans.push({ ...span, text: beforeText });
            if (selectedText) newSpans.push({ ...span, text: selectedText, style: { ...span.style, ...styleUpdate } });
            if (afterText) newSpans.push({ ...span, text: afterText });
        }
        
        currentIndex = spanEnd;
    }
    
    // Merge adjacent spans with identical styles
    if (newSpans.length < 2) return newSpans.filter(s => s.text);
    const mergedSpans: TextSpan[] = [newSpans[0]];
    for (let i = 1; i < newSpans.length; i++) {
        const prev = mergedSpans[mergedSpans.length - 1];
        const current = newSpans[i];
        if (JSON.stringify(prev.style) === JSON.stringify(current.style)) {
            prev.text += current.text;
        } else {
            mergedSpans.push(current);
        }
    }

    return mergedSpans.filter(s => s.text);
}

export default MagazineEditor;