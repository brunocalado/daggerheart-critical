const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
                usePlayerColor: false
            },
            adversary: {
                content: "CRITICAL",
                fontFamily: "Bangers",
                fontSize: "normal",
                letterSpacing: "normal",
                color: "#ff0000",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false
            }
        }, settings);

        return {
            config,
            fonts: {
                "Bangers": "Bangers",
                "Black Ops One": "Black Ops One",
                "Cinzel Decorative": "Cinzel Decorative",
                "Metal Mania": "Metal Mania",
                "Signika": "Signika"
            },
            fontSizes: {
                small: "Small",
                normal: "Normal",
                large: "Large",
                "extra-large": "Extra Large"
            },
            letterSpacings: {
                "normal": "Normal",
                "tight": "Tight",
                "wide": "Wide",
                "extra-wide": "Extra Wide"
            },
            fills: {
                none: "None",
                box: "Box",
                band: "Band",
                full: "Full Screen"
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
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        // Checkboxes not submitted when unchecked, ensure defaults
        object.pc.usePlayerColor ??= false;
        object.adversary.usePlayerColor ??= false;
        await game.settings.set("daggerheart-critical", "critTextSettings", object);
    }
}
