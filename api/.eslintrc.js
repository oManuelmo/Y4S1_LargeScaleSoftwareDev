module.exports = {
  // Use the TypeScript parser
  parser: '@typescript-eslint/parser',
  // Specify your project's ESLint environment
  env: {
    node: true, // Node.js global variables and Node.js scoping
    es2021: true // ECMAScript 2021 global variables
  },
  // Extend recommended configurations and Prettier config
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier' // Must be the last one
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    // Path to your main tsconfig.json file for better type-aware linting
    project: './tsconfig.json'
  },
  root: true, // Make this the root configuration for the API
  rules: {
    // Add custom rules here, e.g.:
    // 'no-console': 'warn',
    // '@typescript-eslint/explicit-module-boundary-types': 'off',
  }
};