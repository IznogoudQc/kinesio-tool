import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  // Ignores GLOBAUX — doivent vivre dans un objet de config **seul**. Placés à côté
  // d'autres clés (`rules`, `extends`…), ils ne valent que pour cet objet-là, et les
  // artefacts de build restaient analysés : c'est ce qui produisait les « 3 erreurs
  // de baseline » qu'on avait pris l'habitude d'ignorer.
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', 'db/migrations/**', 'release/**']
  },
  {
    extends: [...tseslint.configs.recommended],
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  // Règles des hooks React. `rules-of-hooks` en **erreur** : elle attrape les hooks
  // appelés après un `return` conditionnel ou dans une condition — la classe de bugs
  // qui a fait planter l'onglet Mesures (React #310, v0.9.54) alors que tsc, eslint
  // et les 336 tests passaient tous au vert.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // `exhaustive-deps` en avertissement : utile, mais le code existant a des
      // omissions délibérées. À traiter progressivement plutôt qu'en bloc.
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
)
