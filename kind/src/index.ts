import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import type { PlRef } from "@platforma-sdk/model";
import { isPlRef } from "@platforma-sdk/model";
import { name, version } from "../package.json" with { type: "json" };

/** The alphabet the two datasets are matched on. */
export type SequenceType = "nucleotide" | "aminoacid";

/**
 * This block's init-params contract — everything a user sets by hand: the two
 * datasets to match, the alphabet and feature the match runs on, whether V/J
 * genes have to agree, the subtitle they type, and the resource knobs the
 * Advanced Settings section exposes.
 *
 * Two `BlockData` fields are deliberately absent. `defaultBlockLabel` is
 * recomputed from the two chosen datasets by a `watchEffect` in `ui/src/app.ts`,
 * so only the user's own `customBlockLabel` is worth restoring. `tableState` is
 * view state — sort, column visibility and grid position of the results table.
 *
 * Every field is optional: a block may be created with no template at all, and a
 * half-configured block is ordinary state the UI reaches. Requiring one would
 * make the block export a file its own kind refuses to apply, so export and
 * apply would stop being inverses.
 */
export type BlockParams = {
  targetRef?: PlRef;
  referenceRef?: PlRef;
  sequenceType?: SequenceType;
  feature?: string;
  useGeneMatching?: boolean;
  customBlockLabel?: string;
  mem?: number;
  cpu?: number;
};

/** The same contract at runtime, for params arriving from a template file rather than typed code. */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const {
    targetRef,
    referenceRef,
    sequenceType,
    feature,
    useGeneMatching,
    customBlockLabel,
    mem,
    cpu,
  } = value;

  return {
    targetRef: optionalPlRef(targetRef, "targetRef"),
    referenceRef: optionalPlRef(referenceRef, "referenceRef"),
    sequenceType: optionalSequenceType(sequenceType),
    feature: optionalString(feature, "feature"),
    useGeneMatching: optionalBoolean(useGeneMatching, "useGeneMatching"),
    customBlockLabel: optionalString(customBlockLabel, "customBlockLabel"),
    mem: optionalIntegerWithin(mem, 1, 1012, "mem", "GiB"),
    cpu: optionalIntegerWithin(cpu, 1, 128, "cpu", "cores"),
  };
}

// Identity (`name`/`version`) comes from this package's own `package.json`, so
// the on-wire `{name}@{version}` reference can never drift from what npm
// publishes; the bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({ name, version, parseInitializationParams });

// Internals

const SEQUENCE_TYPES: readonly string[] = ["nucleotide", "aminoacid"];

/** A reference to a column another block published. Checked with the SDK's own
 *  guard, so the brand and the optional enrichment flag stay in step with it. */
function optionalPlRef(value: unknown, at: string): PlRef | undefined {
  if (value === undefined) return undefined;
  if (!isPlRef(value))
    throw new Error(`'${at}' must be a dataset reference, written as { block, name }.`);
  return value;
}

function optionalSequenceType(value: unknown): SequenceType | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !SEQUENCE_TYPES.includes(value))
    throw new Error(`'sequenceType' must be one of: ${SEQUENCE_TYPES.join(", ")}.`);
  return value as SequenceType;
}

function optionalString(value: unknown, at: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`'${at}' must be a string.`);
  return value;
}

function optionalBoolean(value: unknown, at: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`'${at}' must be a boolean.`);
  return value;
}

/** The ranges the UI's number fields accept. Both values reach resource
 *  scheduling verbatim, where anything outside them fails the run. */
function optionalIntegerWithin(
  value: unknown,
  min: number,
  max: number,
  at: string,
  unit: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    throw new Error(`'${at}' must be an integer between ${min} and ${max} (${unit}).`);
  return value;
}
