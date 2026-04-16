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
    const findLabel = (
      ref: typeof model.data.targetRef,
      options: typeof model.outputs.targetOptions,
    ) => (ref ? options?.find((o) => plRefsEqual(o.ref, ref))?.label : undefined);

    const targetLabel = findLabel(model.data.targetRef, model.outputs.targetOptions);
    const referenceLabel = findLabel(model.data.referenceRef, model.outputs.referenceOptions);

    model.data.defaultBlockLabel = getDefaultBlockLabel({
      targetLabel,
      referenceLabel,
    });
  });
}
