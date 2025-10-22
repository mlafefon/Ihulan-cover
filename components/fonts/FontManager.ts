export interface GoogleFont {
    name: string;
    weights: number[];
}

// =================================================================================
// Instructions for adding new fonts:
// 1. Find the font on Google Fonts (https://fonts.google.com/).
// 2. Add a new object to the `availableFonts` array below.
// 3. 'name': The name of the font as it appears on Google Fonts (e.g., 'Roboto', 'Open Sans').
// 4. 'weights': An array of the font weights you want to include (e.g., [400, 700, 900]).
//
// Example: To add the "Roboto" font with regular and bold weights:
// {
//   name: 'Roboto',
//   weights: [400, 700],
// }
// =================================================================================

export const availableFonts: GoogleFont[] = [
    {name: 'Heebo', weights: [400, 500, 700, 900]},
    {name: 'Rubik Moonrocks', weights: [400, 500, 700, 900]},
    {name: 'Fredoka', weights: [400, 500, 700, 900]},
    {name: 'Playpen Sans Hebrew', weights: [400, 500, 700, 900]},
    {name: 'Secular One', weights: [400, 500, 700, 900]},
    {name: 'David Libree', weights: [400, 500, 700, 900]},
    {name: 'Frank Ruhl Libre', weights: [300, 400, 500, 700, 900]},
    {name: 'Miriam Libre', weights: [400, 700]},
    {name: 'Noto Sans Hebrew', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900]},
    // Add new fonts here, for example:
    // {
    //   name: 'Open Sans',
    //   weights: [400, 700],
    // },
    // {
    //   name: 'Lato',
    //   weights: [300, 400, 700],
    // }
];


/**
 * Generates the full URL for the Google Fonts API stylesheet.
 * e.g., "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap"
 */
export const getGoogleFontsUrl = (): string | null => {
    if (availableFonts.length === 0) {
        return null;
    }

    const families = availableFonts
        .map(font => `family=${font.name.replace(/ /g, '+')}:wght@${font.weights.join(';')}`)
        .join('&');
    
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
};

/**
 * Fetches the Google Fonts CSS, finds all font file URLs,
 * fetches them, converts them to Base64 Data URLs, and returns
 * a new CSS string with the fonts embedded.
 */
export const getEmbeddedCss = async (): Promise<string | null> => {
    const fontUrl = getGoogleFontsUrl();
    if (!fontUrl) return null;

    try {
        const cssResponse = await fetch(fontUrl);
        let cssText = await cssResponse.text();

        // Find all url(...) declarations in the CSS
        const fontFileUrls = [...cssText.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(match => match[1]);

        // Fetch each font file and convert it to a Base64 Data URL
        const fontPromises = fontFileUrls.map(async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise<[string, string]>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        resolve([url, reader.result]);
                    } else {
                        reject(new Error('Failed to read font file as Data URL'));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });

        const fontDataUrls = await Promise.all(fontPromises);

        // Replace the original URLs in the CSS with the Base64 Data URLs
        for (const [originalUrl, dataUrl] of fontDataUrls) {
            cssText = cssText.replace(originalUrl, dataUrl);
        }

        return cssText;

    } catch (error) {
        console.error("Failed to fetch and embed fonts:", error);
        return null; // Return null on error
    }
};
