import React, { useState, Fragment, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { Template, CanvasElement, TextElement, ImageElement, TextStyle, CutterElement, ElementBase } from '../../types';
import { ElementType, hexToRgb } from '../../types';
import { TextIcon, ImageIcon, TrashIcon, ChevronDown, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, XIcon, ChevronsUp, ChevronUp, ChevronsDown, ScissorsIcon, BanIcon, ShadowIcon, AlignRightIcon, AlignCenterIcon, AlignLeftIcon, AlignJustifyIcon, LockIcon, UnlockIcon, BrushIcon, TextToImageIcon, PaletteIcon } from '../Icons';
import FontPicker from './FontPicker';
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
    onSetTemporaryFont: (fontFamily: string) => void;
    onClearTemporaryFont: () => void;
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
    formatBrushState, onToggleFormatBrush, onConvertTextToImage,
    onSetTemporaryFont, onClearTemporaryFont
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
                                onSetTemporaryFont={onSetTemporaryFont}
                                onClearTemporaryFont={onClearTemporaryFont}
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
    onSelectElement: (id: string | null) => void;
    onHoverElement: (id: string | null) => void;
    onDeleteElement: (id: string) => void;
    onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
}

const DefaultPanel: React.FC<DefaultPanelProps> = ({ onAddElement, template, onUpdateTemplate, openAccordion, onAccordionToggle, onSelectElement, onHoverElement, onDeleteElement, onUpdateElement }) => {
    const [imageTooltip, setImageTooltip] = useState<{ visible: boolean; src: string | null; x: number; y: number }>({ visible: false, src: null, x: 0, y: 0 });
    
    const sortedElements = useMemo(() => 
        [...template.elements].sort((a, b) => b.zIndex - a.zIndex), 
        [template.elements]
    );

    const masterCheckboxRef = useRef<HTMLInputElement>(null);
    const allLocked = sortedElements.length > 0 && sortedElements.every(el => el.locked);
    const someLocked = sortedElements.some(el => el.locked);

    useEffect(() => {
        if (masterCheckboxRef.current) {
            masterCheckboxRef.current.indeterminate = someLocked && !allLocked;
        }
    }, [someLocked, allLocked, sortedElements.length]);

    const handleToggleAllLocks = () => {
        const shouldLockAll = !allLocked;
        const newElements = template.elements.map(el => ({ ...el, locked: shouldLockAll }));
        onUpdateTemplate({ elements: newElements });
    };

    const handleToggleLock = (element: CanvasElement) => {
        onUpdateElement(element.id, { locked: !element.locked });
    };

    const renderBackgroundColorTrigger = (triggerProps: { ref: React.RefObject<HTMLButtonElement>; onClick: () => void; 'aria-haspopup': 'true'; 'aria-expanded': boolean }, color: string) => (
        <div className="relative group">
            <button
                {...triggerProps}
                type="button"
                className="w-10 h-10 flex flex-col items-center justify-center rounded transition-colors bg-slate-700 hover:bg-slate-600"
            >
                <PaletteIcon className="w-5 h-5 mb-1" />
                <div
                    className="w-6 h-1.5 rounded-full"
                    style={{
                        backgroundColor: color === 'transparent' ? '#808080' : color,
                        backgroundImage: color === 'transparent' ? `linear-gradient(45deg, #4c4c4c 25%, transparent 25%), linear-gradient(-45deg, #4c4c4c 25%, transparent 25%)` : 'none',
                        backgroundSize: '4px 4px',
                    }}
                />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                רקע
            </div>
        </div>
    );

    const getElementName = (element: CanvasElement): string => {
        switch (element.type) {
            case ElementType.Text:
                const text = (element as TextElement).spans.map(s => s.text).join('').replace(/\s+/g, ' ').trim();
                if (!text || text === '\u00A0') return 'טקסט ריק';
                return text.substring(0, 20) + (text.length > 20 ? '...' : '');
            case ElementType.Image:
                return "תמונה";
            case ElementType.Cutter:
                return "צורת חיתוך";
            default:
                // Fix: This case is unreachable with current types, but provides a fallback.
                // We cast `element` to access `id` since TypeScript correctly infers it as `never`.
                return (element as ElementBase).id;
        }
    };
    
    const handleMouseEnter = (event: React.MouseEvent, element: CanvasElement) => {
        onHoverElement(element.id);
        if (element.type === ElementType.Image && (element as ImageElement).src) {
            setImageTooltip({
                visible: true,
                src: (element as ImageElement).src,
                x: event.clientX,
                y: event.clientY,
            });
        }
    };

    const handleMouseLeave = () => {
        onHoverElement(null);
        setImageTooltip({ visible: false, src: null, x: 0, y: 0 });
    };

    return (
        <>
            <div className="p-4 border-b border-slate-700">
                <label className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 whitespace-nowrap">שם התבנית</span>
                    <input type="text" value={template.name} onChange={(e) => onUpdateTemplate({name: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm"/>
                </label>
            </div>

            <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">הוספת רכיבים</h3>
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
            
             <Accordion 
                title="הגדרות עמוד"
                isOpen={openAccordion === 'הגדרות עמוד'}
                onToggle={() => onAccordionToggle('הגדרות עמוד')}
            >
                 <div className="space-y-3">
                    <div className="flex gap-2">
                         <NumericStepper 
                            label="גובה"
                            value={template.height}
                            onChange={(newValue) => onUpdateTemplate({height: newValue})}
                            step={10}
                        />
                         <NumericStepper 
                            label="רוחב"
                            value={template.width}
                            onChange={(newValue) => onUpdateTemplate({width: newValue})}
                            step={10}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-400">רקע</span>
                        <ColorPicker
                            color={template.background_color}
                            onChange={(newColor) => onUpdateTemplate({ background_color: newColor })}
                            renderTrigger={renderBackgroundColorTrigger}
                        />
                    </div>
                 </div>
            </Accordion>

            <Accordion 
                title="רכיבים"
                isOpen={openAccordion === 'רכיבים'}
                onToggle={() => onAccordionToggle('רכיבים')}
            >
                {sortedElements.length > 0 && (
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                        <label htmlFor="toggle-all-lock" className="text-sm text-slate-400 cursor-pointer">
                            נעל הכל
                        </label>
                        <input
                            id="toggle-all-lock"
                            ref={masterCheckboxRef}
                            type="checkbox"
                            checked={allLocked}
                            onChange={handleToggleAllLocks}
                            className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-blue-500 focus:ring-blue-500 cursor-pointer"
                            title={allLocked ? "שחרר הכל" : "נעל הכל"}
                        />
                    </div>
                )}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {sortedElements.length > 0 ? (
                        sortedElements.map(element => (
                            <div
                                key={element.id}
                                onClick={() => onSelectElement(element.id)}
                                onMouseEnter={(e) => handleMouseEnter(e, element)}
                                onMouseLeave={handleMouseLeave}
                                className="flex items-center justify-between p-2 rounded-md hover:bg-slate-700 cursor-pointer"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {element.type === ElementType.Text && <TextIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                                    {element.type === ElementType.Image && <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                                    {element.type === ElementType.Cutter && <ScissorsIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                                    <span className="text-sm truncate" title={getElementName(element)}>
                                        {getElementName(element)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteElement(element.id);
                                        }}
                                        className="p-1 rounded-full text-slate-500 hover:bg-slate-600 hover:text-red-400 flex-shrink-0"
                                        title="מחק רכיב"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="checkbox"
                                        checked={element.locked || false}
                                        onChange={() => handleToggleLock(element)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-blue-500 focus:ring-blue-500 cursor-pointer"
                                        title={element.locked ? "שחרר נעילה" : "נעל רכיב"}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-2">אין רכיבים על הקנבס.</p>
                    )}
                </div>
            </Accordion>
             {imageTooltip.visible && imageTooltip.src && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: `${imageTooltip.y}px`,
                        left: `${imageTooltip.x}px`,
                        transform: 'translate(15px, -80px)',
                        pointerEvents: 'none',
                        zIndex: 10000,
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        border: '1px solid #4a5568',
                        borderRadius: '4px',
                        padding: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                >
                    <img src={imageTooltip.src} alt="תצוגה מקדימה" style={{ maxWidth: '90px', maxHeight: '90px', height: 'auto', display: 'block', borderRadius: '2px' }} />
                </div>,
                document.body
            )}
        </>
    );
};

interface TextPanelProps {
    element: TextElement;
    onUpdate: (id: string, updates: Partial<TextElement>) => void;
    onStyleUpdate: (styleUpdate: Partial<TextStyle>, isPreset?: boolean) => void;
    onAlignmentUpdate: (align: 'right' | 'center' | 'left' | 'justify') => void;
    activeStyle: TextStyle | null;
    openAccordion: string | null;
    onAccordionToggle: (title: string) => void;
    onSetTemporaryFont: (fontFamily: string) => void;
    onClearTemporaryFont: () => void;
}

const TextPanel: React.FC<TextPanelProps> = ({ element, onUpdate, onStyleUpdate, onAlignmentUpdate, activeStyle, openAccordion, onAccordionToggle, onSetTemporaryFont, onClearTemporaryFont }) => {
    const fontSizes = [8, 10, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72, 96, 120, 144, 192];

    const handleBlockUpdate = (prop: keyof TextElement, value: any) => {
        onUpdate(element.id, { [prop]: value } as Partial<TextElement>);
    };

    const handleStyleChange = (prop: keyof TextStyle, value: any, isPreset?: boolean) => {
        onStyleUpdate({ [prop]: value }, isPreset);
    }

    const baseStyle = activeStyle || element.spans[0]?.style;
    if (!baseStyle) return null; // Guard against an element somehow having no spans/style.

    // This is the fix. It ensures that any style object used for display
    // is complete, preventing crashes when accessing properties like .fontSize.
    const displayStyle: TextStyle = { ...defaultTextStyle, ...baseStyle };

    const { hex: bgColorHex, alpha: bgColorAlpha } = parseColor(element.backgroundColor);
    const outline = element.outline || { enabled: false, color: '#FFFFFF', width: 1 };

    const handleBgColorChange = (newColor: string) => {
        if (newColor === 'transparent') {
            handleBlockUpdate('backgroundColor', 'transparent');
            return;
        }
        const rgb = hexToRgb(newColor);
        if (rgb) {
            // If the color was transparent, make the new color fully opaque. Otherwise, keep the current alpha.
            const currentAlpha = element.backgroundColor === 'transparent' ? 1 : bgColorAlpha;
            const finalColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentAlpha})`;
            handleBlockUpdate('backgroundColor', finalColor);
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
    const SHADOW_VALUE = '2px 2px 6px rgba(0,0,0,0.75)';

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
        justify: { icon: AlignJustifyIcon, title: 'יישור לשני הצדדים' },
    };

    const renderBackgroundColorTrigger = (triggerProps: { ref: React.RefObject<HTMLButtonElement>; onClick: () => void; 'aria-haspopup': 'true'; 'aria-expanded': boolean }, color: string) => (
        <div className="relative group">
            <button
                {...triggerProps}
                type="button"
                className="w-10 h-10 flex flex-col items-center justify-center rounded transition-colors bg-slate-700 hover:bg-slate-600"
            >
                <PaletteIcon className="w-5 h-5 mb-1" />
                <div
                    className="w-6 h-1.5 rounded-full"
                    style={{
                        backgroundColor: color === 'transparent' ? '#808080' : color,
                        backgroundImage: color === 'transparent' ? `linear-gradient(45deg, #4c4c4c 25%, transparent 25%), linear-gradient(-45deg, #4c4c4c 25%, transparent 25%)` : 'none',
                        backgroundSize: '4px 4px',
                    }}
                />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                צבע רקע
            </div>
        </div>
    );

    const createStarPath = (points: number, outerRadius: number, innerRadius: number, centerX = 50, centerY = 50): string => {
        let path = '';
        const angle = Math.PI / points;
        for (let i = 0; i < 2 * points; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = centerX + radius * Math.sin(i * angle);
            const y = centerY - radius * Math.cos(i * angle);
            path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)} `;
        }
        return path + 'Z';
    };

    const createPolygonPath = (sides: number, radius: number, centerX = 50, centerY = 50): string => {
        let path = '';
        const angle = (2 * Math.PI) / sides;
        for (let i = 0; i < sides; i++) {
            const x = centerX + radius * Math.sin(i * angle);
            const y = centerY - radius * Math.cos(i * angle);
            path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)} `;
        }
        return path + 'Z';
    };

    const shapes: { name: TextElement['backgroundShape'], title: string, path: string }[] = [
        { name: 'rectangle', title: 'מלבן', path: 'M5,5 H95 V95 H5Z' },
        { name: 'rounded', title: 'מעוגל', path: 'M20,5 H80 C91.04,5 100,13.95 100,25 V75 C100,86.04 91.04,95 80,95 H20 C8.95,95 0,86.04 0,75 V25 C0,13.95 8.95,5 20,5Z' },
        { name: 'ellipse', title: 'אליפסה', path: 'M50,5 C25.14,5 5,25.14 5,50 S25.14,95 50,95 95,74.85 95,50 74.85,5 50,5Z' },
        { name: 'speech-bubble', title: 'בועת דיבור', path: 'M5,5 H95 V75 H30 L15,90 V75 H5Z' },
        { name: 'rhombus', title: 'מעוין', path: 'M50,5 L95,50 L50,95 L5,50Z' },
        { name: 'star', title: 'כוכב 5', path: createStarPath(5, 48, 18) },
        { name: 'starburst-8', title: 'כוכב 8', path: createStarPath(8, 48, 28) },
        { name: 'starburst-10', title: 'כוכב 10', path: createStarPath(10, 48, 33) },
        { name: 'starburst-12', title: 'כוכב 12', path: createStarPath(12, 48, 36) },
        { name: 'hexagon', title: 'משושה', path: createPolygonPath(6, 48) },
        { name: 'octagon', title: 'מתומן', path: createPolygonPath(8, 48) },
    ];
    
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
                        <FontPicker
                            fontFamily={displayStyle.fontFamily}
                            onChange={(newFont) => handleStyleChange('fontFamily', newFont)}
                            onPreviewStart={onSetTemporaryFont}
                            onPreviewEnd={onClearTemporaryFont}
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <NumericStepper
                            label="גודל"
                            value={displayStyle.fontSize}
                            onChange={(newSize, isPreset) => handleStyleChange('fontSize', newSize, isPreset)}
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
                        <div>
                            <span className="text-sm text-slate-400">צבע טקסט</span>
                             <div className="mt-1">
                                <ColorPicker 
                                    color={displayStyle.color}
                                    onChange={(newColor) => handleStyleChange('color', newColor)}
                                />
                             </div>
                        </div>
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
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-400">רקע</span>
                        <div className="flex items-center gap-3">
                            <ColorPicker
                                color={element.backgroundColor}
                                onChange={handleBgColorChange}
                                renderTrigger={renderBackgroundColorTrigger}
                            />
                            <div className="flex-grow flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round(bgColorAlpha * 100)}
                                    onChange={(e) => handleBgAlphaChange(parseInt(e.target.value, 10))}
                                    className="w-full"
                                    disabled={element.backgroundColor === 'transparent'}
                                    title="שקיפות רקע"
                                />
                                <span className="text-xs text-slate-400 w-8 text-right">{Math.round(bgColorAlpha * 100)}%</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-slate-400">צורת רקע</span>
                        <div className="mt-1 grid grid-cols-6 gap-2 p-1 bg-slate-900 rounded-md">
                            {shapes.map(shape => (
                                <button
                                    key={shape.name}
                                    title={shape.title}
                                    onClick={() => handleBlockUpdate('backgroundShape', shape.name)}
                                    className={`flex items-center justify-center h-10 rounded-md transition-colors ${element.backgroundShape === shape.name || (!element.backgroundShape && shape.name === 'rectangle') ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}`}
                                >
                                    <svg viewBox="0 0 100 100" className="w-6 h-6 text-white" style={{ stroke: 'currentColor', strokeWidth: 5, fill: 'none', strokeLinejoin: 'round' }}>
                                        <path d={shape.path} />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
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
                                 <div className="flex flex-col">
                                    <span className="text-sm text-slate-400">צבע</span>
                                     <div className="mt-1">
                                        <ColorPicker 
                                            color={outline.color}
                                            onChange={(newColor) => handleOutlineChange({ color: newColor })}
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
                    <div>
                        <span className="text-sm text-slate-400">יישור אופקי</span>
                         <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-md mt-1">
                            {(['right', 'center', 'left', 'justify'] as const).map(align => {
                                const Icon = alignMap[align].icon;
                                const isActive = element.textAlign === align && (!element.lineAlignments || element.lineAlignments.length === 0);
                                return (
                                    <button
                                        key={align}
                                        onClick={() => onAlignmentUpdate(align)}
                                        title={alignMap[align].title}
                                        className={`px-2 h-[30px] rounded flex items-center justify-center ${isActive ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
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
                    <div className="grid grid-cols-2 gap-2">
                        <NumericStepper
                            label="מתיחה אופקית %"
                            value={Math.round((element.scaleX ?? 1) * 100)}
                            onChange={(newValue) => handleBlockUpdate('scaleX', newValue / 100)}
                            min={10}
                            max={500}
                        />
                        <NumericStepper
                            label="מתיחה אנכית %"
                            value={Math.round((element.scaleY ?? 1) * 100)}
                            onChange={(newValue) => handleBlockUpdate('scaleY', newValue / 100)}
                            min={10}
                            max={500}
                        />
                    </div>
                     <NumericStepper
                        label="ריפוד"
                        value={element.padding}
                        onChange={(newValue) => handleBlockUpdate('padding', newValue)}
                        min={0}
                     />
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
        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
            <NumericStepper
                label="מיקום Y"
                value={Math.round(element.y)}
                onChange={(newValue) => handleUpdate('y', newValue)}
            />
            <NumericStepper
                label="מיקום X"
                value={Math.round(element.x)}
                onChange={(newValue) => handleUpdate('x', newValue)}
            />
            <NumericStepper
                label="גובה (H)"
                value={Math.round(element.height)}
                onChange={(newValue) => handleUpdate('height', newValue)}
                min={10}
            />
            <NumericStepper
                label="רוחב (W)"
                value={Math.round(element.width)}
                onChange={(newValue) => handleUpdate('width', newValue)}
                min={10}
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