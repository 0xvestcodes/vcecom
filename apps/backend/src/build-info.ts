// Build info - used for logging and version tracking
// This file is typically generated during build, but we provide a default for development/testing
export const BUILD_INFO = {
  version: process.env.npm_package_version || "0.0.1",
  buildTime: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || "dev",
  gitBranch: process.env.GIT_BRANCH || "dev",
};
