module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  modulePathIgnorePatterns: ['<rootDir>/.venv/'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  collectCoverageFrom: ['static/jingle_bell_hero_core.js'],
  coverageThreshold: {
    'static/jingle_bell_hero_core.js': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
