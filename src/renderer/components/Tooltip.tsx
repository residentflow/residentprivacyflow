import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ 
  children, 
  content, 
  position = 'bottom',
  delay = 300 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const targetRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  const updatePosition = () => {
    if (targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      const offset = 8;
      
      switch (position) {
        case 'top':
          top = rect.top - offset;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - offset;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + offset;
          break;
      }

      setCoords({ top, left });
    }
  };

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  // Update position on scroll or resize to keep tooltip attached
  useEffect(() => {
    if (isVisible) {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible]);

  return (
    <div 
      ref={targetRef} 
      className="tooltip-anchor" 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {isVisible && createPortal(
        <div 
          className={`portal-tooltip portal-tooltip-${position}`}
          style={{ 
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: position === 'top' ? 'translate(-50%, -100%)' : 
                       position === 'bottom' ? 'translate(-50%, 0)' :
                       position === 'left' ? 'translate(-100%, -50%)' : 
                       'translate(0, -50%)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}
