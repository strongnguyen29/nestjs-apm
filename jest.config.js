module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'lib',
  testRegex: '.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!index.ts',
    '!start.ts',
  ],
  coverageDirectory: '../coverage',
};
