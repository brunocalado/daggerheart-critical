import { CriticalSettingsManager } from "./critical-settings-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritSoundConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.configId = options.configId || null;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        window: { title: "Critical Sound Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritSoundConfig.formHandler, closeOnSubmit: true }
    };

    get id() {
        // Generate unique ID based on configId
        return this.configId 
            ? `daggerheart-crit-sound-config-${this.configId}`
            : "daggerheart-crit-sound-config";
    }

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

        return { 
            config,
            configId: this.configId // Pass configId to template
        };
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
        
        // Get configId from hidden field in form
        const configId = object._configId;
        delete object._configId; // Remove from saved data
        
        if (configId) {
            // Save to config-specific settings
            await CriticalSettingsManager.saveConfigSettings(configId, "sound", object);
            ui.notifications.info("Sound configuration saved for this entry");
            
            // Trigger refresh of main config modal if it's open
            const mainModal = Object.values(ui.windows).find(w => w.id === "daggerheart-critical-config-modal");
            if (mainModal) {
                mainModal.render();
            }
        } else {
            // Fallback to global settings
            const settings = game.settings.get(MODULE_ID, "critSoundSettings");
            settings.duality = object;
            await game.settings.set(MODULE_ID, "critSoundSettings", settings);
            ui.notifications.info("Global sound configuration saved");
        }
    }
}
