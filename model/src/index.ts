import { kind } from "@platforma-open/milaboratories.vdj-integration.kind";
import type {
  DatasetOption,
  InferOutputsType,
  PlDataTableStateV2,
  PlRef,
  RenderCtxBase,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  buildDatasetOptions,
  createGlobalPObjectId,
  createPlDataTableStateV2,
  createPlDataTableV2,
  DataModelBuilder,
  isPColumnSpec,
  plRefsEqual,
} from "@platforma-sdk/model";

export type BlockData = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  targetRef?: PlRef;
  // Optional `pl7.app/isSubset` column picked alongside the target.
  targetFilterRef?: PlRef;
  referenceRef?: PlRef;
  // As targetFilterRef, for the reference.
  referenceFilterRef?: PlRef;
  sequenceType: "nucleotide" | "aminoacid";
  feature?: string;
  useGeneMatching: boolean;
  mem?: number;
  cpu?: number;
  tableState: PlDataTableStateV2;
};

export type BlockArgs = {
  targetRef: PlRef;
  /** `targetFilterRef` as its column id: the workflow stamps this string as the target-side
   *  outputs' `pl7.app/inputSubset`. Absent without a filter. */
  targetFilter?: string;
  referenceRef: PlRef;
  /** As targetFilter, for the reference. */
  referenceFilter?: string;
  sequenceType: "nucleotide" | "aminoacid";
  feature: string;
  useGeneMatching: boolean;
  mem?: number;
  cpu?: number;
};

const datasetOptionPatterns = [
  {
    axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/clonotypeKey" }],
    annotations: { "pl7.app/isAnchor": "true" },
  },
  {
    axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/scClonotypeKey" }],
    annotations: { "pl7.app/isAnchor": "true" },
  },
];

const datasetOptionConfig = {
  label: {
    forceTraceElements: ["milaboratories.samples-and-data/dataset"],
    addLabelAsSuffix: true,
  },
};

/** Column id of a subset filter: the form the workflow stamps as `pl7.app/inputSubset`. */
const filterIdOf = (ref: PlRef | undefined): string | undefined =>
  ref && createGlobalPObjectId(ref.blockId, ref.name);

/**
 * The datasets one side can pick, each with its subset columns (`pl7.app/isSubset`, e.g.
 * repertoire-labeling labels or Lead Selection picks) as filters. The dataset picked on the other
 * side is left out. Only the filters come from `buildDatasetOptions`: its primary refs carry
 * `requireEnrichments`, which would make this block depend on every block between it and the
 * datasets. The primary predicate only has to cover the datasets above: results are matched to
 * them by ref.
 */
function datasetOptionsExcept(
  ctx: RenderCtxBase<unknown, BlockData>,
  otherRef: PlRef | undefined,
): DatasetOption[] | undefined {
  const options = ctx.resultPool
    .getOptions(datasetOptionPatterns, datasetOptionConfig)
    .filter((o) => !otherRef || !plRefsEqual(o.ref, otherRef));
  const withFilters =
    buildDatasetOptions(ctx, {
      primary: (spec) =>
        isPColumnSpec(spec) &&
        spec.annotations?.["pl7.app/isAnchor"] === "true" &&
        spec.axesSpec[0]?.name === "pl7.app/sampleId",
      // Only subsets keyed by the clonotype axis alone: matching is per clonotype.
      filter: (spec) =>
        isPColumnSpec(spec) &&
        spec.axesSpec.length === 1 &&
        spec.axesSpec[0]?.name !== "pl7.app/sampleId",
    }) ?? [];
  return options.map((primary) => {
    const filters = withFilters.find((o) => plRefsEqual(o.primary.ref, primary.ref, true))?.filters;
    return filters === undefined ? { primary } : { primary, filters };
  });
}

/** The target + reference pair, by column id: tags outputs with the datasets they were computed
 *  for, so the UI can tell them from ones left over from a previous pick. */
export function datasetPairKey(targetRef: PlRef, referenceRef: PlRef): string {
  return `${filterIdOf(targetRef)}|${filterIdOf(referenceRef)}`;
}

export function getDefaultBlockLabel(data: { targetLabel?: string; referenceLabel?: string }) {
  if (data.targetLabel && data.referenceLabel)
    return `${data.targetLabel} ↔ ${data.referenceLabel}`;
  return "Select datasets";
}

export const blockDataModel = new DataModelBuilder({ kind })
  .from<BlockData>("Ver_2026_03_27")
  .init(({ params }) => ({
    defaultBlockLabel: getDefaultBlockLabel({}),
    customBlockLabel: params?.customBlockLabel ?? "",
    targetRef: params?.targetRef,
    targetFilterRef: params?.targetFilterRef,
    referenceRef: params?.referenceRef,
    referenceFilterRef: params?.referenceFilterRef,
    sequenceType: params?.sequenceType ?? "aminoacid",
    feature: params?.feature,
    useGeneMatching: params?.useGeneMatching ?? true,
    mem: params?.mem,
    cpu: params?.cpu,
    tableState: createPlDataTableStateV2(),
  }));

export const platforma = BlockModelV3.create({ dataModel: blockDataModel, kind })

  .templateParams((data) => ({
    targetRef: data.targetRef,
    targetFilterRef: data.targetFilterRef,
    referenceRef: data.referenceRef,
    referenceFilterRef: data.referenceFilterRef,
    sequenceType: data.sequenceType,
    feature: data.feature,
    useGeneMatching: data.useGeneMatching,
    customBlockLabel: data.customBlockLabel,
    mem: data.mem,
    cpu: data.cpu,
  }))

  .args<BlockArgs>((data) => {
    if (data.targetRef === undefined) throw new Error("No target ref");
    if (data.referenceRef === undefined) throw new Error("No reference ref");
    if (data.feature === undefined) throw new Error("No feature");

    const targetFilter = filterIdOf(data.targetFilterRef);
    const referenceFilter = filterIdOf(data.referenceFilterRef);
    return {
      targetRef: data.targetRef,
      // Absent without a filter, so unfiltered args are unchanged.
      ...(targetFilter !== undefined && { targetFilter }),
      referenceRef: data.referenceRef,
      ...(referenceFilter !== undefined && { referenceFilter }),
      sequenceType: data.sequenceType,
      feature: data.feature,
      useGeneMatching: data.useGeneMatching,
      mem: data.mem,
      cpu: data.cpu,
    };
  })

  .output("targetOptions", (ctx) => datasetOptionsExcept(ctx, ctx.data.referenceRef))

  .output("referenceOptions", (ctx) => datasetOptionsExcept(ctx, ctx.data.targetRef))

  .output("featureOptionsByType", (ctx) => {
    const targetRef = ctx.data.targetRef;
    const referenceRef = ctx.data.referenceRef;
    if (targetRef === undefined || referenceRef === undefined) return undefined;

    const isTargetSingleCell =
      ctx.resultPool.getPColumnSpecByRef(targetRef)?.axesSpec[1].name ===
      "pl7.app/vdj/scClonotypeKey";
    const isRefSingleCell =
      ctx.resultPool.getPColumnSpecByRef(referenceRef)?.axesSpec[1].name ===
      "pl7.app/vdj/scClonotypeKey";

    const priority: Record<string, number> = { VDJRegion: 0, VDJRegionInFrame: 1, CDR3: 2 };

    const featuresForAlphabet = (
      alphabet: "nucleotide" | "aminoacid",
    ): { label: string; value: string }[] | undefined => {
      const targetDomain: Record<string, string> = { "pl7.app/alphabet": alphabet };
      if (isTargetSingleCell) targetDomain["pl7.app/vdj/scClonotypeChain/index"] = "primary";

      const refDomain: Record<string, string> = { "pl7.app/alphabet": alphabet };
      if (isRefSingleCell) refDomain["pl7.app/vdj/scClonotypeChain/index"] = "primary";

      const targetCols = ctx.resultPool.getAnchoredPColumns({ main: targetRef }, [
        { name: "pl7.app/vdj/sequence", domain: targetDomain },
      ]);
      const refCols = ctx.resultPool.getAnchoredPColumns({ main: referenceRef }, [
        { name: "pl7.app/vdj/sequence", domain: refDomain },
      ]);
      if (targetCols === undefined || refCols === undefined) return undefined;

      const extractFeatures = (cols: typeof targetCols) => {
        const features = new Set<string>();
        for (const col of cols) {
          const feature = col.spec?.domain?.["pl7.app/vdj/feature"];
          if (feature) features.add(feature);
        }
        return features;
      };

      const targetFeatures = extractFeatures(targetCols);
      const refFeatures = extractFeatures(refCols);
      const intersection = [...targetFeatures].filter((f) => refFeatures.has(f));

      intersection.sort((a, b) => {
        const pa = priority[a] ?? 100;
        const pb = priority[b] ?? 100;
        if (pa !== pb) return pa - pb;
        return a.localeCompare(b);
      });

      return intersection.map((f) => ({ label: f, value: f }));
    };

    return {
      forDatasets: datasetPairKey(targetRef, referenceRef),
      nucleotide: featuresForAlphabet("nucleotide"),
      aminoacid: featuresForAlphabet("aminoacid"),
    };
  })

  .outputWithStatus("resultsTable", (ctx) => {
    const cols = ctx.outputs?.resolve("resultsPf")?.getPColumns();
    if (cols === undefined) return undefined;
    return createPlDataTableV2(ctx, cols, ctx.data.tableState);
  })

  .output("matchStats", (ctx) => {
    const raw = ctx.outputs?.resolve("stats")?.getDataAsString?.();
    if (!raw) return undefined;
    const lines = raw.trim().split("\n");
    if (lines.length < 2) return undefined;
    const header = lines[0].split("\t");
    const sideIdx = header.indexOf("side");
    const matchedIdx = header.indexOf("matched");
    const totalIdx = header.indexOf("total");
    if (sideIdx < 0 || matchedIdx < 0 || totalIdx < 0) return undefined;
    const result: Record<string, { matched: number; total: number; pct: string }> = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      const matched = parseInt(cols[matchedIdx], 10);
      const total = parseInt(cols[totalIdx], 10);
      result[cols[sideIdx]] = {
        matched,
        total,
        pct: total > 0 ? ((matched / total) * 100).toFixed(1) : "0.0",
      };
    }
    return result;
  })

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => "VDJ Integration")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((_ctx) => [{ type: "link", href: "/", label: "Main" }])

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
