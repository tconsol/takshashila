import React, { useCallback, useRef, CSSProperties, useEffect } from 'react';

export interface SliderItemData {
  title: string;
  num: string;
  imageUrl: string;
  data?: unknown;
}

interface ThreeDSliderProps {
  items: SliderItemData[];
  speedWheel?: number;
  speedDrag?: number;
  containerStyle?: CSSProperties;
  onItemClick?: (item: SliderItemData, index: number) => void;
}

interface SliderItemProps {
  item: SliderItemData;
  onClick: () => void;
}

const SliderItem = React.forwardRef<HTMLDivElement, SliderItemProps>(({ item, onClick }, ref) => (
  <div
    ref={ref}
    className="absolute top-1/2 left-1/2 cursor-pointer select-none rounded-xl bg-slate-800 pointer-events-auto overflow-hidden will-change-transform"
    style={{
      width: 'clamp(150px, 28vw, 240px)',
      height: 'clamp(200px, 38vw, 340px)',
      marginTop: 'calc(clamp(200px, 38vw, 340px) / -2)',
      marginLeft: 'calc(clamp(150px, 28vw, 240px) / -2)',
      transformOrigin: '0% 100%',
    }}
    onClick={onClick}
  >
    <div className="slider-item-content absolute inset-0 z-10 will-change-[opacity]">
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      <div className="absolute z-20 text-white bottom-4 left-4 text-[clamp(14px,2vw,20px)] font-bold drop-shadow-lg leading-tight">
        {item.title}
      </div>
      <div className="absolute z-20 text-white top-3 left-4 text-[clamp(28px,7vw,60px)] font-black opacity-70 leading-none">
        {item.num}
      </div>
      <img
        src={item.imageUrl}
        alt={item.title}
        className="w-full h-full object-cover pointer-events-none"
        loading="eager"
        decoding="sync"
      />
    </div>
  </div>
));
SliderItem.displayName = 'SliderItem';

const ThreeDSlider: React.FC<ThreeDSliderProps> = ({
  items,
  speedWheel = 0.05,
  speedDrag = -0.15,
  containerStyle = {},
  onItemClick,
}) => {
  const progressRef = useRef(0);          // start at 0 = first item
  const targetProgressRef = useRef(0);    // start at 0 = first item
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cacheRef = useRef<Record<number, { transform: string; zIndex: string; opacity: string }>>({});
  const isActiveRef = useRef(false); // only run RAF when interaction or lerp pending

  const numItems = items.length;

  const applyStyles = useCallback(() => {
    const progress = progressRef.current;
    const clamped = Math.max(0, Math.min(progress, 100));
    const activeFloat = (clamped / 100) * (numItems - 1);

    itemRefs.current.forEach((el, index) => {
      if (!el) return;
      const denominator = numItems > 1 ? numItems - 1 : 1;
      const ratio = (index - activeFloat) / denominator;
      const tx = ratio * 800;
      const ty = ratio * 200;
      const rot = ratio * 120;
      const dist = Math.abs(index - activeFloat);
      const z = numItems - dist;
      const opacity = Math.max(0, Math.min(1, (z / numItems) * 3 - 2));

      const newTransform = `translate3d(${tx.toFixed(1)}%, ${ty.toFixed(1)}%, 0) rotate(${rot.toFixed(1)}deg)`;
      const newZIndex = Math.round(z * 10).toString();
      const newOpacity = opacity.toFixed(3);

      if (!cacheRef.current[index]) cacheRef.current[index] = { transform: '', zIndex: '', opacity: '' };
      const cache = cacheRef.current[index];

      if (cache.transform !== newTransform) { el.style.transform = newTransform; cache.transform = newTransform; }
      if (cache.zIndex !== newZIndex) { el.style.zIndex = newZIndex; cache.zIndex = newZIndex; }
      const inner = el.querySelector('.slider-item-content') as HTMLElement | null;
      if (inner && cache.opacity !== newOpacity) { inner.style.opacity = newOpacity; cache.opacity = newOpacity; }
    });
  }, [numItems]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return; // already running
    const loop = () => {
      const diff = targetProgressRef.current - progressRef.current;
      if (Math.abs(diff) < 0.01 && !isDownRef.current) {
        // Settled — apply final position and stop loop
        progressRef.current = targetProgressRef.current;
        applyStyles();
        rafRef.current = null;
        return;
      }
      progressRef.current += diff * 0.1;
      applyStyles();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [applyStyles]);

  // Initial render
  useEffect(() => {
    // Apply initial layout (progress = 0, first item centered)
    applyStyles();
  }, [applyStyles]);

  const handleWheel = useCallback((e: WheelEvent) => {
    const next = targetProgressRef.current + e.deltaY * speedWheel;
    if ((next < 0 && e.deltaY < 0) || (next > 100 && e.deltaY > 0)) return;
    e.preventDefault();
    targetProgressRef.current = Math.max(0, Math.min(100, next));
    startLoop();
  }, [speedWheel, startLoop]);

  const getClientX = (e: MouseEvent | TouchEvent) =>
    'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;

  const handleMouseDown = useCallback((e: MouseEvent | TouchEvent) => {
    isDownRef.current = true;
    startXRef.current = getClientX(e);
    startLoop(); // keep loop alive during drag
  }, [startLoop]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDownRef.current) return;
    const x = getClientX(e);
    const diff = (x - startXRef.current) * speedDrag;
    targetProgressRef.current = Math.max(0, Math.min(100, targetProgressRef.current + diff));
    startXRef.current = x;
  }, [speedDrag]);

  const handleMouseUp = useCallback(() => {
    isDownRef.current = false;
  }, []);

  const handleClick = useCallback((item: SliderItemData, index: number) => {
    const denominator = numItems > 1 ? numItems - 1 : 1;
    targetProgressRef.current = (index / denominator) * 100;
    startLoop();
    if (onItemClick) onItemClick(item, index);
  }, [numItems, onItemClick, startLoop]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('touchstart', handleMouseDown, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: true });
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: '480px', background: '#020617', ...containerStyle }}
    >
      <div className="relative z-10 h-full overflow-hidden pointer-events-none scale-[0.88] w-full">
        {items.map((item, index) => (
          <SliderItem
            key={`slider-item-${index}`}
            ref={(el) => { itemRefs.current[index] = el; }}
            item={item}
            onClick={() => handleClick(item, index)}
          />
        ))}
      </div>
      <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20 pointer-events-none">
        <p className="text-white/30 text-xs tracking-wide">Scroll or drag to explore</p>
      </div>
    </div>
  );
};

export default ThreeDSlider;
