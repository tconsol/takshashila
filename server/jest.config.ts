import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/src/tests/setup.ts'],
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  forceExit: true,       // BullMQ/redis producers hold handles in unit tests
  testTimeout: 15000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/**/*.types.ts'],
  coverageDirectory: 'coverage',
};

export default config;
