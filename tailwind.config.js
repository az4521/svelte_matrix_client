/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        discord: {
          // Backgrounds
          background:          'var(--discord-bg)',
          backgroundSecondary: 'var(--discord-bg-secondary)',
          backgroundTertiary:  'var(--discord-bg-tertiary)',
          backgroundDark:      'var(--discord-bg-dark)',
          messageHover:        'var(--discord-bg-hover)',
          // Text
          textPrimary:         'var(--discord-text-primary)',
          textSecondary:       'var(--discord-text-secondary)',
          textMuted:           'var(--discord-text-muted)',
          // Accent
          accent:              'var(--discord-accent)',
          accentHover:         'var(--discord-accent-hover)',
          // Semantic
          divider:             'var(--discord-divider)',
          danger:              'var(--discord-danger)',
          dangerHover:         'var(--discord-danger-hover)',
          warning:             'var(--discord-warning)',
          textPositive:        'var(--discord-positive)',
          // Status
          online:              'var(--discord-online)',
          idle:                'var(--discord-idle)',
          dnd:                 'var(--discord-dnd)',
          offline:             'var(--discord-offline)',
        },
        brand: {
          100: 'var(--brand-100)',
          130: 'var(--brand-130)',
          160: 'var(--brand-160)',
          200: 'var(--brand-200)',
          230: 'var(--brand-230)',
          260: 'var(--brand-260)',
          300: 'var(--brand-300)',
          330: 'var(--brand-330)',
          360: 'var(--brand-360)',
          400: 'var(--brand-400)',
          430: 'var(--brand-430)',
          460: 'var(--brand-460)',
          500: 'var(--brand-500)',
          530: 'var(--brand-530)',
          560: 'var(--brand-560)',
          600: 'var(--brand-600)',
          630: 'var(--brand-630)',
          660: 'var(--brand-660)',
          700: 'var(--brand-700)',
          730: 'var(--brand-730)',
          760: 'var(--brand-760)',
          800: 'var(--brand-800)',
          830: 'var(--brand-830)',
          860: 'var(--brand-860)',
          900: 'var(--brand-900)',
        }
      },
      fontFamily: {
        sans: ['Whitney', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Roboto Mono', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
};
