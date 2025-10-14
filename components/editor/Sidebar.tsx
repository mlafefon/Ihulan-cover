import React, { useState, Fragment, useRef, useEffect } from 'react';
import type { Template, CanvasElement, TextElement, ImageElement, TextStyle } from '../../types';
import { ElementType } from '../../types';
import { TextIcon, ImageIcon, TrashIcon, ChevronDown, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, XIcon, ChevronsUp, ChevronUp, ChevronsDown } from '../Icons';

interface SidebarProps {
    selectedElement: CanvasElement | null;
    onUpdateElement: (id: string, updates: Partial<CanvasElement> & { textContent?: string }) => void;
    onStyleUpdate: (styleUpdate: Partial<TextStyle>) => void;
    activeStyle: TextStyle | null;
    onAddElement: (type: ElementType, payload?: { src: string }) => void;
    onDeleteElement: (id:string) => void;
    template: Template;
    onUpdateTemplate: (settings: Partial<Template>) => void;
    onEditImage: (element: ImageElement, newSrc?: string) => void;
    onDeselect: () => void;
    onLayerOrderChange: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedElement, onUpdateElement, onAddElement, onDeleteElement, template, onUpdateTemplate, onEditImage, onStyleUpdate, activeStyle, onDeselect, onLayerOrderChange }) => {
    const [elementId, setElementId] = useState(selectedElement?.id || '');

    useEffect(() => {
        if (selectedElement) {
            setElementId(selectedElement.id);
        }
    }, [selectedElement]);

    const handleIdUpdate = () => {
        if (!selectedElement) return;

        const isIdUnique = !template.elements.some(el => el.id === elementId && el.id !== selectedElement.id);

        if (elementId && elementId !== selectedElement.id && isIdUnique) {
            onUpdateElement(selectedElement.id, { id: elementId });
        } else {
            setElementId(selectedElement.id);
            if (!isIdUnique) {
                // Optionally: show an error to the user
                console.warn(`ID "${elementId}" already exists. Reverting.`);
            }
        }
    };
    
    return (
        <aside className="w-80 bg-slate-800 text-white flex flex-col h-full border-r border-slate-700" dir="rtl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center gap-2">
                <div>
                    <h2 className="text-lg font-bold">{selectedElement ? `עריכת ${selectedElement.type === 'text' ? 'טקסט' : 'תמונה'}` : 'איחולן'}</h2>
                    {!selectedElement && (
                        <p className="text-xs text-slate-400">עצבו את שער המגזין שלכם...</p>
                    )}
                </div>
                {selectedElement && (
                    <button
                        onClick={onDeselect}
                        className="p-1 rounded-full hover:bg-slate-700"
                        aria-label="סגור עריכה וחזור לתפריט הראשי"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
            <div className="flex-grow overflow-y-auto">
                {selectedElement ? (
                    <>
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-4">
                            <label htmlFor="elementIdInput" className="text-sm text-slate-400 whitespace-nowrap">שם הרכיב (ID)</label>
                            <input
                                id="elementIdInput"
                                type="text"
                                value={elementId}
                                onChange={(e) => setElementId(e.target.value)}
                                onBlur={handleIdUpdate}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                    }
                                }}
                                className="flex-grow bg-slate-700 border border-slate-600 rounded p-2 text-sm"
                            />
                        </div>
                        {selectedElement.type === ElementType.Text && (
                            <TextPanel 
                                element={selectedElement as TextElement} 
                                onUpdate={onUpdateElement}
                                onStyleUpdate={onStyleUpdate}
                                activeStyle={activeStyle}
                             />
                        )}
                        {selectedElement.type === ElementType.Image && (
                            <ImagePanel element={selectedElement as ImageElement} onUpdate={onUpdateElement} onEditImage={onEditImage} />
                        )}
                        <Accordion title="סדר">
                            <LayerPanel 
                                element={selectedElement} 
                                onLayerOrderChange={onLayerOrderChange}
                                totalElements={template.elements.length}
                            />
                        </Accordion>
                        <div className="p-4 mt-4 border-t border-slate-700">
                            <button onClick={() => onDeleteElement(selectedElement.id)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2">
                                <TrashIcon className="w-4 h-4" />
                                מחק רכיב
                            </button>
                        </div>
                    </>
                ) : (
                    <DefaultPanel onAddElement={onAddElement} template={template} onUpdateTemplate={onUpdateTemplate}/>
                )}
            </div>
        </aside>
    );
};

const Accordion: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-slate-700">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 hover:bg-slate-700/50">
                <span className="font-semibold">{title}</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="p-4 bg-slate-900/50">{children}</div>}
        </div>
    );
};

const LayerPanel: React.FC<{ element: CanvasElement, onLayerOrderChange: SidebarProps['onLayerOrderChange'], totalElements: number}> = ({ element, onLayerOrderChange, totalElements }) => {
    const isAtBack = element.zIndex <= 1;
    const isAtFront = element.zIndex >= totalElements;
    
    const buttonClass = "flex flex-col items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 p-2 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="grid grid-cols-4 gap-2">
            <button onClick={() => onLayerOrderChange(element.id, 'front')} disabled={isAtFront} className={buttonClass} title="הבא לקדמה">
                <ChevronsUp className="w-5 h-5"/>
                <span>קדמה</span>
            </button>
            <button onClick={() => onLayerOrderChange(element.id, 'forward')} disabled={isAtFront} className={buttonClass} title="הזז קדימה">
                <ChevronUp className="w-5 h-5"/>
                <span>קדימה</span>
            </button>
            <button onClick={() => onLayerOrderChange(element.id, 'backward')} disabled={isAtBack} className={buttonClass} title="שלח לאחור">
                <ChevronDown className="w-5 h-5"/>
                <span>אחורה</span>
            </button>
            <button onClick={() => onLayerOrderChange(element.id, 'back')} disabled={isAtBack} className={buttonClass} title="שלח לרקע">
                <ChevronsDown className="w-5 h-5"/>
                <span>רקע</span>
            </button>
        </div>
    );
}

const DefaultPanel: React.FC<{ onAddElement: (type: ElementType, payload?: { src: string }) => void; template: Template, onUpdateTemplate: (settings: Partial<Template>) => void }> = ({ onAddElement, template, onUpdateTemplate }) => {
    return (
        <div className="p-4 space-y-4">
            <div>
                <h3 className="font-semibold mb-2">הוספת רכיבים</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onAddElement(ElementType.Text)} className="flex flex-col items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 p-4 rounded-md">
                        <TextIcon className="w-6 h-6" />
                        <span>הוסף טקסט</span>
                    </button>
                    <button onClick={() => onAddElement(ElementType.Image)} className="flex flex-col items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 p-4 rounded-md">
                        <ImageIcon className="w-6 h-6" />
                        <span>הוסף תמונה</span>
                    </button>
                </div>
            </div>
             <Accordion title="הגדרות עמוד">
                 <div className="space-y-3">
                    <label className="flex items-center gap-2">
                        <span className="text-sm text-slate-400 whitespace-nowrap">שם התבנית</span>
                        <input type="text" value={template.name} onChange={(e) => onUpdateTemplate({name: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"/>
                    </label>
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 w-1/2">
                            <span className="text-sm text-slate-400">רוחב</span>
                            <input type="number" value={template.width} onChange={(e) => onUpdateTemplate({width: parseInt(e.target.value)})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"/>
                        </label>
                        <label className="flex items-center gap-2 w-1/2">
                            <span className="text-sm text-slate-400">גובה</span>
                            <input type="number" value={template.height} onChange={(e) => onUpdateTemplate({height: parseInt(e.target.value)})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"/>
                        </label>
                    </div>
                     <label className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-400">צבע רקע</span>
                        <input type="color" value={template.background_color} onChange={(e) => onUpdateTemplate({background_color: e.target.value})} className="w-24 h-10 bg-slate-700 border border-slate-600 rounded p-1"/>
                    </label>
                 </div>
            </Accordion>
        </div>
    );
};

interface TextPanelProps {
    element: TextElement;
    onUpdate: (id: string, updates: Partial<TextElement>) => void;
    onStyleUpdate: (styleUpdate: Partial<TextStyle>) => void;
    activeStyle: TextStyle | null;
}

const TextPanel: React.FC<TextPanelProps> = ({ element, onUpdate, onStyleUpdate, activeStyle }) => {
    const handleBlockUpdate = (prop: keyof TextElement, value: any) => {
        onUpdate(element.id, { [prop]: value } as Partial<TextElement>);
    };

    const handleStyleChange = (prop: keyof TextStyle, value: any) => {
        onStyleUpdate({ [prop]: value });
    }

    const displayStyle = activeStyle || element.spans[0]?.style;

    if (!displayStyle) return null; // Should not happen if element exists

    return (
        <div>
            <Accordion title="טיפוגרפיה" defaultOpen>
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-sm text-slate-400">פונט</span>
                         <select value={displayStyle.fontFamily} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm">
                            <option value="Heebo">Heebo</option>
                            <option value="Arial">Arial</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                         <label>
                            <span className="text-sm text-slate-400">גודל</span>
                            <input type="number" value={displayStyle.fontSize} onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" />
                        </label>
                        <label>
                            <span className="text-sm text-slate-400">משקל</span>
                            <select value={displayStyle.fontWeight} onChange={(e) => handleStyleChange('fontWeight', parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm">
                                <option value="400">רגיל</option>
                                <option value="500">בינוני</option>
                                <option value="700">מודגש</option>
                                <option value="900">שחור</option>
                            </select>
                        </label>
                    </div>
                </div>
            </Accordion>
            
            <Accordion title="צבע ומראה">
                <div className="space-y-3">
                     <div className="grid grid-cols-2 gap-2">
                        <label>
                            <span className="text-sm text-slate-400">צבע טקסט</span>
                            <input type="color" value={displayStyle.color} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-full h-10 bg-slate-700 border border-slate-600 rounded p-1 mt-1"/>
                        </label>
                        <label>
                             <span className="text-sm text-slate-400">צבע רקע (תיבה)</span>
                             <input type="color" value={element.backgroundColor} onChange={(e) => handleBlockUpdate('backgroundColor', e.target.value)} className="w-full h-10 bg-slate-700 border border-slate-600 rounded p-1 mt-1"/>
                        </label>
                     </div>
                     <label>
                        <span className="text-sm text-slate-400">צל טקסט (CSS)</span>
                        <input type="text" value={displayStyle.textShadow} onChange={(e) => handleStyleChange('textShadow', e.target.value)} placeholder="e.g. 2px 2px 4px #000" className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" />
                     </label>
                </div>
            </Accordion>

            <Accordion title="יישור ופריסה">
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-2">
                         <label>
                            <span className="text-sm text-slate-400">מרווח שורות</span>
                            <input type="number" step="0.1" value={element.lineHeight} onChange={(e) => handleBlockUpdate('lineHeight', parseFloat(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" />
                        </label>
                        <label>
                            <span className="text-sm text-slate-400">מרווח אותיות</span>
                            <input type="number" value={element.letterSpacing} onChange={(e) => handleBlockUpdate('letterSpacing', parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" />
                        </label>
                    </div>
                     <label>
                        <span className="text-sm text-slate-400">ריפוד</span>
                        <input type="number" value={element.padding} onChange={(e) => handleBlockUpdate('padding', parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" />
                    </label>
                    <div>
                        <span className="text-sm text-slate-400">יישור אופקי</span>
                         <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-md mt-1">
                            {(['left', 'center', 'right'] as const).map(align => (
                                <button key={align} onClick={() => handleBlockUpdate('textAlign', align)} className={`p-2 rounded capitalize ${element.textAlign === align ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{align}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-slate-400">יישור אנכי</span>
                         <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-md mt-1">
                            <button onClick={() => handleBlockUpdate('verticalAlign', 'top')} className={`p-2 rounded ${element.verticalAlign === 'top' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}><AlignVerticalJustifyStart className="w-5 h-5 mx-auto"/></button>
                            <button onClick={() => handleBlockUpdate('verticalAlign', 'middle')} className={`p-2 rounded ${element.verticalAlign === 'middle' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}><AlignVerticalJustifyCenter className="w-5 h-5 mx-auto"/></button>
                            <button onClick={() => handleBlockUpdate('verticalAlign', 'bottom')} className={`p-2 rounded ${element.verticalAlign === 'bottom' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}><AlignVerticalJustifyEnd className="w-5 h-5 mx-auto"/></button>
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    );
};

const ImagePanel: React.FC<{ element: ImageElement; onUpdate: (id: string, updates: Partial<ImageElement>) => void; onEditImage: (element: ImageElement, newSrc?: string) => void }> = ({ element, onUpdate, onEditImage }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleButtonClick = () => {
        if (element.src) {
            onEditImage(element);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const newSrc = event.target?.result as string;
                if (newSrc) {
                    onEditImage(element, newSrc);
                }
            };
            reader.readAsDataURL(file);
        }
        if (e.target) e.target.value = ''; // Reset file input
    };

    const handleNumericUpdate = (prop: keyof ImageElement, value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            onUpdate(element.id, { [prop]: numValue } as Partial<ImageElement>);
        }
    };
    
    return (
        <>
            <div className="p-4 border-b border-slate-700">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <button onClick={handleButtonClick} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    {element.src ? 'ערוך תמונה' : 'הוסף תמונה'}
                </button>
            </div>
            
            <Accordion title="מיקום וגודל" defaultOpen>
                <div className="p-4 grid grid-cols-2 gap-x-2 gap-y-3">
                    <label>
                        <span className="text-sm text-slate-400">רוחב (W)</span>
                        <input 
                            type="number" 
                            value={Math.round(element.width)} 
                            onChange={(e) => handleNumericUpdate('width', e.target.value)} 
                            className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" 
                        />
                    </label>
                    <label>
                        <span className="text-sm text-slate-400">גובה (H)</span>
                        <input 
                            type="number" 
                            value={Math.round(element.height)} 
                            onChange={(e) => handleNumericUpdate('height', e.target.value)} 
                            className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" 
                        />
                    </label>
                    <label>
                        <span className="text-sm text-slate-400">מיקום X</span>
                        <input 
                            type="number" 
                            value={Math.round(element.x)} 
                            onChange={(e) => handleNumericUpdate('x', e.target.value)} 
                            className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" 
                        />
                    </label>
                    <label>
                        <span className="text-sm text-slate-400">מיקום Y</span>
                        <input 
                            type="number" 
                            value={Math.round(element.y)} 
                            onChange={(e) => handleNumericUpdate('y', e.target.value)} 
                            className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" 
                        />
                    </label>
                     <label className="col-span-2">
                        <span className="text-sm text-slate-400">סיבוב (°)</span>
                        <input 
                            type="number" 
                            value={Math.round(element.rotation)} 
                            onChange={(e) => handleNumericUpdate('rotation', e.target.value)} 
                            className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm" 
                        />
                    </label>
                </div>
            </Accordion>
        </>
    );
};


export default Sidebar;