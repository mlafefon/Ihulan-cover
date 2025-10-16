import React, { useEffect } from 'react';
import { getGoogleFontsUrl } from './FontManager';

const FONT_LINK_ID = 'google-fonts-stylesheet';

const FontLoader: React.FC = () => {
  useEffect(() => {
    // This effect runs only once to inject the Google Fonts stylesheet.
    const fontUrl = getGoogleFontsUrl();

    if (fontUrl) {
      // Prevent adding duplicate links if this component were to re-render
      if (document.getElementById(FONT_LINK_ID)) {
          return;
      }

      const link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      link.href = fontUrl;
      document.head.appendChild(link);
    }
  }, []);

  return null; // This component does not render anything to the DOM
};

export default FontLoader;
