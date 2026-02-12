import { CriticalSettingsManager } from "./critical-settings-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritSoundConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.configId = options.configId || null;
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-sound-config",
        tag: "form",
        window: { title: "Critical Sound Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritSoundConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-sound-config.hbs" } };
    }

    async _prepareContext(options) {
        // Get config-specific settings if configId is provided
        let configSettings = null;
        if (this.configId) {
            configSettings = CriticalSettingsManager.getConfigSettings(this.configId, "sound");
        }
        
        // Fallback to global settings if no config-specific settings
        if (!configSettings) {
            const settings = game.settings.get(MODULE_ID, "critSoundSettings");
            configSettings = settings.duality || {};
        }

        const config = foundry.utils.mergeObject({
            enabled: true,
            soundPath: `modules/${MODULE_ID}/assets/sfx/pc-orchestral-win.mp3`
        }, configSettings);

        return { config };
    }

    _onRender(context, options) {
        // Toggle sound path visibility
        this.element.querySelector("input[name='enabled']")?.addEventListener("change", (event) => {
            const group = this.element.querySelector(".sound-group");
            if (group) group.style.display = event.target.checked ? "" : "none";
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        object.enabled ??= false;
        
        // Get the configId from the form's app instance
        const app = form.closest(".window-app")?._app;
        const configId = app?.configId;
        
        if (configId) {
            // Save to config-specific settings
            await CriticalSettingsManager.saveConfigSettings(configId, "sound", object);
        } else {
            // Fallback to global settings
            const settings = game.settings.get(MODULE_ID, "critSoundSettings");
            settings.duality = object;
            await game.settings.set(MODULE_ID, "critSoundSettings", settings);
        }
    }
}
