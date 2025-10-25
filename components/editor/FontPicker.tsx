import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { availableFonts } from '../fonts/FontManager';
import { ChevronDown } from '../Icons';

interface FontPickerProps {
    fontFamily: string;
    onChange: (newFont: string) => void;
    onPreviewStart: (font: string) => void;
    onPreviewEnd: () => void;
}

const FontPicker: React.FC<FontPickerProps> = ({ fontFamily, onChange, onPreviewStart, onPreviewEnd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

    const closePopover = useCallback(() => {
        setIsOpen(false);
        onPreviewEnd(); // Ensure preview stops when popover closes
    }, [onPreviewEnd]);

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
            const POPOVER_WIDTH = triggerRef.current.offsetWidth;
            const POPOVER_ESTIMATED_HEIGHT = 220; // from max-h-56
            const Gutter = 8;

            let top = rect.bottom + Gutter;
            let left = rect.left;

            if (top + POPOVER_ESTIMATED_HEIGHT > window.innerHeight - Gutter) {
                top = rect.top - POPOVER_ESTIMATED_HEIGHT - Gutter;
            }
            
            setPopoverStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                width: `${POPOVER_WIDTH}px`,
                zIndex: 50002,
            });
        }
    }, [isOpen]);

    const handleSelectFont = (newFont: string) => {
        onChange(newFont);
        closePopover();
    };

    const popoverContent = (
        <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={onPreviewEnd}
            className="rounded-lg shadow-lg bg-slate-800 border border-slate-700 text-white max-h-56 overflow-y-auto"
            style={popoverStyle}
        >
            <ul className="p-1">
                {availableFonts.map(font => (
                    <li key={font.name}>
                        <button
                            className="w-full text-right px-3 py-1.5 text-sm hover:bg-blue-600 rounded"
                            style={{ fontFamily: font.name }}
                            onMouseEnter={() => onPreviewStart(font.name)}
                            onClick={() => handleSelectFont(font.name)}
                        >
                            {font.name}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <div className="w-full">
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(o => !o)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 h-[30px] mt-1 text-sm flex justify-between items-center"
                style={{ fontFamily: fontFamily }}
            >
                <span>{fontFamily}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {isOpen && ReactDOM.createPortal(popoverContent, document.body)}
        </div>
    );
};

export default FontPicker;
