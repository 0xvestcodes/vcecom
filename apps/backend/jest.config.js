module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  testPathIgnorePatterns: ["/node_modules/", ".*\\.integration\\.spec\\.ts$"],
  transform: {
    "^.+\\.(t|j)s$": ["@swc/jest"],
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/*.spec.ts",
    "!**/*.interface.ts",
    "!**/*.dto.ts",
    "!**/*.entity.ts",
    "!**/*.module.ts",
    "!**/main.ts",
    "!**/index.ts",
    "!**/*.config.ts",
    "!**/test/**",
    "!**/node_modules/**",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@vcecom/db$": "<rootDir>/../../../packages/db/src/index.ts",
    "^@/(.*)$": "<rootDir>/$1",
    "^.*build-info\\.js$": "<rootDir>/build-info.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testTimeout: 30000,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
