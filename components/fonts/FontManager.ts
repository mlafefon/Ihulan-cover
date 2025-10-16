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
