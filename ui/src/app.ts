import {
  getDefaultBlockLabel,
  platforma,
} from "@platforma-open/milaboratories.vdj-integration.model";
import { plRefsEqual } from "@platforma-sdk/model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import { watchEffect } from "vue";
import MainPage from "./pages/MainPage.vue";

export const sdkPlugin = defineAppV3(platforma, (app) => {
  app.model.data.customBlockLabel ??= "";

  syncDefaultBlockLabel(app.model);

  return {
    progress: () => false,
    routes: {
      "/": () => MainPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

type AppModel = ReturnType<typeof useApp>["model"];

function syncDefaultBlockLabel(model: AppModel) {
  watchEffect(() => {
    // The picked entry's label as the selector shows it: the subset's when one is picked (its
    // label already carries the dataset as a prefix), else the dataset's.
    const findLabel = (
      ref: typeof model.data.targetRef,
      filter: typeof model.data.targetFilterRef,
      options: typeof model.outputs.targetOptions,
    ) => {
      if (!ref) return undefined;
      const option = options?.find((o) => plRefsEqual(o.primary.ref, ref, true));
      const filterLabel =
        filter && option?.filters?.find((f) => plRefsEqual(f.ref, filter, true))?.label;
      return filterLabel ?? option?.primary.label;
    };

    const targetLabel = findLabel(
      model.data.targetRef,
      model.data.targetFilterRef,
      model.outputs.targetOptions,
    );
    const referenceLabel = findLabel(
      model.data.referenceRef,
      model.data.referenceFilterRef,
      model.outputs.referenceOptions,
    );

    model.data.defaultBlockLabel = getDefaultBlockLabel({
      targetLabel,
      referenceLabel,
    });
  });
}
