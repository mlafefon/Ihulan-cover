import React, { useState, Fragment, useRef, useEffect } from 'react';
import type { Template, CanvasElement, TextElement, ImageElement, TextStyle, CutterElement } from '../../types';
import { ElementType } from '../../types';
import { TextIcon, ImageIcon, TrashIcon, ChevronDown, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, XIcon, ChevronsUp, ChevronUp, ChevronsDown, ScissorsIcon, BanIcon, ShadowIcon, AlignRightIcon, AlignCenterIcon, AlignLeftIcon } from '../Icons';
import { availableFonts } from '../fonts/FontManager';
import NumericStepper from './NumericStepper';
import { defaultTextStyle } from '../CanvasItem';

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
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    useEffect(() => {
        if (selectedElement) {
            setElementId(selectedElement.id);
        }
    }, [selectedElement]);

    useEffect(() => {
        if (selectedElement) {
            if (selectedElement.type === ElementType.Text) {
                setOpenAccordion('טיפוגרפיה וצבע');
            } else {
                setOpenAccordion('מיקום וגודל');
            }
        } else {
            setOpenAccordion('הגדרות עמוד');
        }
    }, [selectedElement?.id]);

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
                            <button onClick={() => onDeleteElement(selectedElement.id)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2">
                                <TrashIcon className="w-4 h-4" />
                                מחק רכיב
                            </button>
                        </div>
                    </>
                ) : (
                    <DefaultPanel 
                        onAddElement={onAddElement} 
                        template={template} 
                        onUpdateTemplate={onUpdateTemplate}
                        openAccordion={openAccordion}
                        onAccordionToggle={handleAccordionToggle}
                    />
                )}
            </div>
        </aside>
    );
};

const Accordion: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, children, isOpen, onToggle }) => {
    const [isOverflowVisible, setIsOverflowVisible] = useState(false);

    useEffect(() => {
        // After the accordion opens, make its overflow visible so dropdowns can appear above other elements.
        // When it closes, immediately hide overflow to allow the height transition to work correctly.
        if (isOpen) {
            const timer = setTimeout(() => {
                setIsOverflowVisible(true);
            }, 500); // This duration should match the Tailwind CSS transition duration (duration-500).
            return () => clearTimeout(timer);
        } else {
            setIsOverflowVisible(false);
        }
    }, [isOpen]);
    
    return (
        // Add `position: relative` to create a stacking context.
        // The open accordion gets a higher z-index to ensure its children (like dropdowns) render above sibling accordions.
        <div className={`border-b border-slate-700 relative ${isOpen ? 'z-10' : 'z-0'}`}>
            <button onClick={onToggle} className="w-full flex items-center p-4 hover:bg-slate-700/50 gap-2">
                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                <span className="font-semibold">{title}</span>
            </button>
            <div className={`transition-all duration-500 ease-in-out ${isOverflowVisible ? 'overflow-visible' : 'overflow-hidden'} ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="py-4 pl-4 pr-11 bg-slate-900/50">{children}</div>
            </div>
        </div>
    );
};

const LayerPanel: React.FC<{ element: CanvasElement, onLayerOrderChange: SidebarProps['onLayerOrderChange'], totalElements: number}> = ({ element, onLayerOrderChange, totalElements }) => {
    const isAtBack = element.zIndex <= 1;
    const isAtFront = element.zIndex >= totalElements;
    
    const buttonClass = "flex items-center justify-center bg-slate-700 hover:bg-slate-600 px-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed h-[30px]";

    return (
        <div className="grid grid-cols-4 gap-2">
            <button onClick={() => onLayerOrderChange(element.id, 'front')} disabled={isAtFront} className={buttonClass} title="הבא לקדמה">
                <ChevronsUp className="w-5 h-5"/>
            </button>
            <button onClick={() => onLayerOrderChange(element.id, 'forward')} disabled={isAtFront} className={buttonClass} title="הזז קדימה">
                <ChevronUp className="w-5 h-5"/>
            </button>
            <button onClick={() => onLayerOrderChange(element.id, 'backward')} disabled={isAtBack} className={buttonClass} title="שלח לאחור">
                <ChevronDown className="w-5 h-5"/>
            </button>
            <button onClick={() => onLayerOrderChange(element.id, 'back')} disabled={isAtBack} className={buttonClass} title="שלח לרקע">
                <ChevronsDown className="w-5 h-5"/>
            </button>
        </div>
    );
}

interface DefaultPanelProps {
    onAddElement: (type: ElementType, payload?: { src: string }) => void;
    template: Template;
    onUpdateTemplate: (settings: Partial<Template>) => void;
    openAccordion: string | null;
    onAccordionToggle: (title: string) => void;
}

const DefaultPanel: React.FC<DefaultPanelProps> = ({ onAddElement, template, onUpdateTemplate, openAccordion, onAccordionToggle }) => {
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
             <Accordion 
                title="הגדרות עמוד"
                isOpen={openAccordion === 'הגדרות עמוד'}
                onToggle={() => onAccordionToggle('הגדרות עמוד')}
            >
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
    openAccordion: string | null;
    onAccordionToggle: (title: string) => void;
}

const TextPanel: React.FC<TextPanelProps> = ({ element, onUpdate, onStyleUpdate, activeStyle, openAccordion, onAccordionToggle }) => {
    const textColorInputRef = useRef<HTMLInputElement>(null);
    const bgColorInputRef = useRef<HTMLInputElement>(null);
    const outlineColorInputRef = useRef<HTMLInputElement>(null);
    const fontSizes = [8, 10, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72, 96];

    const handleBlockUpdate = (prop: keyof TextElement, value: any) => {
        onUpdate(element.id, { [prop]: value } as Partial<TextElement>);
    };

    const handleStyleChange = (prop: keyof TextStyle, value: any) => {
        onStyleUpdate({ [prop]: value });
    }

    const baseStyle = activeStyle || element.spans[0]?.style;
    if (!baseStyle) return null; // Guard against an element somehow having no spans/style.

    // This is the fix. It ensures that any style object used for display
    // is complete, preventing crashes when accessing properties like .fontSize.
    const displayStyle: TextStyle = { ...defaultTextStyle, ...baseStyle };

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
    
    const hasShadow = displayStyle.textShadow && displayStyle.textShadow !== 'none' && displayStyle.textShadow !== '';
    const SHADOW_VALUE = '2px 2px 4px rgba(0,0,0,0.5)';

    const handleShadowToggle = () => {
        const newShadow = hasShadow ? '' : SHADOW_VALUE;
        handleStyleChange('textShadow', newShadow);
    };
    
    const handleOutlineChange = (updates: Partial<typeof outline>) => {
        onUpdate(element.id, { outline: { ...outline, ...updates } });
    };

    const alignMap = {
        right: { icon: AlignRightIcon, title: 'יישור לימין' },
        center: { icon: AlignCenterIcon, title: 'יישור למרכז' },
        left: { icon: AlignLeftIcon, title: 'יישור לשמאל' },
    };

    return (
        <div>
            <Accordion 
                title="טיפוגרפיה וצבע" 
                isOpen={openAccordion === 'טיפוגרפיה וצבע'}
                onToggle={() => onAccordionToggle('טיפוגרפיה וצבע')}
            >
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
                            presets={fontSizes}
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

            <Accordion 
                title="רקע וצורה"
                isOpen={openAccordion === 'רקע וצורה'}
                onToggle={() => onAccordionToggle('רקע וצורה')}
            >
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
                            <div className="grid grid-cols-2 gap-2 items-end">
                                <NumericStepper 
                                    label="עובי"
                                    value={outline.width}
                                    onChange={(newValue) => handleOutlineChange({ width: newValue })}
                                    min={0}
                                />
                                <div>
                                    <span className="text-sm text-slate-400">צבע</span>
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
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Accordion>

            <Accordion 
                title="יישור ופריסה"
                isOpen={openAccordion === 'יישור ופריסה'}
                onToggle={() => onAccordionToggle('יישור ופריסה')}
            >
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-2">
                        <NumericStepper
                            label="מרווח שורות"
                            value={displayStyle.lineHeight || 1.2}
                            onChange={(newValue) => handleStyleChange('lineHeight', newValue)}
                            step={0.1}
                            min={0}
                            toFixed={1}
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
                            {(['right', 'center', 'left'] as const).map(align => {
                                const Icon = alignMap[align].icon;
                                return (
                                    <button
                                        key={align}
                                        onClick={() => handleBlockUpdate('textAlign', align)}
                                        title={alignMap[align].title}
                                        className={`px-2 h-[30px] rounded flex items-center justify-center ${element.textAlign === align ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                                    >
                                        <Icon className="w-5 h-5 mx-auto" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-slate-400">יישור אנכי</span>
                         <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-md mt-1">
                            <button 
                                onClick={() => handleBlockUpdate('verticalAlign', 'top')} 
                                title="יישור למעלה"
                                className={`px-2 h-[30px] rounded ${element.verticalAlign === 'top' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <AlignVerticalJustifyEnd className="w-5 h-5 mx-auto"/>
                            </button>
                            <button 
                                onClick={() => handleBlockUpdate('verticalAlign', 'middle')} 
                                title="יישור למרכז"
                                className={`px-2 h-[30px] rounded ${element.verticalAlign === 'middle' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <AlignVerticalJustifyCenter className="w-5 h-5 mx-auto"/>
                            </button>
                            <button 
                                onClick={() => handleBlockUpdate('verticalAlign', 'bottom')} 
                                title="יישור למטה"
                                className={`px-2 h-[30px] rounded ${element.verticalAlign === 'bottom' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <AlignVerticalJustifyStart className="w-5 h-5 mx-auto"/>
                            </button>
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