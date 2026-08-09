/**
 * Single entry for @ton/core used by backend + contract wrappers.
 * Import from here (not from "@ton/core" inside backend/) so Node resolves
 * one physical package and Address instanceof checks succeed.
 */
export {
  Address,
  beginCell,
  Dictionary,
  toNano,
  type Sender,
} from "@ton/core";
