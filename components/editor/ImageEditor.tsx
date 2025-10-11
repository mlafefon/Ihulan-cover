import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw, EyeDropperIcon, BrushIcon } from '../Icons';

interface ImageEditorProps {
    imageSrc: string;
    elementWidth: number;
    elementHeight: number;
    onComplete: (newImageSrc: string) => void;
    onCancel: () => void;
}

// Helper to convert hex color to RGB object
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : null;
};

// Helper to calculate color distance
const colorDistance = (rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number => {
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
};


const Accordion: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-slate-700">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 hover:bg-slate-700/50">
                <span className="font-semibold text-sm">{title}</span>
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {isOpen && <div className="p-3 bg-slate-900/50">{children}</div>}
        </div>
    );
};

const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, elementWidth, elementHeight, onComplete, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [cropFrameSize, setCropFrameSize] = useState({ width: 0, height: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [filters, setFilters] = useState({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 });
    const [colorReplace, setColorReplace] = useState({ from: '#00ff00', to: '#ff00ff', tolerance: 20, enabled: false });
    const [isPickingColor, setIsPickingColor] = useState(false);

    const resetFilters = () => setFilters({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 });
    const resetColorReplace = () => setColorReplace(prev => ({ ...prev, enabled: false }));

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        const image = imageRef.current;
        const container = containerRef.current;

        if (!ctx || !image || !container || cropFrameSize.width === 0) return;

        const { width: canvasWidth, height: canvasHeight } = container.getBoundingClientRect();
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.save();
        ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;
        
        const centerX = canvasWidth / 2 + offset.x;
        const centerY = canvasHeight / 2 + offset.y;
        
        ctx.translate(centerX, centerY);
        ctx.scale(zoom, zoom);
        ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
        ctx.restore();
        
        if (colorReplace.enabled) {
            const fromRgb = hexToRgb(colorReplace.from);
            const toRgb = hexToRgb(colorReplace.to);
            if (fromRgb && toRgb) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const tolerance = colorReplace.tolerance * 2.55; 

                for (let i = 0; i < data.length; i += 4) {
                    const pixelRgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
                    if (colorDistance(pixelRgb, fromRgb) < tolerance) {
                        data[i] = toRgb.r;
                        data[i + 1] = toRgb.g;
                        data[i + 2] = toRgb.b;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }
        }

        // Draw crop overlay
        const cropX = (canvasWidth - cropFrameSize.width) / 2;
        const cropY = (canvasHeight - cropFrameSize.height) / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.rect(0, 0, canvasWidth, canvasHeight); // Outer rect
        ctx.rect(cropX + 1, cropY + 1, cropFrameSize.width - 2, cropFrameSize.height - 2); // Inner rect (hole)
        ctx.closePath();
        ctx.fill('evenodd');

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropX, cropY, cropFrameSize.width, cropFrameSize.height);
        ctx.restore();

    }, [zoom, offset, filters, cropFrameSize, colorReplace]);
    
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            const padding = 40;
            const containerWidth = container.offsetWidth - padding;
            const containerHeight = container.offsetHeight - padding;
            const aspectRatio = elementWidth / elementHeight;
            
            let newWidth = containerWidth;
            let newHeight = newWidth / aspectRatio;

            if (newHeight > containerHeight) {
                newHeight = containerHeight;
                newWidth = newHeight * aspectRatio;
            }
            setCropFrameSize({ width: newWidth, height: newHeight });
        }
    }, [elementWidth, elementHeight]);

    useEffect(() => {
        if (!imageSrc || cropFrameSize.width === 0) return;

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = imageSrc;
        image.onload = () => {
            imageRef.current = image;
            
            const scaleX = cropFrameSize.width / image.width;
            const scaleY = cropFrameSize.height / image.height;
            const initialZoom = Math.max(scaleX, scaleY);
            setMinZoom(initialZoom);
            setZoom(initialZoom);
            setOffset({x: 0, y: 0});
        };
    }, [imageSrc, cropFrameSize]);

    useEffect(() => {
        const image = imageRef.current;
        if (!image || !canvasRef.current) return;

        const maxX = Math.max(0, (image.width * zoom - cropFrameSize.width) / 2 / zoom);
        const maxY = Math.max(0, (image.height * zoom - cropFrameSize.height) / 2 / zoom);
        
        const clampedX = Math.max(-maxX, Math.min(maxX, offset.x));
        const clampedY = Math.max(-maxY, Math.min(maxY, offset.y));
        
        if (offset.x !== clampedX || offset.y !== clampedY) {
            setOffset({ x: clampedX, y: clampedY });
        }

    }, [offset, zoom, cropFrameSize, imageRef.current]);
    
    useEffect(() => {
        draw();
    }, [draw]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsPanning(true);
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleFactor = 1.1;
        const newZoom = e.deltaY < 0 ? zoom * scaleFactor : zoom / scaleFactor;
        const clampedZoom = Math.max(minZoom, newZoom);

        if (clampedZoom === zoom) return;
        
        const worldMouseX = (mouseX - (canvas.width/2 + offset.x)) / zoom;
        const worldMouseY = (mouseY - (canvas.height/2 + offset.y)) / zoom;

        const newOffsetX = offset.x - worldMouseX * (clampedZoom - zoom);
        const newOffsetY = offset.y - worldMouseY * (clampedZoom - zoom);
        
        setZoom(clampedZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isPickingColor) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { willReadFrequently: true });
            if (!ctx || !canvas) return;
    
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
            
            setColorReplace(prev => ({...prev, from: hex, enabled: true}));
            setIsPickingColor(false);
        }
    }
    
    const handleConfirm = () => {
        const offscreenCanvas = document.createElement('canvas');
        const ctx = offscreenCanvas.getContext('2d');
        const image = imageRef.current;

        if(!ctx || !image || cropFrameSize.width === 0) return;

        offscreenCanvas.width = elementWidth;
        offscreenCanvas.height = elementHeight;
        
        const finalScale = elementWidth / cropFrameSize.width;
        
        ctx.save();
        ctx.translate(elementWidth / 2, elementHeight / 2);
        ctx.scale(zoom * finalScale, zoom * finalScale);
        ctx.translate(offset.x, offset.y);
        
        ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;
        ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
        ctx.restore();

        if (colorReplace.enabled) {
            const fromRgb = hexToRgb(colorReplace.from);
            const toRgb = hexToRgb(colorReplace.to);
            if (fromRgb && toRgb) {
                const imageData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                const data = imageData.data;
                const tolerance = colorReplace.tolerance * 2.55; 

                for (let i = 0; i < data.length; i += 4) {
                    const pixelRgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
                    if (colorDistance(pixelRgb, fromRgb) < tolerance) {
                        data[i] = toRgb.r;
                        data[i + 1] = toRgb.g;
                        data[i + 2] = toRgb.b;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }
        }
        
        onComplete(offscreenCanvas.toDataURL());
    };

    return (
        <div className="flex h-screen bg-[#111827] text-white" dir="rtl">
            <main className="flex-grow flex flex-col">
                <header className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
                     <button onClick={onCancel} className="text-sm p-2 rounded hover:bg-slate-700">
                        X
                     </button>
                     <h2 className="font-bold text-lg">עורך תמונות</h2>
                     <div>
                        <button onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-2 px-4 rounded-md transition-colors mr-2">
                            בטל
                        </button>
                        <button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-sm font-medium py-2 px-4 rounded-md transition-colors">
                           אישור וחיתוך
                        </button>
                     </div>
                </header>
                <div ref={containerRef} className="flex-grow relative overflow-hidden" 
                    style={{ cursor: isPickingColor ? 'crosshair' : 'move' }}
                    onMouseDown={!isPickingColor ? handleMouseDown : undefined} 
                    onMouseUp={!isPickingColor ? handleMouseUp : undefined} 
                    onMouseLeave={!isPickingColor ? handleMouseUp : undefined} 
                    onMouseMove={!isPickingColor ? handleMouseMove : undefined} 
                    onWheel={handleWheel}
                    onClick={handleCanvasClick}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <canvas ref={canvasRef} />
                </div>
            </main>
            <aside className="w-96 bg-slate-800 flex flex-col border-r border-slate-700 overflow-y-auto">
                 <div className="p-3 border-b border-slate-700">
                    <h3 className="text-lg font-bold">מידע</h3>
                    <p className="text-xs text-slate-400">רזולוציית מקור: {imageRef.current?.width}x{imageRef.current?.height}</p>
                    <p className="text-xs text-slate-400">רזולוציית יעד: {Math.round(elementWidth)}x{Math.round(elementHeight)}</p>
                 </div>
                 <Accordion title="זום">
                    <div className="flex items-center gap-2">
                        <span>זום</span>
                        <input type="range" min={minZoom * 100} max="500" value={zoom * 100} onChange={e => setZoom(parseInt(e.target.value) / 100)} className="w-full" />
                        <span>{Math.round(zoom * 100)}%</span>
                    </div>
                </Accordion>
                <Accordion title="פילטרים">
                    <div className="space-y-2">
                        {(['brightness', 'contrast', 'saturate', 'grayscale', 'sepia'] as const).map(filter => (
                            <div key={filter} className="flex items-center gap-2 text-sm">
                                <span className="w-20 capitalize">{filter}</span>
                                <input type="range" min={filter.includes('gray') || filter.includes('sepia') ? 0 : 0} max={filter.includes('gray') || filter.includes('sepia') ? 100 : 200} value={filters[filter]} onChange={e => setFilters(f => ({ ...f, [filter]: parseInt(e.target.value)}))} className="w-full" />
                                <span className="w-8 text-right">{filters[filter]}%</span>
                            </div>
                        ))}
                         <button onClick={resetFilters} className="w-full mt-2 text-xs bg-slate-700 hover:bg-slate-600 p-2 rounded flex items-center justify-center gap-1">
                            <RotateCcw className="w-3 h-3"/>
                            אפס פילטרים
                        </button>
                    </div>
                </Accordion>
                <Accordion title="החלפת צבע">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsPickingColor(true)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded" title="בחר צבע מהתמונה">
                                <EyeDropperIcon className="w-5 h-5"/>
                            </button>
                            <label className="flex-grow">
                                <span className="text-xs text-slate-400">צבע מקור</span>
                                <input type="color" value={colorReplace.from} onChange={e => setColorReplace(prev => ({...prev, from: e.target.value, enabled: true}))} className="w-full h-8 bg-slate-700 border border-slate-600 rounded p-1 mt-1"/>
                            </label>
                            <label className="flex-grow">
                                <span className="text-xs text-slate-400">צבע יעד</span>
                                <input type="color" value={colorReplace.to} onChange={e => setColorReplace(prev => ({...prev, to: e.target.value, enabled: true}))} className="w-full h-8 bg-slate-700 border border-slate-600 rounded p-1 mt-1"/>
                            </label>
                            <button onClick={resetColorReplace} className="p-2 bg-slate-700 hover:bg-slate-600 rounded" title="אפס החלפת צבע">
                                <BrushIcon className="w-5 h-5"/>
                            </button>
                        </div>
                        <div>
                           <label className="text-sm text-slate-400">רגישות: {colorReplace.tolerance}</label>
                            <input type="range" min="0" max="100" value={colorReplace.tolerance} onChange={e => setColorReplace(prev => ({...prev, tolerance: parseInt(e.target.value), enabled: true}))} className="w-full mt-1" />
                        </div>
                    </div>
                </Accordion>
                <Accordion title="טשטוש">
                    <div className="text-center p-4 text-slate-400 text-sm">
                        בקרוב...
                    </div>
                </Accordion>
                <Accordion title="מסגרת">
                     <div className="text-center p-4 text-slate-400 text-sm">
                        בקרוב...
                    </div>
                </Accordion>
            </aside>
        </div>
    );
};

export default ImageEditor;
