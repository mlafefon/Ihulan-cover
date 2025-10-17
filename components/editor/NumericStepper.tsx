import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from '../Icons';

interface NumericStepperProps {
    label: string;
    value: number;
    onChange: (newValue: number) => void;
    min?: number;
    max?: number;
    step?: number;
    toFixed?: number;
}

const NumericStepper: React.FC<NumericStepperProps> = ({ 
    label, 
    value, 
    onChange, 
    min = -Infinity, 
    max = Infinity,
    step = 1,
    toFixed,
}) => {
    const formatValue = (num: number) => {
        return toFixed !== undefined ? num.toFixed(toFixed) : num.toString();
    };

    const [inputValue, setInputValue] = useState(formatValue(value));

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
    
    const handleBlur = () => {
        commitValue();
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
        <div className="w-full">
            <span className="text-sm text-slate-400">{label}</span>
            <div className="relative flex items-center mt-1">
                <input
                    type="number"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    step={step}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 pl-8 text-sm h-[30px]"
                    aria-label={label}
                />
                <div className="absolute left-1 flex flex-col items-center justify-center h-full">
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
        </div>
    );
};

export default NumericStepper;