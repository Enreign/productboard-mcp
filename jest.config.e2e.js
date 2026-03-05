/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.e2e.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          target: 'ES2022',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          allowImportingTsExtensions: true,
          noEmit: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@auth/(.*)\\.js$': '<rootDir>/src/auth/$1',
    '^@api/(.*)\\.js$': '<rootDir>/src/api/$1',
    '^@core/(.*)\\.js$': '<rootDir>/src/core/$1',
    '^@tools/(.*)\\.js$': '<rootDir>/src/tools/$1',
    '^@middleware/(.*)\\.js$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)\\.js$': '<rootDir>/src/utils/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol)/)',
  ],
  verbose: true,
  maxWorkers: 1,
};
