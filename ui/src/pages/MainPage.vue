<script setup lang="ts">
import strings from "@milaboratories/strings";
import {
  PlAccordionSection,
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  PlBtnGroup,
  PlDropdown,
  PlDropdownRef,
  PlMaskIcon24,
  PlNumberField,
  PlSectionSeparator,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "../app";

const app = useApp();

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

// Feature options for the currently selected sequence type, derived locally
// from a single server-computed map of options for both alphabets. This
// avoids a server round-trip when toggling sequence type.
const featureOptions = computed(() => {
  const byType = app.model.outputs.featureOptionsByType;
  if (!byType) return [];
  return byType[app.model.data.sequenceType] ?? [];
});

// Auto-select first available feature whenever the options for the current
// sequence type change, or when the current selection becomes invalid.
watch(
  featureOptions,
  (options) => {
    if (!options || options.length === 0) {
      app.model.data.feature = undefined;
      return;
    }
    const current = app.model.data.feature;
    if (current && options.some((o) => o.value === current)) return;
    app.model.data.feature = options[0].value;
  },
  { immediate: true },
);

const sequenceTypeOptions = [
  { label: "Aminoacid", value: "aminoacid" },
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
    <PlAgDataTableV2
      v-model="app.model.data.tableState"
      :settings="tableSettings"
      :not-ready-text="strings.callToActions.configureSettingsAndRun"
      :no-rows-text="strings.states.noDataAvailable"
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true" shadow>
      <template #title>Settings</template>
      <PlDropdownRef
        v-model="app.model.data.targetRef"
        :options="app.model.outputs.targetOptions"
        label="Target dataset"
        clearable
        required
      />
      <PlDropdownRef
        v-model="app.model.data.referenceRef"
        :options="app.model.outputs.referenceOptions"
        label="Reference dataset"
        clearable
        required
      />
      <PlBtnGroup
        v-model="app.model.data.sequenceType"
        label="Sequence type"
        :options="sequenceTypeOptions"
        compact
      />
      <PlDropdown
        v-model="app.model.data.feature"
        :options="featureOptions"
        label="Feature"
        :disabled="!app.model.data.targetRef || !app.model.data.referenceRef"
      />
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
