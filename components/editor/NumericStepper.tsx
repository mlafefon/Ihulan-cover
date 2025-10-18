import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from '../Icons';

interface NumericStepperProps {
    label: string;
    value: number;
    onChange: (newValue: number, isPreset?: boolean) => void;
    min?: number;
    max?: number;
    step?: number;
    toFixed?: number;
    presets?: number[];
}

const NumericStepper: React.FC<NumericStepperProps> = ({ 
    label, 
    value, 
    onChange, 
    min = -Infinity, 
    max = Infinity,
    step = 1,
    toFixed,
    presets,
}) => {
    const formatValue = (num: number) => {
        return toFixed !== undefined ? num.toFixed(toFixed) : num.toString();
    };

    const [inputValue, setInputValue] = useState(formatValue(value));
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // When the value prop changes from the parent, update our local input value.
    useEffect(() => {
        setInputValue(formatValue(value));
    }, [value, toFixed]);

    const handleIncrement = () => {
        onChange(Math.min(max, value + step));
    };

    const handleDecrement = () => {
        onChange(Math.max(min, value - step));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Just update the local state to allow the user to type freely.
        setInputValue(e.target.value);
    };

    const commitValue = () => {
        // Use parseFloat to handle both integers and floats.
        const parsedValue = parseFloat(inputValue);

        if (isNaN(parsedValue) || inputValue.trim() === '') {
            // If input is not a valid number or is empty, revert to the last valid prop value.
            setInputValue(formatValue(value));
        } else {
            const clampedValue = Math.max(min, Math.min(max, parsedValue));
            onChange(clampedValue);
            // The useEffect will handle syncing the inputValue if onChange causes a prop change.
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            // On Enter, commit the value and remove focus from the input.
            commitValue();
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            // On Escape, revert to the original value and remove focus.
            setInputValue(formatValue(value));
            e.currentTarget.blur();
        }
    };

    return (
        <div className="w-full" ref={wrapperRef}>
            <span className="text-sm text-slate-400">{label}</span>
            <div className="relative flex items-center mt-1">
                <input
                    type="number"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={commitValue}
                    onKeyDown={handleKeyDown}
                    step={step}
                    className={`w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm h-[30px] ${presets ? 'pl-12' : 'pl-8'}`}
                    aria-label={label}
                />
                <div className="absolute left-1 flex items-stretch h-full">
                    {presets && (
                        <button
                            onClick={() => setIsDropdownOpen(o => !o)}
                            className="w-6 flex items-center justify-center text-slate-400 hover:text-white"
                            aria-label="בחר גודל קבוע"
                            title="בחר גודל קבוע"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex flex-col items-center justify-center h-full">
                        <button 
                            onClick={handleIncrement} 
                            className="h-1/2 w-6 flex items-center justify-center text-slate-400 hover:text-white"
                            aria-label={`העלה ${label}`}
                        >
                            <ChevronUp className="w-4 h-4"/>
                        </button>
                        <button 
                            onClick={handleDecrement} 
                            className="h-1/2 w-6 flex items-center justify-center text-slate-400 hover:text-white"
                            aria-label={`הורד ${label}`}
                        >
                            <ChevronDown className="w-4 h-4"/>
                        </button>
                    </div>
                </div>
                {presets && isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-slate-600 border border-slate-500 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto w-full">
                        <ul className="py-1">
                            {presets.map(p => (
                                <li key={p}>
                                    <button
                                        className="w-full text-right px-3 py-1.5 text-sm hover:bg-blue-600"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onChange(p, true);
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        {p}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NumericStepper;