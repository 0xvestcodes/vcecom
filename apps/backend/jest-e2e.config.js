module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["@swc/jest"],
  },
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.spec.ts",
    "!src/**/*.e2e-spec.ts",
  ],
  coverageDirectory: "./coverage-e2e",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@vcecom/db$": "<rootDir>/../../packages/db/src/index.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/test/setup-e2e.ts"],
  testTimeout: 60000,
};
