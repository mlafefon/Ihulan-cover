import React, { useState, Fragment, useRef } from 'react';
import type { Template, CanvasElement, TextElement, ImageElement, TextStyle } from '../../types';
import { ElementType } from '../../types';
import { TextIcon, ImageIcon, TrashIcon, ChevronDown, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd } from '../Icons';

interface SidebarProps {
    selectedElement: CanvasElement | null;
    onUpdateElement: (id: string, updates: Partial<CanvasElement> & { textContent?: string }) => void;
    onStyleUpdate: (styleUpdate: Partial<TextStyle>) => void;
    activeStyle: TextStyle | null;
    onAddElement: (type: ElementType, payload?: { src: string }) => void;
    onDeleteElement: (id:string) => void;
    template: Template;
    onUpdateTemplate: (settings: Partial<Template>) => void;
    onEditImage: (element: ImageElement) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedElement, onUpdateElement, onAddElement, onDeleteElement, template, onUpdateTemplate, onEditImage, onStyleUpdate, activeStyle }) => {
    
    return (
        <aside className="w-80 bg-slate-800 text-white flex flex-col h-full border-r border-slate-700" dir="rtl">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                <div>
                    <h2 className="text-lg font-bold">{selectedElement ? `עריכת ${selectedElement.type === 'text' ? 'טקסט' : 'תמונה'}` : 'איחולן'}</h2>
                    <p className="text-xs text-slate-400">{selectedElement ? `רכיב ID: ${selectedElement.id}` : 'עצבו את שער המגזין שלכם...'}</p>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto">
                {selectedElement ? (
                    <>
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


const DefaultPanel: React.FC<{ onAddElement: (type: ElementType, payload?: { src: string }) => void; template: Template, onUpdateTemplate: (settings: Partial<Template>) => void }> = ({ onAddElement, template, onUpdateTemplate }) => {
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleAddImageClick = () => {
        imageInputRef.current?.click();
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    onAddElement(ElementType.Image, { src: event.target.result as string });
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        if(e.target) e.target.value = ''; // Reset for re-upload of same file
    };

    return (
        <div className="p-4 space-y-4">
            <div>
                <h3 className="font-semibold mb-2">הוספת רכיבים</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onAddElement(ElementType.Text)} className="flex flex-col items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 p-4 rounded-md">
                        <TextIcon className="w-6 h-6" />
                        <span>הוסף טקסט</span>
                    </button>
                    <button onClick={handleAddImageClick} className="flex flex-col items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 p-4 rounded-md">
                        <ImageIcon className="w-6 h-6" />
                        <span>הוסף תמונה</span>
                    </button>
                    <input type="file" ref={imageInputRef} onChange={handleImageFileChange} accept="image/*" className="hidden" />
                </div>
            </div>
             <Accordion title="הגדרות עמוד">
                 <div className="space-y-2">
                    <label className="block">
                        <span className="text-sm text-slate-400">שם התבנית</span>
                        <input type="text" value={template.name} onChange={(e) => onUpdateTemplate({name: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm"/>
                    </label>
                    <div className="flex gap-2">
                        <label className="block w-1/2">
                            <span className="text-sm text-slate-400">רוחב</span>
                            <input type="number" value={template.width} onChange={(e) => onUpdateTemplate({width: parseInt(e.target.value)})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm"/>
                        </label>
                        <label className="block w-1/2">
                            <span className="text-sm text-slate-400">גובה</span>
                            <input type="number" value={template.height} onChange={(e) => onUpdateTemplate({height: parseInt(e.target.value)})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm"/>
                        </label>
                    </div>
                     <label className="block">
                        <span className="text-sm text-slate-400">צבע רקע</span>
                        <input type="color" value={template.backgroundColor} onChange={(e) => onUpdateTemplate({backgroundColor: e.target.value})} className="w-full h-10 bg-slate-700 border border-slate-600 rounded p-1 mt-1"/>
                    </label>
                 </div>
            </Accordion>
        </div>
    );
};

interface TextPanelProps {
    element: TextElement;
    onUpdate: (id: string, updates: { textContent: string }) => void;
    onStyleUpdate: (styleUpdate: Partial<TextStyle>) => void;
    activeStyle: TextStyle | null;
}

const TextPanel: React.FC<TextPanelProps> = ({ element, onUpdate, onStyleUpdate, activeStyle }) => {
    const handleBlockUpdate = (prop: keyof TextElement, value: any) => {
        onUpdate(element.id, { [prop]: value } as any);
    };

    const handleStyleChange = (prop: keyof TextStyle, value: any) => {
        onStyleUpdate({ [prop]: value });
    }

    const fullText = element.spans.map(s => s.text).join('');
    const displayStyle = activeStyle || element.spans[0]?.style;

    if (!displayStyle) return null; // Should not happen if element exists

    return (
        <div>
            <Accordion title="תוכן" defaultOpen>
                <textarea 
                    value={fullText} 
                    onChange={(e) => onUpdate(element.id, { textContent: e.target.value })} 
                    rows={4} 
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm" 
                    placeholder="הקלד כאן..."
                />
            </Accordion>
            
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

const ImagePanel: React.FC<{ element: ImageElement; onUpdate: (id: string, updates: Partial<ImageElement>) => void; onEditImage: (element: ImageElement) => void }> = ({ element, onUpdate, onEditImage }) => {
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    onEditImage({ ...element, src: event.target.result as string });
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };
    
    return (
        <div className="p-4 space-y-4">
            <div>
                <label htmlFor="image-upload" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 cursor-pointer">
                    החלף תמונה
                </label>
                <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <div>
                <button onClick={() => onEditImage(element)} disabled={!element.src} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                    ערוך תמונה
                </button>
            </div>
        </div>
    );
};


export default Sidebar;