/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'CommonJS',
          moduleResolution: 'Node',
          esModuleInterop: true,
          strict: true,
          isolatedModules: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',
};
