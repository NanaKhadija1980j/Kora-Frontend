"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatLabel?: (value: number) => string;
  histogram?: Array<{ value: number; count: number }>;
  className?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  formatLabel = (v) => v.toString(),
  histogram = [],
  className,
  disabled = false,
}: RangeSliderProps) {
  const [minVal, maxVal] = value;
  const minValRef = useRef(minVal);
  const maxValRef = useRef(maxVal);
  const rangeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);

  // Update refs when props change
  useEffect(() => {
    minValRef.current = minVal;
    maxValRef.current = maxVal;
  }, [minVal, maxVal]);

  // Update range track position
  useEffect(() => {
    if (rangeRef.current) {
      const minPercent = ((minVal - min) / (max - min)) * 100;
      const maxPercent = ((maxVal - min) / (max - min)) * 100;
      
      rangeRef.current.style.left = `${minPercent}%`;
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, maxVal, min, max]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, type: 'min' | 'max') => {
    if (disabled) return;
    
    const currentValue = type === 'min' ? minVal : maxVal;
    let newValue = currentValue;
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        newValue = Math.max(min, currentValue - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        newValue = Math.min(max, currentValue + step);
        break;
      case 'Home':
        newValue = min;
        break;
      case 'End':
        newValue = max;
        break;
      default:
        return;
    }
    
    event.preventDefault();
    
    if (type === 'min') {
      onChange([Math.min(newValue, maxVal - step), maxVal]);
    } else {
      onChange([minVal, Math.max(newValue, minVal + step)]);
    }
  }, [min, max, step, minVal, maxVal, onChange, disabled]);

  // Histogram bars
  const histogramBars = histogram.length > 0 && (
    <div className="absolute inset-0 flex items-end justify-between px-1">
      {histogram.map((bar, index) => {
        const height = Math.max(2, (bar.count / Math.max(...histogram.map(h => h.count))) * 20);
        return (
          <div
            key={index}
            className="bg-muted/30 rounded-sm"
            style={{
              height: `${height}px`,
              width: `${100 / histogram.length - 1}%`,
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className={cn("relative w-full", className)}>
      {/* Value labels */}
      <div className="mb-4 flex justify-between">
        <div className="relative">
          <div className={cn(
            "absolute -top-8 left-0 rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md transition-opacity",
            isDragging === 'min' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {formatLabel(minVal)}
          </div>
        </div>
        <div className="relative">
          <div className={cn(
            "absolute -top-8 right-0 rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md transition-opacity",
            isDragging === 'max' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {formatLabel(maxVal)}
          </div>
        </div>
      </div>

      <div className="group relative h-6">
        {/* Histogram background */}
        {histogramBars}
        
        {/* Min range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          disabled={disabled}
          onChange={(event) => {
            const val = Math.min(Number(event.target.value), maxVal - step);
            onChange([val, maxVal]);
            minValRef.current = val;
          }}
          onMouseDown={() => setIsDragging('min')}
          onMouseUp={() => setIsDragging(null)}
          onKeyDown={(e) => handleKeyDown(e, 'min')}
          className="pointer-events-none absolute z-30 h-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:focus:scale-110 [&::-webkit-slider-thumb]:focus:ring-2 [&::-webkit-slider-thumb]:focus:ring-primary/20 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
          style={{ zIndex: minVal > max - 100 ? "40" : undefined }}
          aria-label={`Minimum value: ${formatLabel(minVal)}`}
        />
        
        {/* Max range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          disabled={disabled}
          onChange={(event) => {
            const val = Math.max(Number(event.target.value), minVal + step);
            onChange([minVal, val]);
            maxValRef.current = val;
          }}
          onMouseDown={() => setIsDragging('max')}
          onMouseUp={() => setIsDragging(null)}
          onKeyDown={(e) => handleKeyDown(e, 'max')}
          className="pointer-events-none absolute z-30 h-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:focus:scale-110 [&::-webkit-slider-thumb]:focus:ring-2 [&::-webkit-slider-thumb]:focus:ring-primary/20 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
          aria-label={`Maximum value: ${formatLabel(maxVal)}`}
        />

        {/* Track */}
        <div className="relative w-full">
          <div className="h-1.5 w-full rounded bg-muted" />
          <div
            ref={rangeRef}
            className="absolute top-0 h-1.5 rounded bg-primary transition-all duration-150"
          />
        </div>
      </div>
      
      {/* Range display */}
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  );
}