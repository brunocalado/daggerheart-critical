import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.tabState = {
            activeTab: "pc",
            temp: {}
        };
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-config",
        tag: "form",
        window: { title: "Critical FX Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-config.hbs" } };
    }
 
    async _prepareContext(options) {
        const settings = game.settings.get("daggerheart-critical", "critFXSettings");
        const config = foundry.utils.mergeObject({
            pc: { type: "none", options: {} },
            adversary: { type: "none", options: {} }
        }, settings);

        if (this.tabState.temp.pc) config.pc.type = this.tabState.temp.pc;
        if (this.tabState.temp.adversary) config.adversary.type = this.tabState.temp.adversary;
        this.tabState.temp = {};

        for (const key of ["pc", "adversary"]) {
            config[key].options ??= {};
            if (config[key].type === "border" && !config[key].options.color) {
                config[key].options.color = "#ff0000";
            }
        }

        return {
            config,
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
            },
            state: this.tabState
        };
    }

    _onRender(context, options) {
        this.element.querySelectorAll(".tabs a").forEach(tab => {
            tab.addEventListener("click", event => {
                event.preventDefault();
                const activeTab = event.currentTarget.dataset.tab;
                
                // Update navigation
                this.element.querySelectorAll(".tabs a").forEach(t => t.classList.remove("active"));
                event.currentTarget.classList.add("active");

                // Update visible content via CSS (without re-rendering)
                this.element.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
                this.element.querySelector(`.tab[data-tab="${activeTab}"]`)?.classList.add("active");
                
                this.tabState.activeTab = activeTab;
            });
        });

        this.element.querySelectorAll("select[name$='.type']").forEach(select => {
            select.addEventListener("change", (event) => {
                const key = event.target.name.split('.')[0];
                this.tabState.temp[key] = event.target.value;
                this.render();
            });
        });

        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            const activeTab = this.tabState.activeTab; // "pc" or "adversary"
            const type = activeTab === "pc" ? "duality" : "adversary";

            // Read current FX values from the form
            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            const fxConfig = object[activeTab] || {};
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
            const soundEnabled = (type === "adversary") ? soundSettings.adversaryEnabled : soundSettings.dualityEnabled;
            if (soundEnabled) {
                const soundPath = (type === "adversary") ? soundSettings.adversarySoundPath : soundSettings.dualitySoundPath;
                if (soundPath) {
                    foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, true);
                }
            }

        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        object.pc.options ??= {};
        object.adversary.options ??= {};
        await game.settings.set("daggerheart-critical", "critFXSettings", object);
    }
}