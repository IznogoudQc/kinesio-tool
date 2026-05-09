import tseslint from 'typescript-eslint'

export default tseslint.config({
  extends: [...tseslint.configs.recommended],
  ignores: ['out/**', 'dist/**', 'node_modules/**', 'db/migrations/**'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
})
