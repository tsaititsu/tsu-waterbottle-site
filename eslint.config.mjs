import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'src/features/ziwei-chart/package/**',
      'test-results/**'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'warn',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'off'
    }
  }
]
