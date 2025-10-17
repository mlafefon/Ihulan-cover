

import React, { useState, Fragment, useRef, useEffect } from 'react';
import type { Template, CanvasElement, TextElement, ImageElement, TextStyle, CutterElement } from '../../types';
import { ElementType } from '../../types';
import { TextIcon, ImageIcon, TrashIcon, ChevronDown, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, XIcon, ChevronsUp, ChevronUp, ChevronsDown, ScissorsIcon, BanIcon, ShadowIcon } from '../Icons';
import { availableFonts } from '../fonts/FontManager';
import NumericStepper from './NumericStepper';

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
    onApplyCut: () => void;
    isApplyingCut: boolean;
}

// Helpers
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : null;
};

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
    selectedElement, onUpdateElement, onAddElement, onDeleteElement, template, 
    onUpdateTemplate, onEditImage, onStyleUpdate, activeStyle, onDeselect, 
    onLayerOrderChange, onApplyCut, isApplyingCut
}) => {
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
                                activeStyle={activeStyle}
                             />
                        )}
                        {selectedElement.type === ElementType.Image && (
                            <ImagePanel element={selectedElement as ImageElement} onEditImage={onEditImage} />
                        )}
                        {(selectedElement.type === ElementType.Image || selectedElement.type === ElementType.Cutter || selectedElement.type === ElementType.Text) && (
                            <Accordion title="מיקום וגודל" defaultOpen>
                                <TransformPanel element={selectedElement} onUpdate={onUpdateElement} />
                            </Accordion>
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
    
    const buttonClass = "flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 px-2 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed h-[30px]";

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
                    <button onClick={() => onAddElement(ElementType.Cutter)} className="col-span-2 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 p-4 rounded-md">
                        <ScissorsIcon className="w-6 h-6" />
                        <span>הוסף צורת חיתוך</span>
                    </button>
                </div>
            </div>
             <div>
                <label className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 whitespace-nowrap">שם התבנית</span>
                    <input type="text" value={template.name} onChange={(e) => onUpdateTemplate({name: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"/>
                </label>
            </div>
             <Accordion title="הגדרות עמוד">
                 <div className="space-y-3">
                    <div className="flex gap-2">
                         <NumericStepper 
                            label="רוחב"
                            value={template.width}
                            onChange={(newValue) => onUpdateTemplate({width: newValue})}
                            step={10}
                        />
                         <NumericStepper 
                            label="גובה"
                            value={template.height}
                            onChange={(newValue) => onUpdateTemplate({height: newValue})}
                            step={10}
                        />
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
    const textColorInputRef = useRef<HTMLInputElement>(null);
    const bgColorInputRef = useRef<HTMLInputElement>(null);
    const outlineColorInputRef = useRef<HTMLInputElement>(null);

    const handleBlockUpdate = (prop: keyof TextElement, value: any) => {
        onUpdate(element.id, { [prop]: value } as Partial<TextElement>);
    };

    const handleStyleChange = (prop: keyof TextStyle, value: any) => {
        onStyleUpdate({ [prop]: value });
    }

    const displayStyle = activeStyle || element.spans[0]?.style;
    const { hex: bgColorHex, alpha: bgColorAlpha } = parseColor(element.backgroundColor);
    const outline = element.outline || { enabled: false, color: '#FFFFFF', width: 1 };

    const handleBgColorChange = (newHex: string) => {
        const rgb = hexToRgb(newHex);
        if (rgb) {
            // If the color was transparent, make the new color fully opaque. Otherwise, keep the alpha.
            const newAlpha = element.backgroundColor === 'transparent' ? 1 : bgColorAlpha;
            const newColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha})`;
            handleBlockUpdate('backgroundColor', newColor);
        }
    };

    const handleBgAlphaChange = (newAlphaPercent: number) => {
        const rgb = hexToRgb(bgColorHex);
        if (rgb) {
            const newColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlphaPercent / 100})`;
            handleBlockUpdate('backgroundColor', newColor);
        }
    };

    if (!displayStyle) return null; // Should not happen if element exists
    
    const hasShadow = displayStyle.textShadow && displayStyle.textShadow !== 'none' && displayStyle.textShadow !== '';
    const SHADOW_VALUE = '2px 2px 4px rgba(0,0,0,0.5)';

    const handleShadowToggle = () => {
        const newShadow = hasShadow ? '' : SHADOW_VALUE;
        handleStyleChange('textShadow', newShadow);
    };
    
    const handleOutlineChange = (updates: Partial<typeof outline>) => {
        onUpdate(element.id, { outline: { ...outline, ...updates } });
    };

    return (
        <div>
            <Accordion title="טיפוגרפיה וצבע" defaultOpen>
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-sm text-slate-400">פונט</span>
                         <select value={displayStyle.fontFamily} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-2 h-[30px] mt-1 text-sm">
                            {availableFonts.map(font => (
                                <option key={font.name} value={font.name} style={{fontFamily: font.name}}>
                                    {font.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <NumericStepper
                            label="גודל"
                            value={displayStyle.fontSize}
                            onChange={(newSize) => handleStyleChange('fontSize', newSize)}
                            min={1}
                        />
                        <label>
                            <span className="text-sm text-slate-400">משקל</span>
                            <select value={displayStyle.fontWeight} onChange={(e) => handleStyleChange('fontWeight', parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 h-[30px] mt-1 text-sm">
                                <option value="400">רגיל</option>
                                <option value="500">בינוני</option>
                                <option value="700">מודגש</option>
                                <option value="900">שחור</option>
                            </select>
                        </label>
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                         <label>
                            <span className="text-sm text-slate-400">צבע טקסט</span>
                            <div className="flex items-center gap-2 mt-1">
                                <div
                                    onClick={() => textColorInputRef.current?.click()}
                                    className="relative w-full h-[30px] rounded-md cursor-pointer bg-slate-900/50 p-0.5 ring-1 ring-slate-600 hover:ring-blue-500 transition-all shadow-inner shadow-black/20"
                                >
                                    <div className="w-full h-full rounded-sm" style={{ backgroundColor: displayStyle.color }} />
                                    <input
                                        ref={textColorInputRef}
                                        type="color"
                                        value={displayStyle.color}
                                        onChange={(e) => handleStyleChange('color', e.target.value)}
                                        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </label>
                        <div>
                            <span className="text-sm text-slate-400">צל טקסט</span>
                            <button
                                onClick={handleShadowToggle}
                                title={hasShadow ? "הסר צל טקסט" : "הוסף צל טקסט"}
                                className={`w-full flex items-center justify-center h-[30px] rounded mt-1 transition-colors ${hasShadow ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <ShadowIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                </div>
            </Accordion>

            <Accordion title="רקע וצורה">
                <div className="space-y-4">
                     <label>
                        <span className="text-sm text-slate-400">צבע רקע</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div
                                onClick={() => bgColorInputRef.current?.click()}
                                className="relative w-full h-[30px] rounded-md cursor-pointer bg-slate-900/50 p-0.5 ring-1 ring-slate-600 hover:ring-blue-500 transition-all shadow-inner shadow-black/20"
                            >
                                <div
                                    className="w-full h-full rounded-sm"
                                    style={{
                                        backgroundColor: element.backgroundColor,
                                        backgroundImage: element.backgroundColor === 'transparent'
                                            ? `linear-gradient(45deg, #ccc 25%, transparent 25%),
                                               linear-gradient(-45deg, #ccc 25%, transparent 25%),
                                               linear-gradient(45deg, transparent 75%, #ccc 75%),
                                               linear-gradient(-45deg, transparent 75%, #ccc 75%)`
                                            : 'none',
                                        backgroundSize: '10px 10px',
                                        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                                    }}
                                />
                                <input
                                    ref={bgColorInputRef}
                                    type="color"
                                    value={bgColorHex}
                                    onChange={(e) => handleBgColorChange(e.target.value)}
                                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                            <button
                                onClick={() => handleBlockUpdate('backgroundColor', 'transparent')}
                                className="h-[30px] w-[30px] bg-slate-700 hover:bg-slate-600 rounded flex-shrink-0 flex items-center justify-center"
                                title="הפוך רקע לשקוף"
                                aria-label="Set background to transparent"
                            >
                                <BanIcon className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </label>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">
                            שקיפות רקע: {Math.round(bgColorAlpha * 100)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(bgColorAlpha * 100)}
                            onChange={(e) => handleBgAlphaChange(parseInt(e.target.value, 10))}
                            className="w-full"
                        />
                    </div>
                    <label className="block">
                        <span className="text-sm text-slate-400">צורת רקע</span>
                         <select 
                            value={element.backgroundShape || 'rectangle'} 
                            onChange={(e) => handleBlockUpdate('backgroundShape', e.target.value as TextElement['backgroundShape'])} 
                            className="w-full bg-slate-700 border border-slate-600 rounded px-2 h-[30px] mt-1 text-sm"
                        >
                           <option value="rectangle">מלבן</option>
                           <option value="rounded">מלבן מעוגל</option>
                           <option value="ellipse">אליפסה</option>
                           <option value="sun">שמש</option>
                        </select>
                    </label>
                    <div className="space-y-2 pt-2 border-t border-slate-700">
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input 
                                type="checkbox"
                                checked={outline.enabled}
                                onChange={(e) => handleOutlineChange({ enabled: e.target.checked })}
                                className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-blue-500 focus:ring-blue-500"
                            />
                            <span>קו מתאר</span>
                        </label>
                        {outline.enabled && (
                            <div className="grid grid-cols-2 gap-2">
                                <NumericStepper 
                                    label="עובי (px)"
                                    value={outline.width}
                                    onChange={(newValue) => handleOutlineChange({ width: newValue })}
                                    min={0}
                                />
                                <label>
                                    <span className="text-xs text-slate-400">צבע</span>
                                    <div
                                        onClick={() => outlineColorInputRef.current?.click()}
                                        className="relative w-full h-[30px] rounded-md cursor-pointer bg-slate-900/50 p-0.5 ring-1 ring-slate-600 hover:ring-blue-500 transition-all shadow-inner shadow-black/20 mt-1"
                                    >
                                        <div className="w-full h-full rounded-sm" style={{ backgroundColor: outline.color }} />
                                        <input
                                            ref={outlineColorInputRef}
                                            type="color"
                                            value={outline.color}
                                            onChange={(e) => handleOutlineChange({ color: e.target.value })}
                                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </Accordion>

            <Accordion title="יישור ופריסה">
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-2">
                        <NumericStepper
                            label="מרווח שורות"
                            value={element.lineHeight}
                            onChange={(newValue) => handleBlockUpdate('lineHeight', newValue)}
                            step={0.1}
                            min={0}
                        />
                        <NumericStepper
                            label="מרווח אותיות"
                            value={element.letterSpacing}
                            onChange={(newValue) => handleBlockUpdate('letterSpacing', newValue)}
                        />
                    </div>
                     <NumericStepper
                        label="ריפוד"
                        value={element.padding}
                        onChange={(newValue) => handleBlockUpdate('padding', newValue)}
                        min={0}
                     />
                    <div>
                        <span className="text-sm text-slate-400">יישור אופקי</span>
                         <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-md mt-1">
                            {(['left', 'center', 'right'] as const).map(align => (
                                <button key={align} onClick={() => handleBlockUpdate('textAlign', align)} className={`px-2 h-[30px] rounded capitalize ${element.textAlign === align ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{align}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-slate-400">יישור אנכי</span>
                         <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-md mt-1">
                            <button onClick={() => handleBlockUpdate('verticalAlign', 'top')} className={`px-2 h-[30px] rounded ${element.verticalAlign === 'top' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}><AlignVerticalJustifyStart className="w-5 h-5 mx-auto"/></button>
                            <button onClick={() => handleBlockUpdate('verticalAlign', 'middle')} className={`px-2 h-[30px] rounded ${element.verticalAlign === 'middle' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}><AlignVerticalJustifyCenter className="w-5 h-5 mx-auto"/></button>
                            <button onClick={() => handleBlockUpdate('verticalAlign', 'bottom')} className={`px-2 h-[30px] rounded ${element.verticalAlign === 'bottom' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}><AlignVerticalJustifyEnd className="w-5 h-5 mx-auto"/></button>
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    );
};

const ImagePanel: React.FC<{ element: ImageElement; onEditImage: (element: ImageElement, newSrc?: string) => void }> = ({ element, onEditImage }) => {
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

    return (
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
    );
};

const TransformPanel: React.FC<{ element: CanvasElement; onUpdate: (id: string, updates: Partial<CanvasElement>) => void }> = ({ element, onUpdate }) => {
    const handleUpdate = (prop: keyof CanvasElement, value: number) => {
        if (!isNaN(value)) {
            onUpdate(element.id, { [prop]: value } as Partial<CanvasElement>);
        }
    };

    return (
        <div className="p-4 grid grid-cols-2 gap-x-2 gap-y-3">
            <NumericStepper
                label="רוחב (W)"
                value={Math.round(element.width)}
                onChange={(newValue) => handleUpdate('width', newValue)}
                min={10}
            />
            <NumericStepper
                label="גובה (H)"
                value={Math.round(element.height)}
                onChange={(newValue) => handleUpdate('height', newValue)}
                min={10}
            />
            <NumericStepper
                label="מיקום X"
                value={Math.round(element.x)}
                onChange={(newValue) => handleUpdate('x', newValue)}
            />
            <NumericStepper
                label="מיקום Y"
                value={Math.round(element.y)}
                onChange={(newValue) => handleUpdate('y', newValue)}
            />
            <div className="col-span-2">
                <NumericStepper
                    label="סיבוב (°)"
                    value={Math.round(element.rotation)}
                    onChange={(newValue) => handleUpdate('rotation', newValue)}
                    min={-360}
                    max={360}
                />
            </div>
        </div>
    )
};


export default Sidebar;