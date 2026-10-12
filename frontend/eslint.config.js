import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Los enums de PHP y los componentes de React usan PascalCase, y
      // el proyecto los escribe asi a proposito.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Los archivos de configuracion los ejecuta Node, no el navegador.
    // Sin esto, process no existe y el proxy de Vite no compila.
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
);
