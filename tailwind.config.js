/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: {
		extend: {
			colors: {
				discord: {
					// Backgrounds
					background: "rgb(var(--discord-bg-rgb) / <alpha-value>)",
					backgroundSecondary: "rgb(var(--discord-bg-secondary-rgb) / <alpha-value>)",
					backgroundTertiary: "var(--discord-bg-tertiary)",
					backgroundDark: "var(--discord-bg-dark)",
					messageHover: "var(--discord-bg-hover)",
					// Text
					textPrimary: "var(--discord-text-primary)",
					textSecondary: "var(--discord-text-secondary)",
					textMuted: "var(--discord-text-muted)",
					// Accent
					accent: "rgb(var(--discord-accent-rgb) / <alpha-value>)",
					accentHover:
						"rgb(var(--discord-accent-hover-rgb) / <alpha-value>)",
					// Semantic
					divider: "var(--discord-divider)",
					danger: "rgb(var(--discord-danger-rgb) / <alpha-value>)",
					dangerHover: "var(--discord-danger-hover)",
					warning: "rgb(var(--discord-warning-rgb) / <alpha-value>)",
					textPositive: "var(--discord-positive)",
					// Status
					online: "var(--discord-online)",
					idle: "var(--discord-idle)",
					dnd: "var(--discord-dnd)",
					offline: "var(--discord-offline)",
				},
				brand: {
					100: "rgb(var(--brand-100-rgb) / <alpha-value>)",
					130: "rgb(var(--brand-130-rgb) / <alpha-value>)",
					160: "rgb(var(--brand-160-rgb) / <alpha-value>)",
					200: "rgb(var(--brand-200-rgb) / <alpha-value>)",
					230: "rgb(var(--brand-230-rgb) / <alpha-value>)",
					260: "rgb(var(--brand-260-rgb) / <alpha-value>)",
					300: "rgb(var(--brand-300-rgb) / <alpha-value>)",
					330: "rgb(var(--brand-330-rgb) / <alpha-value>)",
					360: "rgb(var(--brand-360-rgb) / <alpha-value>)",
					400: "rgb(var(--brand-400-rgb) / <alpha-value>)",
					430: "rgb(var(--brand-430-rgb) / <alpha-value>)",
					460: "rgb(var(--brand-460-rgb) / <alpha-value>)",
					500: "rgb(var(--brand-500-rgb) / <alpha-value>)",
					530: "rgb(var(--brand-530-rgb) / <alpha-value>)",
					560: "rgb(var(--brand-560-rgb) / <alpha-value>)",
					600: "rgb(var(--brand-600-rgb) / <alpha-value>)",
					630: "rgb(var(--brand-630-rgb) / <alpha-value>)",
					660: "rgb(var(--brand-660-rgb) / <alpha-value>)",
					700: "rgb(var(--brand-700-rgb) / <alpha-value>)",
					730: "rgb(var(--brand-730-rgb) / <alpha-value>)",
					760: "rgb(var(--brand-760-rgb) / <alpha-value>)",
					800: "rgb(var(--brand-800-rgb) / <alpha-value>)",
					830: "rgb(var(--brand-830-rgb) / <alpha-value>)",
					860: "rgb(var(--brand-860-rgb) / <alpha-value>)",
					900: "rgb(var(--brand-900-rgb) / <alpha-value>)",
				},
			},
			fontFamily: {
				sans: [
					"Whitney",
					"Helvetica Neue",
					"Helvetica",
					"Arial",
					"sans-serif",
				],
				mono: [
					"Roboto Mono",
					"Consolas",
					"Liberation Mono",
					"Courier New",
					"monospace",
				],
			},
		},
	},
	plugins: [],
};
