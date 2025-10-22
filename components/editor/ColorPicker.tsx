import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { EyeDropperIcon, BanIcon, PlusIcon } from '../Icons';

const PRESET_COLORS = [
    ['#ffffff', '#f5f5f5', '#e0e0e0', '#b8b8b8', '#8f8f8f', '#4c4c4c', '#000000'],
    ['#ff00ff', '#9900ff', '#0000ff', '#00ccff', '#00ff00', '#ffff00', '#ff0000'],
    ['#ffe6ff', '#f0e6ff', '#e6e6ff', '#e6f9ff', '#e6ffe6', '#ffffcc', '#ffe6e6'],
    ['#f7a7f7', '#d2a7f7', '#a7a7f7', '#a7ecf7', '#a7f7a7', '#f7d2a7', '#f7a7a7'],
    ['#8e398e', '#79398e', '#39398e', '#399d8e', '#398e39', '#8e8e2d', '#8e3939'],
];


interface ColorPickerProps {
    color: string;
    onChange: (newColor: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const customColorInputRef = useRef<HTMLInputElement>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

    const closePopover = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen &&
                popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)
            ) {
                closePopover();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, closePopover]);
    
    useLayoutEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const POPOVER_WIDTH = 240; // from w-60 class
            const POPOVER_ESTIMATED_HEIGHT = 220; // Estimated height, adjust if content changes
            const Gutter = 8;

            let top = rect.bottom + Gutter;
            let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;

            // Adjust if it overflows the viewport
            if (left < Gutter) {
                left = Gutter;
            }
            if (left + POPOVER_WIDTH > window.innerWidth - Gutter) {
                left = window.innerWidth - POPOVER_WIDTH - Gutter;
            }
            if (top + POPOVER_ESTIMATED_HEIGHT > window.innerHeight - Gutter) {
                top = rect.top - POPOVER_ESTIMATED_HEIGHT - Gutter;
            }
            
            setPopoverStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 50001, // Ensure it's on top of everything, including the exit modal
            });
        }
    }, [isOpen]);

    const handleSelectColor = (newColor: string) => {
        onChange(newColor);
        closePopover();
    };

    const handleEyeDropper = async () => {
        if (!(window as any).EyeDropper) {
            alert('דפדפן זה אינו תומך בטפטפת.');
            return;
        }
        try {
            const eyeDropper = new (window as any).EyeDropper();
            const result = await eyeDropper.open();
            handleSelectColor(result.sRGBHex);
        } catch (e) {
            console.info('בחירת טפטפת בוטלה.');
        }
    };

    const popoverContent = (
        <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            className="w-60 rounded-lg shadow-lg bg-slate-800 border border-slate-700 text-white"
            style={popoverStyle}
        >
            <div className="p-2">
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={handleEyeDropper} className="p-2 rounded-full hover:bg-slate-700" title="טפטפת"><EyeDropperIcon className="w-5 h-5" /></button>
                    <div className="relative w-6 h-6">
                        <div 
                            className="w-full h-full rounded-full border border-slate-600 cursor-pointer flex items-center justify-center"
                            style={{ backgroundColor: color === 'transparent' ? '#ffffff' : color }}
                            onClick={() => customColorInputRef.current?.click()}
                        >
                            <PlusIcon className="w-4 h-4 text-white" style={{ mixBlendMode: 'difference' }} />
                        </div>
                        <input
                            ref={customColorInputRef}
                            type="color"
                            value={color === 'transparent' ? '#ffffff' : color}
                            className="absolute w-full h-full top-0 left-0 opacity-0 cursor-pointer"
                            onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                        />
                    </div>
                    <div className="flex-grow border-t border-slate-600 mx-2"></div>
                    <button onClick={() => handleSelectColor('transparent')} className="p-2 rounded-full hover:bg-slate-700" title="שקוף">
                        <BanIcon className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
    
                <div className="space-y-1">
                    {PRESET_COLORS.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-between gap-1">
                            {row.map(c => (
                                <button
                                    key={c}
                                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${color.toLowerCase() === c ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white' : ''}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => handleSelectColor(c)}
                                    aria-label={`Select color ${c}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div>
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(o => !o)}
                className="relative w-full h-[30px] rounded-md cursor-pointer bg-slate-900/50 p-0.5 ring-1 ring-slate-600 hover:ring-blue-500 transition-all shadow-inner shadow-black/20"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <div
                    className="w-full h-full rounded-sm"
                    style={{
                        backgroundColor: color,
                        backgroundImage: color === 'transparent'
                            ? `linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)`
                            : 'none',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                    }}
                />
            </button>
            {isOpen && ReactDOM.createPortal(popoverContent, document.body)}
        </div>
    );
};

export default ColorPicker;