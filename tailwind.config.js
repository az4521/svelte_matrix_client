/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Discord-style color palette
        discord: {
          background: '#36393f',
          backgroundSecondary: '#2f3136',
          backgroundTertiary: '#202225',
          backgroundDark: '#202226',
          textPrimary: '#dcddde',
          textSecondary: '#72767d',
          textMuted: '#4f545c',
          textPositive: '#23a559',
          accent: '#5865F2',
          accentHover: '#4752C4',
          danger: '#ED4245',
          warning: '#FAA61A',
          divider: '#41444e',
          online: '#3BA55C',
          idle: '#FAA61A',
          dnd: '#ED4245',
          offline: '#747f8d',
          messageHover: '#32353b'
        }
      },
      fontFamily: {
        sans: ['gg sans', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Roboto Mono', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
};