import { CritOverlay } from "./crit-overlay.js";
import { CriticalSettingsManager } from "./critical-settings-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritArtConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.configId = options.configId || null;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        window: { title: "Critical Art Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritArtConfig.formHandler, closeOnSubmit: true }
    };

    get id() {
        // Generate unique ID based on configId
        return this.configId 
            ? `daggerheart-crit-art-config-${this.configId}`
            : "daggerheart-crit-art-config";
    }

    static get PARTS() {
        return { content: { template: `modules/${MODULE_ID}/templates/crit-art-config.hbs` } };
    }

    async _prepareContext(options) {
        // Get config-specific settings if configId is provided
        let configSettings = null;
        if (this.configId) {
            configSettings = CriticalSettingsManager.getConfigSettings(this.configId, "art");
        }
        
        // Fallback to global settings if no config-specific settings
        if (!configSettings) {
            const settings = game.settings.get(MODULE_ID, "critArtSettings");
            configSettings = settings.pc || {};
        }

        const config = foundry.utils.mergeObject({ 
            imagePath: "", 
            artSize: "normal", 
            offsetX: 0, 
            offsetY: 0 
        }, configSettings);

        return {
            config,
            configId: this.configId, // Pass configId to template
            sizes: {
                "very-small": "Very Small",
                "small": "Small",
                "normal": "Normal",
                "large": "Large"
            }
        };
    }

    _onRender(context, options) {
        // Range Slider Value Display Logic
        this.element.querySelectorAll(".range-slider").forEach(input => {
            // Update on input (drag)
            input.addEventListener("input", (e) => {
                const span = e.target.nextElementSibling;
                if (span && span.classList.contains("range-value")) {
                    span.textContent = e.target.value;
                }
            });
        });

        // Preview Button Logic
        const previewBtn = this.element.querySelector(".crit-preview-btn");
        if (previewBtn) {
            previewBtn.addEventListener("click", (event) => {
                event.preventDefault();
                const formData = new foundry.applications.ux.FormDataExtended(this.element);
                const object = foundry.utils.expandObject(formData.object);
                
                const artData = object;

                if (!artData) return;
                
                // Construct override object for CritOverlay
                const artOverride = {
                    imagePath: artData.imagePath,
                    position: "middle",
                    positionY: "middle",
                    artSize: artData.artSize,
                    offsetX: Number(artData.offsetX) || 0,
                    offsetY: Number(artData.offsetY) || 0
                };

                const type = "duality";

                new CritOverlay({
                    type: type,
                    artOverride: artOverride,
                    userColor: "#ffffff"
                }).render(true);
            });
        }
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        
        // Ensure defaults if fields are empty
        object.offsetX = Number(object.offsetX) || 0;
        object.offsetY = Number(object.offsetY) || 0;

        // Force positions to middle in the saved settings to maintain consistency
        object.position = "middle";
        object.positionY = "middle";

        // Get configId from hidden field in form
        const configId = object._configId;
        delete object._configId; // Remove from saved data

        if (configId) {
            // Save to config-specific settings
            await CriticalSettingsManager.saveConfigSettings(configId, "art", object);
            ui.notifications.info("Art configuration saved for this entry");
            
            // Trigger refresh of main config modal if it's open
            const mainModal = Object.values(ui.windows).find(w => w.id === "daggerheart-critical-config-modal");
            if (mainModal) {
                mainModal.render();
            }
        } else {
            // Fallback to global settings
            const settings = game.settings.get(MODULE_ID, "critArtSettings");
            settings.pc = object;
            await game.settings.set(MODULE_ID, "critArtSettings", settings);
            ui.notifications.info("Global art configuration saved");
        }
    }
}