import React, { createContext, useContext, useEffect, useState } from 'react';
import { getEmbeddedCss, getGoogleFontsUrl } from './FontManager';

const FONT_STYLE_ID = 'embedded-google-fonts-stylesheet';

// 1. Define the Context and its type
interface FontContextType {
    fontCss: string | null;
    loading: boolean;
}

const FontContext = createContext<FontContextType>({
    fontCss: null,
    loading: true,
});

// 2. Create and export the Provider component
export const FontProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [fontCss, setFontCss] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFonts = async () => {
            if (document.getElementById(FONT_STYLE_ID)) {
                // Fonts already loaded/loading, don't do it again
                setLoading(false);
                return;
            }

            try {
                const embeddedCss = await getEmbeddedCss();
                if (embeddedCss) {
                    setFontCss(embeddedCss);
                    const style = document.createElement('style');
                    style.id = FONT_STYLE_ID;
                    style.textContent = embeddedCss;
                    document.head.appendChild(style);
                } else {
                    // Fallback to linking the stylesheet if embedding fails
                    const fontUrl = getGoogleFontsUrl();
                    if (fontUrl) {
                        const link = document.createElement('link');
                        link.id = FONT_STYLE_ID; // Use same ID to prevent duplication
                        link.rel = 'stylesheet';
                        link.href = fontUrl;
                        document.head.appendChild(link);
                    }
                }
            } catch (error) {
                console.error('Error in FontProvider:', error);
            } finally {
                setLoading(false);
            }
        };

        loadFonts();
    }, []);

    return (
        <FontContext.Provider value={{ fontCss, loading }}>
            {children}
        </FontContext.Provider>
    );
};

// 3. Create and export the custom hook
export const useFonts = () => useContext(FontContext);

// 4. The default export is now an empty component, as its functionality is moved to the provider.
const FontLoader: React.FC = () => {
    // The logic is now in FontProvider, this component does nothing.
    return null;
};

export default FontLoader;