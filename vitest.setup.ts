// Registers @testing-library/jest-dom matchers (e.g. toBeInTheDocument) on
// Vitest's expect. Safe to load in the node environment too — it only extends
// the matcher set and is exercised only by the jsdom component tests.
import '@testing-library/jest-dom/vitest'
