import type { InferOutputsType, PlDataTableStateV2, PlRef } from "@platforma-sdk/model";
import {
  BlockModelV3,
  createPlDataTableStateV2,
  createPlDataTableV2,
  DataModelBuilder,
  plRefsEqual,
} from "@platforma-sdk/model";

export type BlockData = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  targetRef?: PlRef;
  referenceRef?: PlRef;
  sequenceType: "nucleotide" | "aminoacid";
  feature?: string;
  mem?: number;
  cpu?: number;
  tableState: PlDataTableStateV2;
};

export type BlockArgs = {
  targetRef: PlRef;
  referenceRef: PlRef;
  sequenceType: "nucleotide" | "aminoacid";
  feature: string;
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

export function getDefaultBlockLabel(data: { targetLabel?: string; referenceLabel?: string }) {
  if (data.targetLabel && data.referenceLabel)
    return `${data.targetLabel} to ${data.referenceLabel}`;
  return "Select datasets";
}

export const blockDataModel = new DataModelBuilder().from<BlockData>("Ver_2026_03_27").init(() => ({
  defaultBlockLabel: getDefaultBlockLabel({}),
  customBlockLabel: "",
  sequenceType: "aminoacid" as const,
  tableState: createPlDataTableStateV2(),
}));

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.targetRef === undefined) throw new Error("No target ref");
    if (data.referenceRef === undefined) throw new Error("No reference ref");
    if (data.feature === undefined) throw new Error("No feature");

    return {
      targetRef: data.targetRef,
      referenceRef: data.referenceRef,
      sequenceType: data.sequenceType,
      feature: data.feature,
      mem: data.mem,
      cpu: data.cpu,
    };
  })

  .output("targetOptions", (ctx) => {
    const options = ctx.resultPool.getOptions(datasetOptionPatterns, datasetOptionConfig);
    const refRef = ctx.data.referenceRef;
    if (!options || !refRef) return options;
    return options.filter((o) => !plRefsEqual(o.ref, refRef));
  })

  .output("referenceOptions", (ctx) => {
    const options = ctx.resultPool.getOptions(datasetOptionPatterns, datasetOptionConfig);
    const targetRef = ctx.data.targetRef;
    if (!options || !targetRef) return options;
    return options.filter((o) => !plRefsEqual(o.ref, targetRef));
  })

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
      nucleotide: featuresForAlphabet("nucleotide"),
      aminoacid: featuresForAlphabet("aminoacid"),
    };
  })

  .outputWithStatus("resultsTable", (ctx) => {
    const cols = ctx.outputs?.resolve("resultsPf")?.getPColumns();
    if (cols === undefined) return undefined;
    return createPlDataTableV2(ctx, cols, ctx.data.tableState);
  })

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => "VDJ Integration")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((_ctx) => [{ type: "link", href: "/", label: "Main" }])

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
