/**
 * Source Paths & Data Binding Resolution Module.
 * Modularized into ./source-paths/ for clean domain separation:
 * - pathUtils: Path introspection, matching, and JSON object recursion
 * - variableSources: Mutable variables collection for assignments
 * - transformerSources: Standalone and helper transformer gathering
 * - endpointSources: Inbound request payloads and environment variables
 * - step-resolvers/: Specialized resolvers for step types (db, call, storage, transformer, etc.)
 * - getAvailableSources: Central aggregator for binding candidates
 */
export * from "./source-paths";
