import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritTextConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.tabState = {
            activeTab: "pc"
        };
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-text-config",
        tag: "form",
        window: { title: "Critical Text Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritTextConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-text-config.hbs" } };
    }

    async _prepareContext(options) {
        const settings = game.settings.get("daggerheart-critical", "critTextSettings");
        const config = foundry.utils.mergeObject({
            pc: {
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
            },
            adversary: {
                content: "CRITICAL",
                fontFamily: "Bangers",
                fontSize: "normal",
                letterSpacing: "normal",
                color: "#ff0000",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false,
                useImage: false,
                imagePath: "modules/daggerheart-critical/assets/critical-img-demo/molten_voltage.webp",
                imageSize: "normal"
            }
        }, settings);

        return {
            config,
            fonts: {
                "Bangers": "Bangers",
                "Black Ops One": "Black Ops One",
                "Cinzel Decorative": "Cinzel Decorative",
                "Creepster": "Creepster",
                "Eater": "Eater",
                "MedievalSharp": "MedievalSharp",
                "Metal Mania": "Metal Mania",
                "Nosifer": "Nosifer",
                "Rubik Glitch": "Rubik Glitch",
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
            },
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

        // Toggle color picker visibility based on usePlayerColor checkbox
        this.element.querySelectorAll("input[name$='.usePlayerColor']").forEach(checkbox => {
            checkbox.addEventListener("change", (event) => {
                const key = event.target.name.split('.')[0];
                const colorGroup = this.element.querySelector(`.${key}-color-group`);
                if (colorGroup) {
                    colorGroup.style.display = event.target.checked ? "none" : "";
                }
            });
        });

        // Toggle image/text groups based on useImage checkbox
        this.element.querySelectorAll("input[name$='.useImage']").forEach(checkbox => {
            checkbox.addEventListener("change", (event) => {
                const key = event.target.name.split('.')[0];
                const imageGroup = this.element.querySelector(`.${key}-image-group`);
                const textGroup = this.element.querySelector(`.${key}-text-group`);
                if (imageGroup) {
                    imageGroup.style.display = event.target.checked ? "" : "none";
                }
                if (textGroup) {
                    textGroup.style.display = event.target.checked ? "none" : "";
                }
            });
        });

        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            const activeTab = this.tabState.activeTab; // "pc" or "adversary"
            const type = activeTab === "pc" ? "duality" : "adversary";

            // Read current text values from the form
            const formData = new FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            object[activeTab].usePlayerColor ??= false;
            object[activeTab].useImage ??= false;
            const textConfig = object[activeTab];

            // Trigger overlay with current form text settings
            const userColor = game.user.color?.toString() || "#ffffff";
            new CritOverlay({ type, userColor, configOverride: textConfig }).render(true);

            // Trigger saved FX
            const fxSettings = game.settings.get(MODULE_ID, "critFXSettings");
            const fxConfig = fxSettings[activeTab];
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
            const settingKey = (type === "adversary") ? "adversarySoundPath" : "dualitySoundPath";
            const soundPath = game.settings.get(MODULE_ID, settingKey);
            if (soundPath) {
                foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, true);
            }

        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        // Checkboxes not submitted when unchecked, ensure defaults
        object.pc.usePlayerColor ??= false;
        object.adversary.usePlayerColor ??= false;
        object.pc.useImage ??= false;
        object.adversary.useImage ??= false;
        await game.settings.set("daggerheart-critical", "critTextSettings", object);
    }
}
