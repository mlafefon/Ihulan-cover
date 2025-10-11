import type { Template, CanvasElement } from './types';
import { ElementType } from './types';

export const initialTemplates: Template[] = [
  {
  "id": "tech_mag",
  "name": "Future Tech",
  "width": 800,
  "height": 1000,
  "backgroundColor": "#1a202c",
  "previewImage": "https://i.imgur.com/QjxqfF4.png",
  "elements": [
    {
      "id": "headline-1",
      // FIX: Use ElementType enum.
      "type": ElementType.Text,
      "x": 50,
      "y": 50,
      "width": 700,
      "height": 200,
      "rotation": 0,
      "zIndex": 2,
      "spans": [
        {
          "text": "TECH",
          "style": {
            "fontFamily": "Heebo",
            "fontSize": 180,
            "fontWeight": 900,
            "color": "#39ff14",
            "textShadow": "0 0 5px #39ff14"
          }
        }
      ],
      "textAlign": "right",
      "verticalAlign": "middle",
      "lineHeight": 1,
      "letterSpacing": 0,
      "backgroundColor": "transparent",
      "padding": 0
    },
    {
      "id": "sub-headline-1",
      // FIX: Use ElementType enum.
      "type": ElementType.Text,
      "x": 50,
      "y": 250,
      "width": 400,
      "height": 50,
      "rotation": 0,
      "zIndex": 2,
      "spans": [
        {
          "text": "הצצה לעולם המחר",
          "style": {
            "fontFamily": "Heebo",
            "fontSize": 24,
            "fontWeight": 400,
            "color": "#ffffff",
            "textShadow": ""
          }
        }
      ],
      "textAlign": "right",
      "verticalAlign": "middle",
      "lineHeight": 1.2,
      "letterSpacing": 0,
      "backgroundColor": "transparent",
      "padding": 0
    },
    {
      "id": "main-title",
      // FIX: Use ElementType enum.
      "type": ElementType.Text,
      "x": 100,
      "y": 400,
      "width": 600,
      "height": 300,
      "rotation": 0,
      "zIndex": 2,
      "spans": [
        {
          "text": "הגאדג'טים של העתיד",
          "style": {
            "fontFamily": "Heebo",
            "fontSize": 96,
            "fontWeight": 700,
            "color": "#39ff14",
            "textShadow": ""
          }
        }
      ],
      "textAlign": "center",
      "verticalAlign": "middle",
      "lineHeight": 1.2,
      "letterSpacing": 0,
      "backgroundColor": "transparent",
      "padding": 0
    },
    {
      "id": "special-tag",
      // FIX: Use ElementType enum.
      "type": ElementType.Text,
      "x": 600,
      "y": 850,
      "width": 150,
      "height": 60,
      "rotation": -15,
      "zIndex": 3,
      "spans": [
        {
          "text": "מיוחד",
          "style": {
            "fontFamily": "Heebo",
            "fontSize": 32,
            "fontWeight": 700,
            "color": "#1a202c",
            "textShadow": ""
          }
        }
      ],
      "textAlign": "center",
      "verticalAlign": "middle",
      "lineHeight": 1.5,
      "letterSpacing": 0,
      "backgroundColor": "#39ff14",
      "padding": 10
    },
    {
      "id": "main-image",
      // FIX: Use ElementType enum.
      "type": ElementType.Image,
      "x": 1,
      "y": 137,
      "width": 793,
      "height": 854,
      "rotation": 0,
      "zIndex": 1,
      "src": "data:image/png;base64,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w2//hH+gPfvyz+sV3v6fPn//8x//d53S8yD5pU0l0Q7uU/0eO3fA2W/ZZyJbs2A077M0+tqA7tq+L2x3L/l5E7/dOqQ9dC+vYlMvIuBheY+8K3V/n3X7WqXFfG/y8j9b11P32fD8uN3+F7+P6D40993x/q2/b2yL1j8GgN7K/h+oG+j//3eU3iU5G2pZ9Fu45/Wb3/j/p5+lR+x/p2//iF/r7v/1/9H/9Tf/Bv/9n/97+q7f/77v9T/+H/+f9f//l//F/2//+s/377/13/4t17UeH1/Ue3f/f/0n/1nL+n5L/z93f/w55/z4S//+R9798E9XWw08s+01n1b8cW65Vd177/X/f/+3v/381fF9P6uXz/37h//u11/9v/wX/+z8/34f9a++5n/4933/z//f3/95r35b/V+c/8F+v6uX//5X/f7X/9u9/10/72///p/1P3/v/6v/8/f++3/5X3/z3/+X//e//s9//a9/+d/+t//r/7a/7x9///1V1w8AAEAASURBVHjarVzZk1zFlb1jP33jL/u3n9/94N/99w/6W//qP3/L/d///T/8b/723/7rv/o//s/f+5/V1/f+5n9+9e/c/4P/u7/v+xX/7H99D/6X/2d/+f8wV/9v/+hP/3c/+U//s3/2X/7r/+n//F/+b/+b//0/+S/+L//j//t/+f/8f//X//k/+T/4j/+7/3u//2/+q3/3b//D//O/8L/93/27/9V/+d//63/wX/57f6/n/3v/4X/73/4v/sP//b/9H//P/v1v/j/+z//H/+q//7f+3f/w3/7h3/4B//n//Jv//f/y//2f/evv+vX//J//N//o3/2H/+r/8b/6r/4r//r//t/8z//N/+b/+X/+d//b37z3/3P/+h/+n/+L/8r/7N/+d/+w//t/+Gf/Jv/+3/4t/8//w//7X/3b/zP/+P/+X//L//P/+J/89/8L/83f/fv/8N/8+/93v/+T/93v+X/5L/83//d/w///G/+9X/23/1H//E/+/d/+T/5V3/zb/+b/7P/9r/4d/9T//0/+3/5r/6V//2v/+v/+X/xH/8X/+kf/U/++f/6r/+rf/c/+9//i3/3b/7mP/O1/y3/2//qfwV4//N/+V/+xX/w//yv/sv/9D/9ff8Bf/F/9c//3b/9D//rf//f/VP/9H/zb/6n//O//3/+v/u3/+P/7t/8V//Vf/dv/v3v+S/+L//lP/mv/0P/9b/7r//Lf/p/9+//5P/8X/wP/+V/9T//N//v/i/+9X/2b//b//a/+b/9t/9f/8N/+Q//Lf+P//G//1/+r3/r3/vX//1/+o/+t/+Df/q//Jf/5P/0H/yH//N/+9/+o//qX/+//lf/zL/4t3/7f/Ev/rN//a/+G3/73/+b/9l/8+/+n/zP/+hf/o/+rb/9P/iP/u0/9d/+P//N/+Q//7f+23/vX//t//l/9h/9+/8v/w/++7/+b/+nf/E/+1//1//1//W//N//v/+z//x/+U/+p//aH+C//pf/o3/4r/4t//w/+Q/+//+Tf+lf+N/+L//rv/1//g//+X/yb/+b/96f57/7N/8X/+6//m/++X/3b/6n//J/+3/73/3T/+7f/6f/u3//3/5L/+2/92t//y//u//h//R/+Qf/g/8v/sN/69/8z/7Df/Of/vP/6V//p/9f/+V//e//87/4d//hX/2r//i/+F/+z/+b/9l/8+9+79f8u3/zb//j/+E/+V//W/8n/+I/fG7X//K/+V//l//9X/yn//Ff/N//o3/+3/6Hf/G/+7/+D//rv/kP/2t/+3/+r//6//p//O//y3/+H/9r/+nf+5f/pP/tP/yP/v1//h//t/+Lf/lP/73/1r/6t//lP/hP/2/+Lf+Vf+u//7f+o3/wH/8//+1v/V//6D/5H/1X//p/+7/+a3/7b/97P/o//rNf8//8L/67//N/9W/8n/4Lf/V//O//p/8W/+T//N/8F/+7//y/+Jf/4X/9H//7/7P/4H/4r/6D/3tf+N/+b3/rP/gv/+1//g//p3/xb/+b//I//r//F//mv/5H//J/8+/87/7b//4//q9+39/8N/8L/91f+Nf/7n/6H/27//S/+A//o//q3/2b//5/+U//V/+x/9F/+O//Tf/r//5/+x394P+4LAAAAASUVORK5CYII=",
      "objectFit": "cover"
    }
  ]
},
  {
    id: 'fashion_mag',
    name: 'Vogue',
    width: 800,
    height: 1000,
    backgroundColor: '#ffffff',
    previewImage: 'https://i.imgur.com/f9hJ4Jt.png',
    elements: [],
  },
  {
    id: 'natgeo_mag',
    name: 'National Geographic',
    width: 800,
    height: 1000,
    backgroundColor: '#000000',
    previewImage: 'https://i.imgur.com/rS2aW8a.png',
    elements: [],
  },
    {
    id: 'leisha_mag',
    name: 'Leisha',
    width: 800,
    height: 1000,
    backgroundColor: '#ffffff',
    previewImage: 'https://i.imgur.com/dKbozWp.png',
    elements: [],
  },
];