module.exports = {
  root: true,
  extends: '@react-native',
  plugins: ['@typescript-eslint'],
  rules: {
    'no-unused-vars': 'warn',
    'react-native/no-inline-styles': 'warn',
    'no-console': 'off',
    'react/self-closing-comp': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn'
  },
};