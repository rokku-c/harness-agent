import { createFormModel, createFormParser, createFormControls, createFormRenderer, createFormMount } from "@effect-agent/effect-ui"
import { createConfigEdits } from "./client/config-edits.ts"
import { createConfigApi } from "./client/config-api.ts"
import { describeConfigState } from "./client/config-state.ts"
import { createConfigPanel } from "./client/config-panel.ts"
import { createConsoleViews } from "./client/console-views.ts"
import { bootConsole } from "./client/console-navigation.ts"

/** All factories receive dependencies explicitly: no bundler or runtime import needed. */
export const consoleBrowserScript: string = `(() => {
  const model = (${createFormModel.toString()})();
  const parser = (${createFormParser.toString()})();
  const controls = (${createFormControls.toString()})();
  const renderer = (${createFormRenderer.toString()})(controls);
  const mount = (${createFormMount.toString()})(model, renderer, parser);
  const api = (${createConfigApi.toString()})(window.fetch.bind(window));
  const config = (${createConfigPanel.toString()})(api, model, mount, ${describeConfigState.toString()}, ${createConfigEdits.toString()});
  const views = (${createConsoleViews.toString()})();
  (${bootConsole.toString()})(config, views);
})();`
