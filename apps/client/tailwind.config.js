/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './.storybook/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Fira Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // New Professional Graphite Scale
        graphite: {
          950: '#0F1115',
          900: '#141821',
          800: '#1B2130',
          700: '#242B3A',
          600: '#2F394B',
          500: '#3B475C',
          400: '#50617A',
          300: '#6B7A92',
          200: '#8C97AA',
          100: '#B3BBC8',
          50: '#D7DCE5',
          25: '#EEF1F5',
        },
        // Professional Blue Scale (Primary)
        blue: {
          900: '#0B1F3B',
          800: '#102A4C',
          700: '#163759',
          600: '#1E466B',
          500: '#25557E',
          400: '#2F6B9A',
          300: '#3E82B6',
          200: '#6FA3C7',
          100: '#A9C7DF',
          50: '#D8E6F3',
        },
        // Professional Purple Scale (Secondary)
        purple: {
          900: '#1D1133',
          800: '#281845',
          700: '#31205A',
          600: '#3A2A70',
          500: '#4A378B',
          400: '#5C49A3',
          300: '#7666B9',
          200: '#A19BD2',
          100: '#C9C3E6',
          50: '#E7E6F5',
        },
        // Professional Green Scale (Success)
        green: {
          700: '#0F3B33',
          600: '#155246',
          500: '#1D6A5B',
          400: '#2A8372',
          300: '#45A190',
          200: '#79C0B0',
          100: '#B2DDD1',
        },
        // Professional Red Scale (Error)
        red: {
          700: '#4A1B1B',
          600: '#662626',
          500: '#803131',
          400: '#9C3D3D',
          300: '#BA5956',
          200: '#D98A86',
          100: '#E8B7B3',
        },
        // Professional Gold Scale (Warning)
        gold: {
          700: '#4A3810',
          600: '#5D4614',
          500: '#725718',
          400: '#8A6A1D',
          300: '#A6842A',
          200: '#C8A656',
          100: '#E0C98D',
        },
        // Custom colors for diagrams and editor (updated for dark theme)
        editor: {
          bg: '#0F1115', // Graphite-950
          line: '#1B2130', // Graphite-800
        },
      },
      zIndex: {
        dropdown: '1000',
        sticky: '1020',
        fixed: '1030',
        modal: '1040',
        popover: '1050',
        tooltip: '1060',
        toast: '1070',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        // Storybook-compatible animations
        in: 'enter 200ms ease-out',
        out: 'exit 150ms ease-in forwards',
      },
      keyframes: {
        enter: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        exit: {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
};
