import { useEffect, useState } from 'react';

function resolveViewportMode() {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTabletPortrait: false,
      useBottomNav: false,
    };
  }

  const width = window.innerWidth;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const isMobile = width < 768;
  const isTabletPortrait = width >= 768 && width < 1024 && isPortrait;

  return {
    isMobile,
    isTabletPortrait,
    useBottomNav: isMobile || isTabletPortrait,
  };
}

export default function useViewportMode() {
  const [mode, setMode] = useState(resolveViewportMode);

  useEffect(() => {
    const update = () => setMode(resolveViewportMode());
    update();

    window.addEventListener('resize', update);
    const media = window.matchMedia('(orientation: portrait)');
    const mediaListener = () => update();
    media.addEventListener('change', mediaListener);

    return () => {
      window.removeEventListener('resize', update);
      media.removeEventListener('change', mediaListener);
    };
  }, []);

  return mode;
}
