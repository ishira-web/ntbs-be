/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',

  // Coverage
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/**/?(*.)+(spec|test).js'
  ],
  coverageReporters: ['lcov', 'text-summary'],
  coverageThreshold: {
    global: { lines: 80, statements: 80, functions: 80, branches: 70 },
    'src/**/*.js': { lines: 80, statements: 80, functions: 80, branches: 70 }
  },

  // ESM note: with "type":"module" in package.json, .js is already ESM.
  // Do NOT set extensionsToTreatAsEsm for '.js'.

  // Pure JS (no transpile)
  transform: {},

  // Test files
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
};
