import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritArtConfig extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        super(options);
        this.tabState = {
            activeTab: "pc"
        };
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-art-config",
        tag: "form",
        window: { title: "Critical Art Configuration" },
        position: { width: 520, height: "auto" },
        form: { handler: CritArtConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: `modules/${MODULE_ID}/templates/crit-art-config.hbs` } };
    }

    async _prepareContext(options) {
        const saved = game.settings.get(MODULE_ID, "critArtSettings");

        // PC default config (single default for all PCs)
        const pcDefaults = { imagePath: "", position: "middle", positionY: "middle", artSize: "normal" };
        const pc = foundry.utils.mergeObject(pcDefaults, saved.pc || {});

        // Adversary config
        const adversaryDefaults = { imagePath: "", position: "middle", positionY: "middle", artSize: "normal" };
        const adversary = foundry.utils.mergeObject(adversaryDefaults, saved.adversary || {});

        return {
            config: { pc, adversary },
            state: this.tabState
        };
    }

    _onRender(context, options) {
        // Tab click handlers
        this.element.querySelectorAll(".tabs a").forEach(tab => {
            tab.addEventListener("click", event => {
                event.preventDefault();
                const activeTab = event.currentTarget.dataset.tab;

                this.element.querySelectorAll(".tabs a").forEach(t => t.classList.remove("active"));
                event.currentTarget.classList.add("active");

                this.element.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
                this.element.querySelector(`.tab[data-tab="${activeTab}"]`)?.classList.add("active");

                this.tabState.activeTab = activeTab;
            });
        });

        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();

            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            const activeTab = this.tabState.activeTab;
            const type = activeTab === "pc" ? "duality" : "adversary";

            let artOverride = null;

            if (activeTab === "pc") {
                const pc = object.pc || {};
                if (pc.imagePath) {
                    artOverride = {
                        imagePath: pc.imagePath,
                        position: pc.position || "middle",
                        positionY: pc.positionY || "middle",
                        artSize: pc.artSize || "normal"
                    };
                }
            } else {
                const adv = object.adversary || {};
                if (adv.imagePath) {
                    artOverride = {
                        imagePath: adv.imagePath,
                        position: adv.position || "middle",
                        positionY: adv.positionY || "middle",
                        artSize: adv.artSize || "normal"
                    };
                }
            }

            const userColor = game.user.color?.toString() || "#ffffff";
            new CritOverlay({
                type,
                userColor,
                authorId: game.user.id,
                artOverride
            }).render(true);

            // Trigger saved FX
            const configKey = activeTab === "pc" ? "pc" : "adversary";
            const fxSettings = game.settings.get(MODULE_ID, "critFXSettings");
            const fxConfig = fxSettings[configKey];
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
        const data = {};
        if (object.pc) {
            data.pc = object.pc;
        }
        if (object.adversary) {
            data.adversary = object.adversary;
        }
        await game.settings.set(MODULE_ID, "critArtSettings", data);
    }
}
