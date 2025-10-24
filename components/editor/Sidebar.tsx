import React, { useState, Fragment, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextStyle, CutterElement, ElementBase } from '../../types';
import { ElementType, hexToRgb } from '../../types';
import { TextIcon, ImageIcon, TrashIcon, ChevronDown, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, XIcon, ChevronsUp, ChevronUp, ChevronsDown, ScissorsIcon, BanIcon, ShadowIcon, AlignRightIcon, AlignCenterIcon, AlignLeftIcon, AlignJustifyIcon, LockIcon, UnlockIcon, BrushIcon, TextToImageIcon, PaletteIcon } from '../Icons';
import { availableFonts } from '../fonts/FontManager';
import NumericStepper from './NumericStepper';
import { defaultTextStyle } from '../CanvasItem';
import ColorPicker from './ColorPicker';

interface SidebarProps {
    selectedElement: CanvasElement | null;
    isEditing: boolean;
    onUpdateElement: (id: string, updates: Partial<CanvasElement> & { textContent?: string }) => void;
    onStyleUpdate: (styleUpdate: Partial<TextStyle>, isPreset?: boolean) => void;
    onAlignmentUpdate: (align: 'right' | 'center' | 'left' | 'justify') => void;
    activeStyle: TextStyle | null;
    onAddElement: (type: ElementType, payload?: { src: string }) => void;
    onDeleteElement: (id:string) => void;
    template: Template;
    onUpdateTemplate: (settings: Partial<Template>) => void;
    onEditImage: (element: ImageElement, newSrc?: string) => void;
    onDeselect: () => void;
    onLayerOrderChange: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
    onApplyCut: () => void;
    isApplyingCut: boolean;
    onSelectElement: (id: string | null) => void;
    onHoverElement: (id: string | null) => void;
    formatBrushState: { active: boolean; sourceElement: TextElement | null };
    onToggleFormatBrush: () => void;
    onConvertTextToImage: (id: string) => void;
}

// Helpers
const parseColor = (color: string): { hex: string; alpha: number } => {
    if (!color || color === 'transparent') {
        return { hex: '#ffffff', alpha: 0 };
    }
    if (color.startsWith('#')) {
        return { hex: color, alpha: 1 };
    }
    if (color.startsWith('rgb')) { // handles rgb() and rgba()
        const parts = color.match(/[\d.]+/g);
        if (parts && parts.length >= 3) {
            const [r, g, b, a = '1'] = parts;
            const toHexPart = (c: string) => parseInt(c).toString(16).padStart(2, '0');
            const hex = `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
            return { hex, alpha: parseFloat(a) };
        }
    }
    // Fallback for named colors or other formats. It won't be perfect but avoids crashing.
    return { hex: '#000000', alpha: 1 };
};


const Sidebar: React.FC<SidebarProps> = ({ 
    selectedElement, isEditing, onUpdateElement, onAddElement, onDeleteElement, template, 
    onUpdateTemplate, onEditImage, onStyleUpdate, onAlignmentUpdate, activeStyle, onDeselect, 
    onLayerOrderChange, onApplyCut, isApplyingCut, onSelectElement, onHoverElement,
    formatBrushState, onToggleFormatBrush, onConvertTextToImage
}) => {
    const [elementId, setElementId] = useState(selectedElement?.id || '');
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    // Track previous state to implement the specific accordion logic
    const prevSelectedId = useRef<string | null>(null);
    const prevIsEditing = useRef<boolean>(false);

    useEffect(() => {
        if (selectedElement) {
            setElementId(selectedElement.id);
        }
    }, [selectedElement]);

    useEffect(() => {
        const currentSelectedId = selectedElement?.id || null;

        if (!selectedElement) {
            setOpenAccordion('הגדרות עמוד');
        } else {
            // Case 1: Just entered edit mode for a text element.
            if (isEditing && !prevIsEditing.current && selectedElement.type === ElementType.Text) {
                setOpenAccordion('טיפוגרפיה וצבע');
            }
            // Case 2: Just selected a new element (and not immediately editing it).
            else if (currentSelectedId !== prevSelectedId.current && !isEditing) {
                // For any newly selected element, open "Position and Size".
                setOpenAccordion('מיקום וגודל');
            }
        }

        // Update refs for the next render cycle.
        prevSelectedId.current = selectedElement?.id || null;
        prevIsEditing.current = isEditing;
    }, [selectedElement, isEditing]);


    const handleAccordionToggle = (title: string) => {
        setOpenAccordion(prev => (prev === title ? null : title));
    };


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
                    <h2 className="text-lg font-bold">{selectedElement ? `עריכת ${selectedElement.type === 'text' ? 'טקסט' : selectedElement.type === 'image' ? 'תמונה' : 'צורת חיתוך'}` : 'איחולן'}</h2>
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

                        {selectedElement.type === ElementType.Cutter && (
                            <div className="p-4 border-b border-slate-700">
                                <button 
                                    onClick={onApplyCut}
                                    disabled={isApplyingCut}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isApplyingCut ? 'מעבד...' : 'בצע חיתוך'}
                                </button>
                            </div>
                        )}
                        {selectedElement.type === ElementType.Text && (
                            <TextPanel 
                                element={selectedElement as TextElement} 
                                onUpdate={onUpdateElement}
                                onStyleUpdate={onStyleUpdate}
                                onAlignmentUpdate={onAlignmentUpdate}
                                activeStyle={activeStyle}
                                openAccordion={openAccordion}
                                onAccordionToggle={handleAccordionToggle}
                             />
                        )}
                        {selectedElement.type === ElementType.Image && (
                            <ImagePanel element={selectedElement as ImageElement} onEditImage={onEditImage} />
                        )}
                        {(selectedElement.type === ElementType.Image || selectedElement.type === ElementType.Cutter || selectedElement.type === ElementType.Text) && (
                            <Accordion 
                                title="מיקום וגודל" 
                                isOpen={openAccordion === 'מיקום וגודל'}
                                onToggle={() => handleAccordionToggle('מיקום וגודל')}
                            >
                                <TransformPanel element={selectedElement} onUpdate={onUpdateElement} />
                            </Accordion>
                        )}
                         <Accordion 
                            title="סדר"
                            isOpen={openAccordion === 'סדר'}
                            onToggle={() => handleAccordionToggle('סדר')}
                        >
                            <LayerPanel 
                                element={selectedElement} 
                                onLayerOrderChange={onLayerOrderChange}
                                totalElements={template.elements.length}
                            />
                        </Accordion>
                        <div className="p-4 mt-4 border-t border-slate-700">
                             <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onDeleteElement(selectedElement.id)}
                                    className="flex-grow bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    מחק רכיב
                                </button>
                                {selectedElement.type === ElementType.Text && (
                                    <>
                                        <button
                                            onClick={() => onConvertTextToImage(selectedElement.id)}
                                            disabled={isApplyingCut}
                                            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded transition-colors bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait"
                                            title="המר לתמונה"
                                        >
                                            <TextToImageIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={onToggleFormatBrush}
                                            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded transition-colors ${formatBrushState.active ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                                            title="העתק עיצוב"
                                        >
                                            <BrushIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => onUpdateElement(selectedElement.id, { locked: !selectedElement.locked })}
                                    className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded transition-colors ${selectedElement.locked ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                                    title={selectedElement.locked ? "שחרר אלמנט" : "נעל רכיב"}
                                >
                                    {selectedElement.locked ? <UnlockIcon className="w-5 h-5" /> : <LockIcon className="w-5 h-5" />}
                                </button>
                             </div>
                        </div>
                    </>
                ) : (
                    <DefaultPanel 
                        onAddElement={onAddElement} 
                        template={template} 
                        onUpdateTemplate={onUpdateTemplate}
                        openAccordion={openAccordion}
                        onAccordionToggle={handleAccordionToggle}
                        onSelectElement={onSelectElement}
                        onHoverElement={onHoverElement}
                        onDeleteElement={onDeleteElement}
                        onUpdateElement={onUpdateElement}
                    />
                )}
            </div>
        </aside>
    );
};

const Accordion: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, children, isOpen, onToggle }) => {
    return (
        <div className="border-b border-slate-700">
            <button onClick={onToggle} className="w-full flex items-center p-3 hover:bg-slate-700/50 gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                <span className="font-semibold text-sm">{title}</span>
            </button>
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-3 bg-slate-900/50">{children}</div>
            </div>
        </div>
    );
};

const DefaultPanel: React.FC<{ 
    onAddElement: (type: ElementType) => void; 
    template: Template;
    onUpdateTemplate: (settings: Partial<Template>) => void;
    openAccordion: string | null;
    onAccordionToggle: (title: string) => void;
    onSelectElement: (id: string) => void;
    onHoverElement: (id: string | null) => void;
    onDeleteElement: (id:string) => void;
    onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
}> = ({ onAddElement, template, onUpdateTemplate, openAccordion, onAccordionToggle, onSelectElement, onHoverElement, onDeleteElement, onUpdateElement }) => {
    return (
        <>
            <div className="p-4 border-b border-slate-700">
                <h3 className="text-md font-bold mb-3">הוסף רכיב</h3>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => onAddElement(ElementType.Text)} className="flex flex-col items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 rounded-md">
                        <TextIcon className="w-6 h-6 mb-1"/>
                        <span className="text-xs">טקסט</span>
                    </button>
                    <button onClick={() => onAddElement(ElementType.Image)} className="flex flex-col items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 rounded-md">
                        <ImageIcon className="w-6 h-6 mb-1"/>
                        <span className="text-xs">תמונה</span>
                    </button>
                     <button onClick={() => onAddElement(ElementType.Cutter)} className="flex flex-col items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 rounded-md">
                        <ScissorsIcon className="w-6 h-6 mb-1"/>
                        <span className="text-xs">חיתוך</span>
                    </button>
                </div>
            </div>
            <Accordion 
                title="שכבות"
                isOpen={openAccordion === 'שכבות'}
                onToggle={() => onAccordionToggle('שכבות')}
            >
                <LayersList 
                    elements={template.elements}
                    onSelectElement={onSelectElement}
                    onHoverElement={onHoverElement}
                    onDeleteElement={onDeleteElement}
                    onUpdateElement={onUpdateElement}
                />
            </Accordion>
             <Accordion 
                title="הגדרות עמוד"
                isOpen={openAccordion === 'הגדרות עמוד'}
                onToggle={() => onAccordionToggle('הגדרות עמוד')}
            >
                <div className="space-y-3 p-3">
                    <div className="grid grid-cols-2 gap-3">
                        <NumericStepper 
                            label="רוחב (px)"
                            value={template.width}
                            onChange={(val) => onUpdateTemplate({ width: val })}
                            min={100} max={2000}
                        />
                        <NumericStepper 
                            label="גובה (px)"
                            value={template.height}
                            onChange={(val) => onUpdateTemplate({ height: val })}
                            min={100} max={2000}
                        />
                    </div>
                     <div>
                        <span className="text-sm text-slate-400">צבע רקע</span>
                        <div className="mt-1">
                             <ColorPicker
                                color={template.background_color}
                                onChange={(newColor) => onUpdateTemplate({ background_color: newColor })}
                            />
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-slate-400">שם התבנית</span>
                         <input
                            type="text"
                            value={template.name}
                            onChange={(e) => onUpdateTemplate({ name: e.target.value })}
                            className="w-full mt-1 bg-slate-700 border border-slate-600 rounded p-2 text-sm"
                        />
                    </div>
                </div>
            </Accordion>
        </>
    );
};


const TextPanel: React.FC<{ 
    element: TextElement, 
    onUpdate: (id: string, updates: Partial<TextElement>) => void,
    onStyleUpdate: (styleUpdate: Partial<TextStyle>, isPreset?: boolean) => void,
    onAlignmentUpdate: (align: 'right' | 'center' | 'left' | 'justify') => void,
    activeStyle: TextStyle | null,
    openAccordion: string | null;
    onAccordionToggle: (title: string) => void;
}> = ({ element, onUpdate, onStyleUpdate, onAlignmentUpdate, activeStyle, openAccordion, onAccordionToggle }) => {
    
    const { hex: bgColorHex, alpha: bgColorAlpha } = parseColor(element.backgroundColor);

    const handleBgColorChange = (newHex: string, newAlpha?: number) => {
        const alpha = newAlpha !== undefined ? newAlpha : bgColorAlpha;
        if (alpha < 1) {
            const rgb = hexToRgb(newHex);
            if (rgb) {
                onUpdate(element.id, { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` });
            }
        } else {
            onUpdate(element.id, { backgroundColor: newHex });
        }
    };

    const textShadow = activeStyle?.textShadow || '';
    const shadowParts = textShadow.match(/(-?\d+)px (-?\d+)px (-?\d+)px (.*)/) || [null, 0, 0, 0, '#000000'];
    const [, offsetX, offsetY, blur, color] = shadowParts.map(p => typeof p === 'string' && !p.startsWith('#') ? parseFloat(p) : p);


    return (
        <>
            <Accordion 
                title="טיפוגרפיה וצבע" 
                isOpen={openAccordion === 'טיפוגרפיה וצבע'}
                onToggle={() => onAccordionToggle('טיפוגרפיה וצבע')}
            >
                 <div className="space-y-3 p-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-sm text-slate-400">גופן</span>
                             <select value={activeStyle?.fontFamily || ''} onChange={(e) => onStyleUpdate({ fontFamily: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm h-[30px]">
                                {availableFonts.map(font => (
                                    <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>{font.name}</option>
                                ))}
                            </select>
                        </div>
                         <NumericStepper
                            label="גודל (px)"
                            value={activeStyle?.fontSize || 0}
                            onChange={(val, isPreset) => onStyleUpdate({ fontSize: val }, isPreset)}
                            min={8} max={500}
                            presets={[16, 24, 32, 48, 72, 96, 120, 150]}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-sm text-slate-400">משקל</span>
                            <select value={activeStyle?.fontWeight || 400} onChange={(e) => onStyleUpdate({ fontWeight: parseInt(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm h-[30px]">
                                {[100,200,300,400,500,600,700,800,900].map(weight => <option key={weight} value={weight}>{weight}</option>)}
                            </select>
                        </div>
                        <div>
                             <span className="text-sm text-slate-400">צבע</span>
                             <div className="mt-1">
                                <ColorPicker
                                    color={activeStyle?.color || '#ffffff'}
                                    onChange={newColor => onStyleUpdate({ color: newColor })}
                                />
                             </div>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                             <ShadowIcon className="w-5 h-5 text-slate-400" />
                             <span className="text-sm font-semibold">צל טקסט</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <NumericStepper label="X" value={Number(offsetX)} onChange={val => onStyleUpdate({ textShadow: `${val}px ${offsetY}px ${blur}px ${color}` })} min={-20} max={20} />
                            <NumericStepper label="Y" value={Number(offsetY)} onChange={val => onStyleUpdate({ textShadow: `${offsetX}px ${val}px ${blur}px ${color}` })} min={-20} max={20} />
                            <NumericStepper label="טשטוש" value={Number(blur)} onChange={val => onStyleUpdate({ textShadow: `${offsetX}px ${offsetY}px ${val}px ${color}` })} min={0} max={40} />
                        </div>
                         <div className="mt-2">
                             <span className="text-sm text-slate-400">צבע צל</span>
                             <div className="mt-1">
                                <ColorPicker
                                    color={String(color)}
                                    onChange={newColor => onStyleUpdate({ textShadow: `${offsetX}px ${offsetY}px ${blur}px ${newColor}` })}
                                />
                             </div>
                        </div>
                    </div>
                </div>
            </Accordion>
            <Accordion 
                title="יישור ופריסה" 
                isOpen={openAccordion === 'יישור ופריסה'}
                onToggle={() => onAccordionToggle('יישור ופריסה')}
            >
                <div className="space-y-3 p-3">
                     <div className="flex items-center justify-between bg-slate-700 rounded-md p-1">
                        <button onClick={() => onAlignmentUpdate('right')} className={`p-2 rounded ${element.textAlign === 'right' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור לימין"><AlignRightIcon className="w-5 h-5"/></button>
                        <button onClick={() => onAlignmentUpdate('center')} className={`p-2 rounded ${element.textAlign === 'center' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור למרכז"><AlignCenterIcon className="w-5 h-5"/></button>
                        <button onClick={() => onAlignmentUpdate('left')} className={`p-2 rounded ${element.textAlign === 'left' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור לשמאל"><AlignLeftIcon className="w-5 h-5"/></button>
                        <button onClick={() => onAlignmentUpdate('justify')} className={`p-2 rounded ${element.textAlign === 'justify' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור לשני הצדדים"><AlignJustifyIcon className="w-5 h-5"/></button>
                    </div>
                     <div className="flex items-center justify-between bg-slate-700 rounded-md p-1">
                        <button onClick={() => onUpdate(element.id, { verticalAlign: 'top' })} className={`p-2 rounded ${element.verticalAlign === 'top' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור למעלה"><AlignVerticalJustifyStart className="w-5 h-5"/></button>
                        <button onClick={() => onUpdate(element.id, { verticalAlign: 'middle' })} className={`p-2 rounded ${element.verticalAlign === 'middle' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור לאמצע"><AlignVerticalJustifyCenter className="w-5 h-5"/></button>
                        <button onClick={() => onUpdate(element.id, { verticalAlign: 'bottom' })} className={`p-2 rounded ${element.verticalAlign === 'bottom' ? 'bg-blue-600' : 'hover:bg-slate-600'}`} title="יישור למטה"><AlignVerticalJustifyEnd className="w-5 h-5"/></button>
                    </div>
                    <NumericStepper
                        label="גובה שורה"
                        value={activeStyle?.lineHeight || 1.2}
                        onChange={(val) => onStyleUpdate({ lineHeight: val })}
                        min={0.5} max={3} step={0.1} toFixed={1}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <NumericStepper
                            label="ריפוד (px)"
                            value={element.padding}
                            onChange={(val) => onUpdate(element.id, { padding: val })}
                            min={0}
                            max={100}
                        />
                        <NumericStepper
                            label="מרווח אותיות"
                            value={element.letterSpacing}
                            onChange={(val) => onUpdate(element.id, { letterSpacing: val })}
                            min={-10}
                            max={50}
                            step={0.1}
                            toFixed={1}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <NumericStepper
                            label="מתיחה אופקית (%)"
                            value={Math.round((element.scaleX || 1) * 100)}
                            onChange={(val) => onUpdate(element.id, { scaleX: val / 100 })}
                            min={10}
                            max={500}
                        />
                        <NumericStepper
                            label="מתיחה אנכית (%)"
                            value={Math.round((element.scaleY || 1) * 100)}
                            onChange={(val) => onUpdate(element.id, { scaleY: val / 100 })}
                            min={10}
                            max={500}
                        />
                    </div>
                </div>
            </Accordion>
             <Accordion 
                title="רקע ומסגרת"
                isOpen={openAccordion === 'רקע ומסגרת'}
                onToggle={() => onAccordionToggle('רקע ומסגרת')}
            >
                <div className="space-y-3 p-3">
                    <div>
                        <span className="text-sm text-slate-400">צבע רקע</span>
                        <div className="mt-1">
                             <ColorPicker
                                color={bgColorHex}
                                onChange={(newHex) => handleBgColorChange(newHex)}
                            />
                        </div>
                    </div>
                    {element.backgroundColor !== 'transparent' && (
                         <div>
                            <span className="text-sm text-slate-400">שקיפות רקע: {Math.round(bgColorAlpha * 100)}%</span>
                            <input
                                type="range"
                                min="0" max="1" step="0.01"
                                value={bgColorAlpha}
                                onChange={(e) => handleBgColorChange(bgColorHex, parseFloat(e.target.value))}
                                className="w-full mt-1"
                            />
                        </div>
                    )}
                    <div>
                        <span className="text-sm text-slate-400">צורת רקע</span>
                        <select value={element.backgroundShape || 'rectangle'} onChange={(e) => onUpdate(element.id, { backgroundShape: e.target.value as any })} className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm">
                            <option value="rectangle">מלבן</option>
                            <option value="rounded">פינות מעוגלות</option>
                            <option value="ellipse">אליפסה</option>
                            <option value="speech-bubble">בועת דיבור</option>
                            <option value="star">כוכב</option>
                            <option value="starburst-8">כוכב 8-קצוות</option>
                            <option value="starburst-10">כוכב 10-קצוות</option>
                            <option value="starburst-12">כוכב 12-קצוות</option>
                            <option value="hexagon">משושה</option>
                            <option value="octagon">מתומן</option>
                            <option value="rhombus">מעוין</option>
                        </select>
                    </div>
                     <div className="pt-2 border-t border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                             <input
                                type="checkbox"
                                id="outline-enabled"
                                checked={element.outline?.enabled || false}
                                onChange={(e) => onUpdate(element.id, { outline: { ...element.outline, enabled: e.target.checked } as any })}
                                className="w-4 h-4 rounded"
                            />
                             <label htmlFor="outline-enabled" className="text-sm font-semibold">קו מתאר</label>
                        </div>
                        {element.outline?.enabled && (
                            <div className="space-y-3 pl-6">
                                <NumericStepper label="עובי (px)" value={element.outline.width} onChange={val => onUpdate(element.id, { outline: { ...element.outline, width: val } as any })} min={1} max={50} />
                                <div>
                                    <span className="text-sm text-slate-400">צבע</span>
                                    <div className="mt-1">
                                        <ColorPicker
                                            color={element.outline.color}
                                            onChange={newColor => onUpdate(element.id, { outline: { ...element.outline, color: newColor } as any })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Accordion>
        </>
    );
};

const ImagePanel: React.FC<{ element: ImageElement, onEditImage: (element: ImageElement) => void }> = ({ element, onEditImage }) => {
    return (
        <div className="p-4">
            <button
                onClick={() => onEditImage(element)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
                פתח עורך תמונות
            </button>
        </div>
    );
};

const TransformPanel: React.FC<{ element: ElementBase, onUpdate: (id: string, updates: Partial<ElementBase>) => void }> = ({ element, onUpdate }) => {
    return (
        <div className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-3">
                <NumericStepper label="X" value={element.x} onChange={(val) => onUpdate(element.id, { x: val })} />
                <NumericStepper label="Y" value={element.y} onChange={(val) => onUpdate(element.id, { y: val })} />
            </div>
             <div className="grid grid-cols-2 gap-3">
                <NumericStepper label="רוחב" value={element.width} onChange={(val) => onUpdate(element.id, { width: val })} min={10} />
                <NumericStepper label="גובה" value={element.height} onChange={(val) => onUpdate(element.id, { height: val })} min={10} />
            </div>
             <NumericStepper 
                label="סיבוב (°)"
                value={element.rotation} 
                onChange={(val) => onUpdate(element.id, { rotation: val })} 
                min={-360} max={360}
            />
        </div>
    );
};

const LayerPanel: React.FC<{ element: ElementBase, onLayerOrderChange: (id: string, direction: any) => void, totalElements: number }> = ({ element, onLayerOrderChange, totalElements }) => {
    const isAtBack = element.zIndex <= 1;
    const isAtFront = element.zIndex >= totalElements;

    return (
        <div className="p-3">
             <div className="grid grid-cols-4 gap-2">
                <button onClick={() => onLayerOrderChange(element.id, 'front')} disabled={isAtFront} className="p-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" title="הבא לחזית"><ChevronsUp className="w-5 h-5 mx-auto"/></button>
                <button onClick={() => onLayerOrderChange(element.id, 'forward')} disabled={isAtFront} className="p-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" title="הזז קדימה"><ChevronUp className="w-5 h-5 mx-auto"/></button>
                <button onClick={() => onLayerOrderChange(element.id, 'backward')} disabled={isAtBack} className="p-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" title="הזז אחורה"><ChevronDown className="w-5 h-5 mx-auto"/></button>
                <button onClick={() => onLayerOrderChange(element.id, 'back')} disabled={isAtBack} className="p-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" title="שלח לרקע"><ChevronsDown className="w-5 h-5 mx-auto"/></button>
            </div>
        </div>
    );
};

const LayersList: React.FC<{
    elements: CanvasElement[];
    onSelectElement: (id: string) => void;
    onHoverElement: (id: string | null) => void;
    onDeleteElement: (id: string) => void;
    onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
}> = ({ elements, onSelectElement, onHoverElement, onDeleteElement, onUpdateElement }) => {
    const sortedElements = useMemo(() => [...elements].sort((a, b) => b.zIndex - a.zIndex), [elements]);

    return (
         <div className="p-2 space-y-1">
            {sortedElements.length > 0 ? (
                sortedElements.map(el => (
                    <div 
                        key={el.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-700 cursor-pointer"
                        onClick={() => onSelectElement(el.id)}
                        onMouseEnter={() => onHoverElement(el.id)}
                        onMouseLeave={() => onHoverElement(null)}
                    >
                         <button onClick={(e) => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }); }} className="text-slate-400 hover:text-white">
                            {el.locked ? <LockIcon className="w-4 h-4" /> : <UnlockIcon className="w-4 h-4" />}
                        </button>
                        <span className="flex-grow text-sm truncate" title={el.id}>{el.id}</span>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }} className="text-slate-400 hover:text-red-500">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))
            ) : (
                <p className="text-sm text-slate-400 text-center p-4">אין שכבות להצגה.</p>
            )}
        </div>
    );
};


export default Sidebar;