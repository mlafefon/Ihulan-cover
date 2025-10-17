import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw, EyeDropperIcon, BrushIcon } from '../Icons';
import type { ImageEditState } from '../../types';

interface ImageEditorProps {
    imageSrc: string;
    elementWidth: number;
    elementHeight: number;
    onComplete: (data: { newSrc: string; newOriginalSrc: string; editState: ImageEditState; }) => void;
    onCancel: () => void;
    initialEditState?: ImageEditState;
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

const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, elementWidth, elementHeight, onComplete, onCancel, initialEditState }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastPointRef = useRef<{ x: number, y: number } | null>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);
    const isNewImageRef = useRef(false);
    
    const [originalImageSrc, setOriginalImageSrc] = useState(imageSrc);
    const [currentSrc, setCurrentSrc] = useState(imageSrc);

    const [cropFrameSize, setCropFrameSize] = useState({ width: 0, height: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(1.0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [filters, setFilters] = useState({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 });
    const [colorReplace, setColorReplace] = useState({ from: '#00ff00', to: '#ff00ff', tolerance: 20, enabled: false });
    const [isPickingColor, setIsPickingColor] = useState(false);
    const [frame, setFrame] = useState({ thickness: 0, style: 'none', color: '#000000' });

    // Blur states
    const [blurTool, setBlurTool] = useState<'brush' | 'eraser' | null>(null);
    const [brushSize, setBrushSize] = useState(20);
    const [isBlurApplied, setIsBlurApplied] = useState(false);
    const [isDrawingMask, setIsDrawingMask] = useState(false);
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
    const [hasMask, setHasMask] = useState(false);

    const resetFilters = () => setFilters({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 });
    const resetColorReplace = () => setColorReplace(prev => ({ ...prev, enabled: false }));

    const handleResetBlur = useCallback(() => {
        const maskCtx = maskCanvasRef.current?.getContext('2d');
        if (maskCtx && maskCanvasRef.current) {
            maskCtx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        }
        setIsBlurApplied(false);
        setHasMask(false);
        setBlurTool(null);
    }, []);

    const resetAllEdits = useCallback(() => {
        resetFilters();
        resetColorReplace();
        handleResetBlur();
        setFrame({ thickness: 0, style: 'none', color: '#000000' });
        setOffset({ x: 0, y: 0 });
        // Zoom is reset in the image onload effect
    }, [handleResetBlur]);

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;

        maskCtx.beginPath();
        maskCtx.moveTo(x1, y1);
        maskCtx.lineTo(x2, y2);
        maskCtx.stroke();
    }
    
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        const image = imageRef.current;
        const container = containerRef.current;
        const maskCanvas = maskCanvasRef.current;

        if (!ctx || !image || !container || cropFrameSize.width === 0 || !maskCanvas) return;

        const { width: canvasWidth, height: canvasHeight } = container.getBoundingClientRect();
        [canvas, maskCanvas].forEach(c => {
            if(c && (c.width !== image.width || c.height !== image.height)) {
                c.width = image.width;
                c.height = image.height;
            }
        });

        // Create filtered image on an offscreen canvas
        const filteredImageCanvas = document.createElement('canvas');
        filteredImageCanvas.width = image.width;
        filteredImageCanvas.height = image.height;
        const filteredCtx = filteredImageCanvas.getContext('2d', { willReadFrequently: true });
        if (!filteredCtx) return;

        filteredCtx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;
        filteredCtx.drawImage(image, 0, 0);

        if (colorReplace.enabled) {
            // Apply color replace to the filtered image
            const fromRgb = hexToRgb(colorReplace.from);
            const toRgb = hexToRgb(colorReplace.to);
            if (fromRgb && toRgb) {
                const imageData = filteredCtx.getImageData(0, 0, image.width, image.height);
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
                filteredCtx.putImageData(imageData, 0, 0);
            }
        }
        
        // Final composition on the main canvas
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.save();
        ctx.translate(canvasWidth / 2 + offset.x, canvasHeight / 2 + offset.y);
        ctx.scale(zoom, zoom);
        
        if (isBlurApplied && hasMask) {
            // Draw blurred version
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = image.width;
            blurCanvas.height = image.height;
            const blurCtx = blurCanvas.getContext('2d');
            if (blurCtx) {
                blurCtx.filter = 'blur(4px)';
                blurCtx.drawImage(filteredImageCanvas, 0, 0);
                ctx.drawImage(blurCanvas, -image.width / 2, -image.height / 2);
            }
            
            // "Cut out" sharp area using mask
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(maskCanvas, -image.width / 2, -image.height / 2);
            ctx.restore();
            
            // Draw sharp image underneath
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(filteredImageCanvas, -image.width / 2, -image.height / 2);
            ctx.restore();
        } else {
             // Draw non-blurred image
            ctx.drawImage(filteredImageCanvas, -image.width / 2, -image.height / 2);
        }

        // Draw mask overlay if in drawing mode
        if (blurTool && hasMask) {
            // This logic correctly creates a purple overlay from the mask without affecting the underlying image
            const overlayCanvas = document.createElement('canvas');
            overlayCanvas.width = image.width;
            overlayCanvas.height = image.height;
            const overlayCtx = overlayCanvas.getContext('2d');

            if (overlayCtx) {
                // 1. Draw the mask onto the temporary canvas
                overlayCtx.drawImage(maskCanvas, 0, 0);

                // 2. Use 'source-in' to color the mask strokes purple
                overlayCtx.globalCompositeOperation = 'source-in';
                overlayCtx.fillStyle = 'purple';
                overlayCtx.fillRect(0, 0, image.width, image.height);
                
                // 3. Draw the resulting purple overlay onto the main canvas
                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.drawImage(overlayCanvas, -image.width / 2, -image.height / 2);
                ctx.restore();
            }
        }
        
        ctx.restore(); // Restore from zoom/pan

        // Draw crop overlay
        const cropX = (canvasWidth - cropFrameSize.width) / 2;
        const cropY = (canvasHeight - cropFrameSize.height) / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.rect(0, 0, canvasWidth, canvasHeight);
        ctx.rect(cropX + 1, cropY + 1, cropFrameSize.width - 2, cropFrameSize.height - 2);
        ctx.closePath();
        ctx.fill('evenodd');
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropX, cropY, cropFrameSize.width, cropFrameSize.height);
        ctx.restore();

        // Draw frame preview
        if (frame.thickness > 0 && frame.style !== 'none') {
            ctx.save();
            ctx.strokeStyle = frame.color;
            ctx.lineWidth = frame.thickness;
            const frameRectX = cropX + frame.thickness / 2;
            const frameRectY = cropY + frame.thickness / 2;
            const frameRectWidth = cropFrameSize.width - frame.thickness;
            const frameRectHeight = cropFrameSize.height - frame.thickness;

            if (frameRectWidth > 0 && frameRectHeight > 0) {
                if (frame.style === 'dashed') {
                    ctx.setLineDash([15, 10]);
                } else if (frame.style === 'dotted') {
                    ctx.setLineDash([2, 5]);
                }

                ctx.strokeRect(frameRectX, frameRectY, frameRectWidth, frameRectHeight);

                if (frame.style === 'double') {
                    const inset = frame.thickness * 0.3;
                    ctx.lineWidth = Math.max(1, frame.thickness * 0.2);
                    ctx.strokeRect(
                        frameRectX + inset,
                        frameRectY + inset,
                        frameRectWidth - inset * 2,
                        frameRectHeight - inset * 2
                    );
                }
            }
            ctx.restore();
        }

        // Draw custom brush cursor
        if (blurTool && mousePos) {
            ctx.beginPath();
            ctx.arc(mousePos.x, mousePos.y, brushSize / 2 * zoom, 0, Math.PI * 2);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }, [zoom, offset, filters, cropFrameSize, colorReplace, isBlurApplied, hasMask, blurTool, brushSize, mousePos, frame]);

    const handleImageReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const newImageSrc = event.target.result as string;
                    isNewImageRef.current = true;
                    setCurrentSrc(newImageSrc);
                    setOriginalImageSrc(newImageSrc);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
         if (e.target) e.target.value = '';
    };

    const handleApplyBlur = () => {
        setIsBlurApplied(true);
        setBlurTool(null);
    }
    
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            const padding = 40;
            const workspaceWidth = container.offsetWidth - padding;
            const workspaceHeight = container.offsetHeight - padding;
    
            let frameWidth = elementWidth;
            let frameHeight = elementHeight;
    
            // Check if the original element size overflows the workspace
            if (elementWidth > workspaceWidth || elementHeight > workspaceHeight) {
                const aspectRatio = elementWidth / elementHeight;
                const targetWidth = workspaceWidth * 0.8;
                const targetHeight = workspaceHeight * 0.8;
                
                frameWidth = targetWidth;
                frameHeight = frameWidth / aspectRatio;
    
                if (frameHeight > targetHeight) {
                    frameHeight = targetHeight;
                    frameWidth = frameHeight * aspectRatio;
                }
            }
            
            setCropFrameSize({ width: frameWidth, height: frameHeight });
        }
    }, [elementWidth, elementHeight]);

    useEffect(() => {
        if (!currentSrc || cropFrameSize.width === 0) return;

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = currentSrc;
        image.onload = () => {
            imageRef.current = image;
            if (maskCanvasRef.current) {
                maskCanvasRef.current.width = image.width;
                maskCanvasRef.current.height = image.height;
            }

            // The zoom level required to make the image cover the crop frame.
            const zoomToFill = Math.max(cropFrameSize.width / image.width, cropFrameSize.height / image.height);
            
            // The zoom level that corresponds to a 1:1 pixel mapping from the cropped area
            // to the final element size. This is the max zoom to prevent upscaling.
            const qualityLimitZoom = elementWidth > 0 ? cropFrameSize.width / elementWidth : 1.0;

            let initialZoomValue: number;
            let minZoomValue: number;
            let maxZoomValue: number;

            // Condition: Is the source image smaller than the final destination element?
            if (image.width < elementWidth && image.height < elementHeight) {
                // Case 1: Small image. Display it proportionally, but don't scale it up.
                // The zoom is fixed to the level that represents its "natural" size relative to the final output.
                // Min and max are set to the same value to disable the slider.
                initialZoomValue = qualityLimitZoom;
                minZoomValue = qualityLimitZoom;
                maxZoomValue = qualityLimitZoom;
            } else {
                // Case 2: Large image. It must fill the frame.
                minZoomValue = zoomToFill;
                initialZoomValue = zoomToFill; // Start by filling the frame.
                maxZoomValue = qualityLimitZoom;
                
                // If filling the frame (minZoom) already requires more zoom than the quality allows (maxZoom),
                // it means we must upscale to fill. In this case, we allow that initial upscale but disable
                // any *further* zooming by setting maxZoom equal to minZoom.
                if (minZoomValue > maxZoomValue) {
                    maxZoomValue = minZoomValue;
                }
            }

            setMinZoom(minZoomValue);
            setMaxZoom(maxZoomValue);

            const isReplacing = isNewImageRef.current;
            if (isReplacing) {
                isNewImageRef.current = false;
            }

            if (initialEditState && !isReplacing) {
                // Determine the new zoom level, clamped within the new min/max bounds.
                const newZoom = Math.max(minZoomValue, Math.min(maxZoomValue, initialEditState.zoom));
                
                // Calculate the maximum allowed offset based on the NEW zoom level.
                const maxX = Math.max(0, (image.width * newZoom - cropFrameSize.width) / 2);
                const maxY = Math.max(0, (image.height * newZoom - cropFrameSize.height) / 2);

                // Clamp the initial offset from the saved state to these new bounds.
                const clampedOffset = {
                    x: Math.max(-maxX, Math.min(maxX, initialEditState.offset.x)),
                    y: Math.max(-maxY, Math.min(maxY, initialEditState.offset.y)),
                };

                // Set all states based on the calculated and clamped values.
                setZoom(newZoom);
                setOffset(clampedOffset);
                setFilters(initialEditState.filters);
                setColorReplace(initialEditState.colorReplace);
                setFrame(initialEditState.frame);
                setIsBlurApplied(initialEditState.isBlurApplied);
                setHasMask(initialEditState.hasMask);
                
                // When loading state, we still need to clear any existing mask first
                // before drawing the new one.
                const maskCtx = maskCanvasRef.current?.getContext('2d');
                if (maskCtx && maskCanvasRef.current) {
                    maskCtx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
                }
                
                if (initialEditState.maskDataUrl && maskCanvasRef.current) {
                    const maskImg = new Image();
                    maskImg.src = initialEditState.maskDataUrl;
                    maskImg.onload = () => {
                        maskCanvasRef.current?.getContext('2d')?.drawImage(maskImg, 0, 0);
                    };
                }
            } else {
                // This branch handles both a newly replaced image, and the initial load of an
                // element that has no prior editState. In both cases, we reset.
                resetAllEdits();
                setZoom(initialZoomValue);
                setOffset({ x: 0, y: 0 });
            }
        };
    }, [currentSrc, cropFrameSize, initialEditState, elementWidth, elementHeight, resetAllEdits]);
    
    useEffect(() => {
        draw();
    }, [draw]);

    const getCoordsOnImage = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return null;

        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        const imageX = (canvasX - (canvas.width / 2 + offset.x)) / zoom + image.width / 2;
        const imageY = (canvasY - (canvas.height / 2 + offset.y)) / zoom + image.height / 2;

        return { x: imageX, y: imageY };
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (blurTool) {
            setIsDrawingMask(true);
            const pos = getCoordsOnImage(e);
            if (pos) {
                lastPointRef.current = pos;
            }
        } else {
            setIsPanning(true);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setIsDrawingMask(false);
        lastPointRef.current = null;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const pos = {x: e.clientX, y: e.clientY};
        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        
        if (isPanning) {
            const image = imageRef.current;
            if (!image || cropFrameSize.width === 0) return;
            
            setOffset(prev => {
                const newOffsetX = prev.x + e.movementX;
                const newOffsetY = prev.y + e.movementY;
    
                const maxX = Math.max(0, (image.width * zoom - cropFrameSize.width) / 2);
                const maxY = Math.max(0, (image.height * zoom - cropFrameSize.height) / 2);
    
                const clampedX = Math.max(-maxX, Math.min(maxX, newOffsetX));
                const clampedY = Math.max(-maxY, Math.min(maxY, newOffsetY));
    
                return { x: clampedX, y: clampedY };
            });
        } else if (isDrawingMask && blurTool) {
            const maskCanvas = maskCanvasRef.current;
            if (!maskCanvas) return;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) return;

            const currentPoint = getCoordsOnImage(e);
            if (!currentPoint) return;
            
            maskCtx.lineCap = 'round';
            maskCtx.lineJoin = 'round';
            maskCtx.lineWidth = brushSize;
            
            if (blurTool === 'brush') {
                maskCtx.globalCompositeOperation = 'source-over';
                maskCtx.strokeStyle = 'white';
            } else { // eraser
                maskCtx.globalCompositeOperation = 'destination-out';
                maskCtx.strokeStyle = 'rgba(0,0,0,1)';
            }
            if (lastPointRef.current) {
                drawLine(lastPointRef.current.x, lastPointRef.current.y, currentPoint.x, currentPoint.y);
            }
            lastPointRef.current = currentPoint;
            setHasMask(true);
        }
    };
    const handleMouseLeave = () => {
        setIsPanning(false);
        setIsDrawingMask(false);
        lastPointRef.current = null;
        setMousePos(null);
    }
    
    // Unified function to handle all zoom updates and ensure offset is clamped.
    const updateZoom = useCallback((newZoomValue: number, focalPoint?: { x: number; y: number }) => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return;

        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoomValue));

        if (clampedZoom === zoom) return;
        
        let newOffsetX = offset.x;
        let newOffsetY = offset.y;

        if (focalPoint) {
            // Mouse-centric zoom logic
            const worldMouseX = (focalPoint.x - (canvas.width / 2 + offset.x)) / zoom;
            const worldMouseY = (focalPoint.y - (canvas.height / 2 + offset.y)) / zoom;
            newOffsetX = offset.x - worldMouseX * (clampedZoom - zoom);
            newOffsetY = offset.y - worldMouseY * (clampedZoom - zoom);
        } else {
            // Slider/center-based zoom logic: scale the offset proportionally.
            const zoomRatio = clampedZoom / zoom;
            newOffsetX *= zoomRatio;
            newOffsetY *= zoomRatio;
        }

        const maxX = Math.max(0, (image.width * clampedZoom - cropFrameSize.width) / 2);
        const maxY = Math.max(0, (image.height * clampedZoom - cropFrameSize.height) / 2);

        const clampedX = Math.max(-maxX, Math.min(maxX, newOffsetX));
        const clampedY = Math.max(-maxY, Math.min(maxY, newOffsetY));
        
        setZoom(clampedZoom);
        setOffset({ x: clampedX, y: clampedY });
    }, [zoom, offset, minZoom, maxZoom, cropFrameSize]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleFactor = 1.1;
        const newZoomValue = e.deltaY < 0 ? zoom * scaleFactor : zoom / scaleFactor;
        updateZoom(newZoomValue, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    // Fix: Changed event type from MouseEvent<HTMLCanvasElement> to MouseEvent<HTMLDivElement> to match the element it's attached to.
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
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        const image = imageRef.current;

        if (!ctx || !image || cropFrameSize.width === 0) return;

        // Final canvas has the dimensions of the magazine element
        offscreenCanvas.width = elementWidth;
        offscreenCanvas.height = elementHeight;

        // --- Create a temporary canvas with all pixel manipulations (filters, blur, etc.) ---
        const processedImageCanvas = document.createElement('canvas');
        processedImageCanvas.width = image.width;
        processedImageCanvas.height = image.height;
        const pCtx = processedImageCanvas.getContext('2d', { willReadFrequently: true });
        if (!pCtx) return;

        // Apply filters and color replace
        pCtx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;
        pCtx.drawImage(image, 0, 0);

        if (colorReplace.enabled) {
            const fromRgb = hexToRgb(colorReplace.from);
            const toRgb = hexToRgb(colorReplace.to);
            if (fromRgb && toRgb) {
                const imageData = pCtx.getImageData(0, 0, image.width, image.height);
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
                pCtx.putImageData(imageData, 0, 0);
            }
        }

        // This will hold the image after blur is applied (if any)
        let imageToCropFrom: HTMLCanvasElement | HTMLImageElement = processedImageCanvas;

        if (isBlurApplied && hasMask && maskCanvasRef.current) {
            const finalImageCanvas = document.createElement('canvas');
            finalImageCanvas.width = image.width;
            finalImageCanvas.height = image.height;
            const finalCtx = finalImageCanvas.getContext('2d');
            if (finalCtx) {
                const blurCanvas = document.createElement('canvas');
                blurCanvas.width = image.width;
                blurCanvas.height = image.height;
                const blurCtx = blurCanvas.getContext('2d');
                if (blurCtx) {
                    blurCtx.filter = 'blur(4px)';
                    blurCtx.drawImage(processedImageCanvas, 0, 0);
                    finalCtx.drawImage(blurCanvas, 0, 0);

                    finalCtx.save();
                    finalCtx.globalCompositeOperation = 'destination-out';
                    finalCtx.drawImage(maskCanvasRef.current, 0, 0);
                    finalCtx.restore();

                    finalCtx.save();
                    finalCtx.globalCompositeOperation = 'destination-over';
                    finalCtx.drawImage(processedImageCanvas, 0, 0);
                    finalCtx.restore();
                    imageToCropFrom = finalImageCanvas;
                }
            }
        }

        // --- Calculate the source rectangle from the original (processed) image ---
        const sx = (-cropFrameSize.width / 2 / zoom) - (offset.x / zoom) + (image.width / 2);
        const sy = (-cropFrameSize.height / 2 / zoom) - (offset.y / zoom) + (image.height / 2);
        const sWidth = cropFrameSize.width / zoom;
        const sHeight = cropFrameSize.height / zoom;
        
        // --- Draw the calculated source rectangle onto the final canvas ---
        ctx.drawImage(
            imageToCropFrom,
            sx, sy, sWidth, sHeight,
            0, 0, elementWidth, elementHeight
        );

        // --- Draw frame on the final output ---
        if (frame.thickness > 0 && frame.style !== 'none') {
            const finalScale = elementWidth / cropFrameSize.width;
            const scaledThickness = frame.thickness * finalScale;

            if (scaledThickness > 0) {
                ctx.save();
                ctx.strokeStyle = frame.color;
                ctx.lineWidth = scaledThickness;

                const frameRectX = scaledThickness / 2;
                const frameRectY = scaledThickness / 2;
                const frameRectWidth = offscreenCanvas.width - scaledThickness;
                const frameRectHeight = offscreenCanvas.height - scaledThickness;

                if (frame.style === 'dashed') ctx.setLineDash([15 * finalScale, 10 * finalScale]);
                else if (frame.style === 'dotted') ctx.setLineDash([2 * finalScale, 5 * finalScale]);
                
                ctx.strokeRect(frameRectX, frameRectY, frameRectWidth, frameRectHeight);

                if (frame.style === 'double') {
                    const inset = scaledThickness * 0.3;
                    ctx.lineWidth = Math.max(1, scaledThickness * 0.2);
                    ctx.strokeRect(
                        frameRectX + inset,
                        frameRectY + inset,
                        frameRectWidth - inset * 2,
                        frameRectHeight - inset * 2
                    );
                }
                ctx.restore();
            }
        }
        
        const editState: ImageEditState = {
            zoom,
            offset,
            filters,
            colorReplace,
            frame,
            isBlurApplied,
            hasMask,
            maskDataUrl: hasMask ? (maskCanvasRef.current?.toDataURL() ?? null) : null,
        };

        onComplete({
            newSrc: offscreenCanvas.toDataURL(),
            newOriginalSrc: originalImageSrc,
            editState,
        });
    };

    const activeToolClass = 'bg-blue-600';
    const inactiveToolClass = 'bg-slate-700 hover:bg-slate-600';

    return (
        <div className="flex h-screen bg-[#111827] text-white" dir="rtl">
            <main className="flex-grow flex flex-col">
                <header className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
                     <button onClick={onCancel} className="text-sm p-2 rounded hover:bg-slate-700">
                        X
                     </button>
                     <h2 className="font-bold text-lg">עורך תמונות</h2>
                     <div>
                        <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={handleImageReplace} />
                        <button onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-2 px-4 rounded-md transition-colors mr-2">
                            בטל
                        </button>
                        <button onClick={() => replaceImageInputRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 text-sm font-medium py-2 px-4 rounded-md transition-colors mr-2">
                            החלף תמונה
                        </button>
                        <button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-sm font-medium py-2 px-4 rounded-md transition-colors">
                           אישור וחיתוך
                        </button>
                     </div>
                </header>
                <div ref={containerRef} className="flex-grow relative overflow-hidden" 
                    style={{ cursor: isPickingColor ? 'crosshair' : (blurTool ? 'none' : 'move') }}
                    onMouseDown={!isPickingColor ? handleMouseDown : undefined} 
                    onMouseUp={!isPickingColor ? handleMouseUp : undefined} 
                    onMouseLeave={!isPickingColor ? handleMouseLeave : undefined} 
                    onMouseMove={!isPickingColor ? handleMouseMove : undefined} 
                    onWheel={handleWheel}
                    onClick={handleCanvasClick}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <canvas ref={canvasRef} />
                    <canvas ref={maskCanvasRef} className="hidden" />
                </div>
            </main>
            <aside className="w-96 bg-slate-800 flex flex-col border-r border-slate-700 overflow-y-auto">
                 <div className="p-3 border-b border-slate-700">
                    <h3 className="text-lg font-bold">מידע</h3>
                    <p className="text-xs text-slate-400">רזולוציית מקור: {imageRef.current?.width}x{imageRef.current?.height}</p>
                    <p className="text-xs text-slate-400">רזולוציית יעד: {Math.round(elementWidth)}x{Math.round(elementHeight)}</p>
                 </div>
                 <div className="p-3 border-b border-slate-700">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="w-20">זום</span>
                        <input
                            type="range"
                            min={minZoom * 100}
                            max={maxZoom * 100}
                            value={zoom * 100}
                            onChange={e => updateZoom(parseInt(e.target.value, 10) / 100)}
                            className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={maxZoom <= minZoom}
                        />
                        <span className="w-8 text-right">{Math.round(zoom * 100)}%</span>
                    </div>
                </div>
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
                        </div>
                         <label className="text-sm text-slate-400">רגישות: {colorReplace.tolerance}</label>
                            <input type="range" min="0" max="100" value={colorReplace.tolerance} onChange={e => setColorReplace(prev => ({...prev, tolerance: parseInt(e.target.value), enabled: true}))} className="w-full mt-1" />
                        <button onClick={resetColorReplace} disabled={!colorReplace.enabled} className="w-full mt-2 text-xs bg-slate-700 hover:bg-slate-600 p-2 rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                            אפס החלפה
                        </button>
                    </div>
                </Accordion>
                <Accordion title="טשטוש">
                    <div className="space-y-4">
                        <div>
                             <p className="text-xs text-slate-400 mb-2">סמן את האזור שיישאר חד. כל השאר יטושטש.</p>
                             <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { setBlurTool('brush'); setIsBlurApplied(false); }} className={`p-2 rounded flex items-center justify-center gap-2 text-sm ${blurTool === 'brush' ? activeToolClass : inactiveToolClass}`}>
                                    <BrushIcon className="w-4 h-4"/>
                                    מברשת סימון
                                </button>
                                <button onClick={() => { setBlurTool('eraser'); setIsBlurApplied(false); }} className={`p-2 rounded flex items-center justify-center gap-2 text-sm ${blurTool === 'eraser' ? activeToolClass : inactiveToolClass}`}>
                                     <BrushIcon className="w-4 h-4"/>
                                     מחק
                                </button>
                             </div>
                        </div>
                         <div>
                            <label className="text-sm text-slate-400">גודל מברשת: {brushSize}</label>
                            <input type="range" min="5" max="300" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleResetBlur} className="text-xs bg-slate-700 hover:bg-slate-600 p-2 rounded">איפוס טשטוש</button>
                            <button onClick={handleApplyBlur} disabled={!hasMask} className="text-sm bg-slate-600 hover:bg-slate-500 p-2 rounded disabled:opacity-50 disabled:cursor-not-allowed">בצע טשטוש</button>
                        </div>
                    </div>
                </Accordion>
                <Accordion title="מסגרת" defaultOpen={true}>
                     <div className="space-y-3">
                        <div>
                            <label className="text-sm text-slate-400">עובי: {frame.thickness}px</label>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={frame.thickness}
                                onChange={e => setFrame(f => ({ ...f, thickness: parseInt(e.target.value) }))}
                                className="w-full mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400">סגנון</label>
                            <select
                                value={frame.style}
                                onChange={e => setFrame(f => ({ ...f, style: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded p-2 mt-1 text-sm"
                            >
                                <option value="none">ללא מסגרת</option>
                                <option value="solid">קו אחיד</option>
                                <option value="dashed">קו מקווקו</option>
                                <option value="dotted">קו מנוקד</option>
                                <option value="double">קו כפול</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-slate-400">צבע</label>
                            <input
                                type="color"
                                value={frame.color}
                                onChange={e => setFrame(f => ({ ...f, color: e.target.value }))}
                                className="w-full h-10 bg-slate-700 border border-slate-600 rounded p-1 mt-1"
                            />
                        </div>
                    </div>
                </Accordion>
            </aside>
        </div>
    );
};

export default ImageEditor;