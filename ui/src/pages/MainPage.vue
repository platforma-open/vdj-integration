<script setup lang="ts">
import strings from "@milaboratories/strings";
import {
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  PlBtnGroup,
  PlDropdown,
  PlDropdownRef,
  PlMaskIcon24,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { ref, watch } from "vue";
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

// Auto-select feature when featureOptions change
watch(
  () => app.model.outputs.featureOptions,
  (options) => {
    if (!options || options.length === 0) return;
    const current = app.model.data.feature;
    if (current && options.some((o: { value: string }) => o.value === current)) return;
    app.model.data.feature = options[0].value;
  },
);

const sequenceTypeOptions = [
  { label: "Nucleotide", value: "nucleotide" },
  { label: "Amino acid", value: "aminoacid" },
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
        :options="app.model.outputs.featureOptions ?? []"
        label="Feature"
        :disabled="!app.model.data.targetRef || !app.model.data.referenceRef"
      />
    </PlSlideModal>
  </PlBlockPage>
</template>
