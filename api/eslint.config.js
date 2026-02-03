import eslint from '@eslint/js';
import security from 'eslint-plugin-security';
// 1. Correct Import: The official utility for Flat Config is imported as 'typescript-eslint'
import tseslint from 'typescript-eslint'; 
import prettierConfig from 'eslint-config-prettier';

// export default MUST be a single array or result of a config function
export default tseslint.config(
  // 1. Apply ESLint recommended rules
  eslint.configs.recommended,
  
  // 2. Apply TypeScript rules. This array will contain the type-checked rules
  ...tseslint.configs.recommendedTypeChecked, 
  
  // 3. Configuration specific to *.ts files
  {
    files: ['**/*.ts'],
    // Explicitly enable Node environment
    languageOptions: {
      globals: {
        module: 'readonly',
        exports: 'readonly'
      },
      parser: tseslint.parser,
      parserOptions: {
        // Essential for type-aware linting
        project: './tsconfig.json', 
        tsconfigRootDir: import.meta.dirname,
        // Since you are using "type": "module", you should set sourceType
        sourceType: 'module',
      },
    },
    rules: {
        // Recommended rule overrides for a server environment:
        'no-console': 'warn',
        '@typescript-eslint/no-floating-promises': 'error',
        // Example: Force explicit return types on all functions
        // '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
        
        // Disable base rule as it conflicts with the TS one
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    }
  },

  // 4. Define files and directories to IGNORE (Important: This is replacing .gitignore)
  {
    ignores: [
      'node_modules/', 
      'dist/', // Build output
      'test-publish.ts', // Specific files to ignore
      'jest.config.js',
      'jest.setup.ts',
      'src/migrations/*.ts', // Ignore migration files if they contain raw SQL/TypeORM boilerplate
      '*.config.js', // Ignore this config file itself
      'src/*.spec.ts'
    ],
  },
  
  // 5. Prettier Config MUST be last to ensure it overwrites conflicting style rules
  prettierConfig,
  security.configs.recommended
);