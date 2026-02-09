const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CritOverlay extends HandlebarsApplicationMixin(ApplicationV2) {
    
    constructor(options = {}) {
        super(options);
        this.alias = options.alias || "Unknown";
        this.type = options.type || "duality"; // 'duality' or 'adversary'
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
        // Presentation logic based on type
        let label = "CRITICAL";
        let cssClass = "duality-style";

        if (this.type === "adversary") {
            cssClass = "adversary-style";
        }

        return {
            alias: this.alias,
            critTitle: label,
            typeClass: cssClass
        };
    }

    _onRender(context, options) {
        // Automatically closes after 3 seconds
        setTimeout(() => {
            this.close();
        }, 3000);
    }
}