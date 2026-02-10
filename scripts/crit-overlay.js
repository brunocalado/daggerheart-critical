const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FONT_SIZE_MAP = {
    small: "4",
    normal: "8",
    large: "12",
    "extra-large": "16"
};

const LETTER_SPACING_MAP = {
    normal: "normal",
    tight: "-0.05em",
    wide: "0.15em",
    "extra-wide": "0.3em"
};

export class CritOverlay extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        super(options);
        this.type = options.type || "duality"; // 'duality' or 'adversary'
        this.userColor = options.userColor || "#ffffff";
        this.configOverride = options.configOverride || null;
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-overlay",
        tag: "div",
        window: {
            frame: false,
            positioned: false,
        },
        classes: ["crit-overlay-app"],
        position: {
            width: "100%",
            height: "100%",
            top: 0,
            left: 0
        }
    };

    static get PARTS() {
        return {
            content: {
                template: "modules/daggerheart-critical/templates/crit-splash.hbs",
            },
        };
    }

    async _prepareContext(options) {
        const configKey = (this.type === "adversary") ? "adversary" : "pc";
        const cssClass = (this.type === "adversary") ? "adversary-style" : "duality-style";

        // Load text settings
        const textSettings = game.settings.get("daggerheart-critical", "critTextSettings");
        const defaults = {
            pc: { content: "CRITICAL", fontFamily: "Bangers", fontSize: "normal", letterSpacing: "normal", color: "#ffcc00", backgroundColor: "#000000", fill: "none", usePlayerColor: false, useImage: false, imagePath: "modules/daggerheart-critical/assets/critical-img-demo/molten_voltage.webp", imageSize: "normal" },
            adversary: { content: "CRITICAL", fontFamily: "Bangers", fontSize: "normal", letterSpacing: "normal", color: "#ff0000", backgroundColor: "#000000", fill: "none", usePlayerColor: false, useImage: false, imagePath: "modules/daggerheart-critical/assets/critical-img-demo/molten_voltage.webp", imageSize: "normal" }
        };
        const textConfig = this.configOverride
            ? foundry.utils.mergeObject(defaults[configKey], this.configOverride)
            : foundry.utils.mergeObject(defaults[configKey], textSettings[configKey] || {});

        // Map fontSize name to rem value
        textConfig.fontSizeRem = FONT_SIZE_MAP[textConfig.fontSize] || "8";

        // Map letterSpacing name to CSS value
        textConfig.letterSpacingCSS = LETTER_SPACING_MAP[textConfig.letterSpacing] || "normal";

        // Resolve color: use player color if enabled
        if (textConfig.usePlayerColor) {
            textConfig.resolvedColor = this.userColor;
        } else {
            textConfig.resolvedColor = textConfig.color || defaults[configKey].color;
        }

        return {
            critTitle: textConfig.content || "CRITICAL",
            typeClass: cssClass,
            textConfig
        };
    }

    _onRender(context, options) {
        // Automatically closes after 3 seconds
        setTimeout(() => {
            this.close();
        }, 3000);
    }
}
