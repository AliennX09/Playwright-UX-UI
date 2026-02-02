import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  verbose: true,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  // Avoid instrumenting files that are serialized into browser context (page.evaluate),
  // which would inject coverage helpers into evaluated functions and break in-page execution.
  coveragePathIgnorePatterns: ["<rootDir>/src/testers/ux-ui-tester.ts"],
};

export default config;
