<script setup lang="ts">
import strings from "@milaboratories/strings";
import { datasetPairKey } from "@platforma-open/milaboratories.vdj-integration.model";
import type { DatasetSelection, PlRef } from "@platforma-sdk/model";
import { createDatasetSelection, createPrimaryRef } from "@platforma-sdk/model";
import {
  PlAccordionSection,
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  PlBtnGroup,
  PlCheckbox,
  PlDatasetSelector,
  PlDropdown,
  PlMaskIcon24,
  PlNumberField,
  PlSectionSeparator,
  PlSlideModal,
  PlTooltip,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "../app";

const app = useApp();

// Each selector picks a dataset, or a dataset narrowed by one of its subset columns. Clearing it
// clears both.
const selectionOf = (side: "target" | "reference") =>
  computed<DatasetSelection | undefined>({
    get: () => {
      const ref: PlRef | undefined = app.model.data[`${side}Ref`];
      if (ref === undefined) return undefined;
      return createDatasetSelection(createPrimaryRef(ref, app.model.data[`${side}FilterRef`]));
    },
    set: (selection) => {
      app.model.data[`${side}Ref`] = selection?.primary.column;
      app.model.data[`${side}FilterRef`] = selection?.primary.filter;
    },
  });
const targetSelection = selectionOf("target");
const referenceSelection = selectionOf("reference");

const settingsOpen = ref(
  app.model.data.targetRef === undefined || app.model.data.referenceRef === undefined,
);

watch(
  () => app.model.outputs.isRunning,
  (isRunning) => {
    if (isRunning) {
      settingsOpen.value = false;
    }
  },
);

// The selected target + reference pair, in the form the model tags its options with.
const datasetPair = computed(() => {
  const { targetRef, referenceRef } = app.model.data;
  return targetRef && referenceRef ? datasetPairKey(targetRef, referenceRef) : undefined;
});

// The server-computed map of options for both alphabets, only when it was computed for the
// selected datasets: right after a dataset change the previous pair's map is still there.
const currentOptionsByType = computed(() => {
  const byType = app.model.outputs.featureOptionsByType;
  return byType !== undefined && byType.forDatasets === datasetPair.value ? byType : undefined;
});

// Feature options for the currently selected sequence type, derived locally
// from a single server-computed map of options for both alphabets. This
// avoids a server round-trip when toggling sequence type. `undefined` while they
// are computed, which puts the dropdown in its loading state.
const featureOptions = computed(() => {
  if (datasetPair.value === undefined) return [];
  return currentOptionsByType.value?.[app.model.data.sequenceType];
});

// Auto-select first available feature whenever the options for the current
// sequence type change, or when the current selection becomes invalid. Nothing is
// touched while they are computed, so reopening the block keeps the choice.
// Watched by content: the SDK patches outputs in place.
watch(
  () => JSON.stringify(featureOptions.value ?? null),
  () => {
    const options = featureOptions.value;
    if (options === undefined) return;
    if (options.length === 0) {
      app.model.data.feature = undefined;
      return;
    }
    const current = app.model.data.feature;
    if (current && options.some((o) => o.value === current)) return;
    app.model.data.feature = options[0].value;
  },
  { immediate: true },
);

// Auto-detect sequence type: prefer nucleotide when available. Only after the user picks
// a new target or reference, once the options for that pair arrive, so reopening the block
// or applying a template keeps the stored choice.
const detectSequenceTypeFor = ref<string | undefined>();
watch(datasetPair, (pair) => {
  detectSequenceTypeFor.value = pair;
});
watch([detectSequenceTypeFor, () => JSON.stringify(currentOptionsByType.value ?? null)], () => {
  const byType = currentOptionsByType.value;
  if (byType === undefined || byType.forDatasets !== detectSequenceTypeFor.value) return;
  if (byType.nucleotide === undefined) return;
  if (byType.nucleotide.length > 0) {
    app.model.data.sequenceType = "nucleotide";
  }
  detectSequenceTypeFor.value = undefined;
});

const sequenceTypeOptions = [
  { label: "Amino acid", value: "aminoacid" },
  { label: "Nucleotide", value: "nucleotide" },
];

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.resultsTable,
});
</script>

<template>
  <PlBlockPage
    v-model:subtitle="app.model.data.customBlockLabel"
    :subtitle-placeholder="app.model.data.defaultBlockLabel"
    title="VDJ Integration"
  >
    <template #append>
      <PlBtnGhost @click.stop="() => (settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <div
      v-if="app.model.outputs.matchStats"
      style="margin-bottom: 12px; font-size: 13px; opacity: 0.7"
    >
      Target: {{ app.model.outputs.matchStats.target.matched }}/{{
        app.model.outputs.matchStats.target.total
      }}
      ({{ app.model.outputs.matchStats.target.pct }}%) matched &nbsp;&middot;&nbsp; Reference:
      {{ app.model.outputs.matchStats.reference.matched }}/{{
        app.model.outputs.matchStats.reference.total
      }}
      ({{ app.model.outputs.matchStats.reference.pct }}%) matched
    </div>
    <PlAgDataTableV2
      v-model="app.model.data.tableState"
      :settings="tableSettings"
      :not-ready-text="strings.callToActions.configureSettingsAndRun"
      :no-rows-text="strings.states.noDataAvailable"
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true" shadow>
      <template #title>Settings</template>
      <PlDatasetSelector
        v-model="targetSelection"
        :options="app.model.outputs.targetOptions"
        label="Target repertoire"
        clearable
        required
      >
        <template #tooltip>
          The repertoire whose clonotypes you want to enrich with extra information — usually a deep
          bulk dataset.
        </template>
      </PlDatasetSelector>
      <PlDatasetSelector
        v-model="referenceSelection"
        :options="app.model.outputs.referenceOptions"
        label="Reference repertoire"
        clearable
        required
      >
        <template #tooltip>
          Provides clonotype properties (paired chains, liabilities, clusters) that get carried onto
          matched target clonotypes — usually a single-cell dataset.
        </template>
      </PlDatasetSelector>
      <PlBtnGroup
        v-model="app.model.data.sequenceType"
        label="Sequence type"
        :options="sequenceTypeOptions"
        compact
      >
        <template #tooltip>
          Nucleotide is more precise. Switch to amino acid only when one of the datasets has no
          nucleotide information — for example, an amino-acid-only dataset brought in through the
          Import VDJ Data block.
        </template>
      </PlBtnGroup>
      <PlDropdown
        v-model="app.model.data.feature"
        :options="featureOptions"
        label="Matching region"
        :disabled="!app.model.data.targetRef || !app.model.data.referenceRef"
      >
        <template #tooltip>
          VDJRegion is most precise; CDR3 yields more matches at slightly lower specificity. Only
          regions present in both datasets appear here.
        </template>
      </PlDropdown>
      <PlCheckbox v-model="app.model.data.useGeneMatching">
        Require matching V and J genes
        <PlTooltip class="info" position="top">
          <template #tooltip>
            Turn off only when the two datasets use different V/J gene naming conventions — for
            example, a dataset brought in through the Import VDJ Data block, which preserves the
            source pipeline's original gene names.
          </template>
        </PlTooltip>
      </PlCheckbox>
      <PlAccordionSection label="Advanced Settings">
        <PlSectionSeparator>Resource Allocation</PlSectionSeparator>
        <PlNumberField
          v-model="app.model.data.mem"
          label="Memory (GiB)"
          :minValue="1"
          :step="1"
          :maxValue="1012"
        >
          <template #tooltip> Sets the amount of memory to use for the computation. </template>
        </PlNumberField>
        <PlNumberField
          v-model="app.model.data.cpu"
          label="CPU (cores)"
          :minValue="1"
          :step="1"
          :maxValue="128"
        >
          <template #tooltip> Sets the number of CPU cores to use for the computation. </template>
        </PlNumberField>
      </PlAccordionSection>
    </PlSlideModal>
  </PlBlockPage>
</template>
