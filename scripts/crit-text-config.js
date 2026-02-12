import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";
import { CriticalSettingsManager } from "./critical-settings-manager.js";
import { CritSoundConfig } from "./crit-sound-config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritTextConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.configId = options.configId || null;
        this.tabState = {
            activeTab: "pc"
        };
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        window: { title: "Critical Text Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritTextConfig.formHandler, closeOnSubmit: true }
    };

    get id() {
        // Generate unique ID based on configId
        return this.configId 
            ? `daggerheart-crit-text-config-${this.configId}`
            : "daggerheart-crit-text-config";
    }

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-text-config.hbs" } };
    }

    async _prepareContext(options) {
        // Get config-specific settings if configId is provided
        let configSettings = null;
        if (this.configId) {
            configSettings = CriticalSettingsManager.getConfigSettings(this.configId, "text");
        }
        
        // Fallback to global settings if no config-specific settings
        if (!configSettings) {
            const settings = game.settings.get("daggerheart-critical", "critTextSettings");
            configSettings = settings.pc || {};
        }

        const config = foundry.utils.mergeObject({
            content: "CRITICAL",
            fontFamily: "Bangers",
            fontSize: "normal",
            letterSpacing: "normal",
            color: "#ffcc00",
            backgroundColor: "#000000",
            fill: "none",
            usePlayerColor: false,
            useImage: false,
            imagePath: "modules/daggerheart-critical/assets/critical-img-demo/molten_voltage.webp",
            imageSize: "normal"
        }, configSettings);

        return {
            config,
            configId: this.configId, // Pass configId to template
            fonts: {
                "Bangers": "Bangers",
                "Black Ops One": "Black Ops One",
                "Cinzel Decorative": "Cinzel Decorative",
                "Creepster": "Creepster",
                "Eater": "Eater",
                "MedievalSharp": "MedievalSharp",
                "Metal Mania": "Metal Mania",
                "Nosifer": "Nosifer",
                "Shojumaru": "Shojumaru",
                "Special Elite": "Special Elite",
                "Signika": "Signika"
            },
            fontSizes: {
                small: "Small",
                normal: "Normal",
                large: "Large",
                "extra-large": "Extra Large"
            },
            letterSpacings: {
                "tight": "Tight",                
                "normal": "Normal",
                "wide": "Wide",
                "extra-wide": "Extra Wide"
            },
            fills: {
                none: "None",
                box: "Box",
                band: "Band",
                full: "Full Screen"
            },
            imageSizes: {
                small: "Small",
                normal: "Normal",
                large: "Large",
                "extra-large": "Extra Large"
            }
        };
    }

    _onRender(context, options) {
        // Toggle color picker visibility based on usePlayerColor checkbox
        this.element.querySelector("input[name='usePlayerColor']")?.addEventListener("change", (event) => {
            const colorGroup = this.element.querySelector(".color-group");
            if (colorGroup) {
                colorGroup.style.display = event.target.checked ? "none" : "";
            }
        });

        // Toggle image/text groups based on useImage checkbox
        this.element.querySelector("input[name='useImage']")?.addEventListener("change", (event) => {
            const imageGroup = this.element.querySelector(".image-group");
            const textGroup = this.element.querySelector(".text-group");
            if (imageGroup) {
                imageGroup.style.display = event.target.checked ? "" : "none";
            }
            if (textGroup) {
                textGroup.style.display = event.target.checked ? "none" : "";
            }
        });

        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            const type = "duality";

            // Read current text values from the form
            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            object.usePlayerColor ??= false;
            object.useImage ??= false;
            const textConfig = object;

            // Trigger overlay with current form text settings
            const userColor = game.user.color?.toString() || "#ffffff";
            new CritOverlay({ type, userColor, configOverride: textConfig }).render(true);

            // Trigger saved FX
            const fxSettings = game.settings.get(MODULE_ID, "critFXSettings");
            const fxConfig = fxSettings.pc;
            if (fxConfig && fxConfig.type !== "none") {
                const fx = new CritFX();
                switch (fxConfig.type) {
                    case "shake": fx.ScreenShake(fxConfig.options || {}); break;
                    case "shatter": fx.GlassShatter(fxConfig.options || {}); break;
                    case "border": fx.ScreenBorder(fxConfig.options || {}); break;
                    case "pulsate": fx.Pulsate(fxConfig.options || {}); break;
                }
            }

            // Play sound
            const soundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
            const soundConfig = soundSettings.duality;
            if (soundConfig && soundConfig.enabled && soundConfig.soundPath) {
                const soundPath = await CritSoundConfig.getSoundPath(soundConfig);
                if (soundPath) {
                    foundry.audio.AudioHelper.play({ 
                        src: soundPath, 
                        volume: 0.8, 
                        autoplay: true, 
                        loop: false 
                    }, true);
                }
            }
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        // Checkboxes not submitted when unchecked, ensure defaults
        object.usePlayerColor ??= false;
        object.useImage ??= false;
        
        // Get configId from hidden field in form
        const configId = object._configId;
        delete object._configId; // Remove from saved data
        
        if (configId) {
            // Save to config-specific settings
            await CriticalSettingsManager.saveConfigSettings(configId, "text", object);
            ui.notifications.info("Text configuration saved for this entry");
            
            // Trigger refresh of main config modal if it's open
            const mainModal = Object.values(ui.windows).find(w => w.id === "daggerheart-critical-config-modal");
            if (mainModal) {
                mainModal.render();
            }
        } else {
            // Fallback to global settings
            const settings = game.settings.get("daggerheart-critical", "critTextSettings");
            settings.pc = object;
            await game.settings.set("daggerheart-critical", "critTextSettings", settings);
            ui.notifications.info("Global text configuration saved");
        }
    }
}
