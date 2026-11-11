import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#172033', mist: '#f5f7fb' } } }, plugins: [] } satisfies Config;
