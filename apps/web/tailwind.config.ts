import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { 500: '#0f766e', 600: '#0d6f6a', 700: '#0a5a56' } } } },
  plugins: [],
};
export default config;
