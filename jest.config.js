/** Unit tests for the pure FSM run under ts-jest (no RN runtime needed). */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.ts"],
  moduleNameMapper: {
    "^@config/(.*)$": "<rootDir>/config/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
