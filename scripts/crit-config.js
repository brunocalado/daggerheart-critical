import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";
import { CriticalSettingsManager } from "./critical-settings-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.configId = options.configId || null;
        this.tempType = null;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        window: { title: "Critical FX Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritConfig.formHandler, closeOnSubmit: true }
    };

    get id() {
        // Generate unique ID based on configId
        return this.configId 
            ? `daggerheart-crit-config-${this.configId}`
            : "daggerheart-crit-config";
    }

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-config.hbs" } };
    }
 
    async _prepareContext(options) {
        // Get config-specific settings if configId is provided
        let configSettings = null;
        if (this.configId) {
            configSettings = CriticalSettingsManager.getConfigSettings(this.configId, "fx");
        }
        
        // Fallback to global settings if no config-specific settings
        if (!configSettings) {
            const settings = game.settings.get("daggerheart-critical", "critFXSettings");
            configSettings = settings.pc || {};
        }

        const config = foundry.utils.mergeObject({
            type: "none",
            options: {}
        }, configSettings);

        // Use temp type if set (from select change)
        if (this.tempType) {
            config.type = this.tempType;
            this.tempType = null;
        }

        if (config.type === "border" && !config.options.color) {
            config.options.color = "#ff0000";
        }

        return {
            config,
            configId: this.configId, // Pass configId to template
            effects: {
                none: "None",
                shake: "Screen Shake",
                shatter: "Glass Shatter",
                border: "Screen Border",
                pulsate: "Pulsate",
                confetti: "Confetti"
            },
            confettiIntensities: {
                1: "Very Weak",
                2: "Weak",
                3: "Normal",
                4: "Strong",
                5: "Very Strong"
            }
        };
    }

    _onRender(context, options) {
        const typeSelect = this.element.querySelector("select[name='type']");
        if (typeSelect) {
            typeSelect.addEventListener("change", (event) => {
                this.tempType = event.target.value;
                this.render();
            });
        }

        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            const type = "duality";

            // Read current FX values from the form
            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            const fxConfig = object;
            fxConfig.options ??= {};

            // Trigger overlay (uses saved text settings)
            const userColor = game.user.color?.toString() || "#ffffff";
            new CritOverlay({ type, userColor }).render(true);

            // Trigger FX from current form values
            if (fxConfig.type && fxConfig.type !== "none") {
                const fx = new CritFX();
                switch (fxConfig.type) {
                    case "shake": fx.ScreenShake(fxConfig.options); break;
                    case "shatter": fx.GlassShatter(fxConfig.options); break;
                    case "border": fx.ScreenBorder(fxConfig.options); break;
                    case "pulsate": fx.Pulsate(fxConfig.options); break;
                    case "confetti": fx.Confetti(fxConfig.options); break;
                }
            }

            // Play sound
            const soundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
            const soundConfig = soundSettings.duality;
            if (soundConfig && soundConfig.enabled && soundConfig.soundPath) {
                foundry.audio.AudioHelper.play({ 
                    src: soundConfig.soundPath, 
                    volume: 0.8, 
                    autoplay: true, 
                    loop: false 
                }, true);
            }
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        object.options ??= {};
        
        // Get configId from hidden field in form
        const configId = object._configId;
        delete object._configId; // Remove from saved data
        
        if (configId) {
            // Save to config-specific settings
            await CriticalSettingsManager.saveConfigSettings(configId, "fx", object);
            ui.notifications.info("FX configuration saved for this entry");
            
            // Trigger refresh of main config modal if it's open
            const mainModal = Object.values(ui.windows).find(w => w.id === "daggerheart-critical-config-modal");
            if (mainModal) {
                mainModal.render();
            }
        } else {
            // Fallback to global settings
            const settings = game.settings.get("daggerheart-critical", "critFXSettings");
            settings.pc = object;
            await game.settings.set("daggerheart-critical", "critFXSettings", settings);
            ui.notifications.info("Global FX configuration saved");
        }
    }
}