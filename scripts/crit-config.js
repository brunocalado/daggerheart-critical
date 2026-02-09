const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CritConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.tempType = null;
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-config",
        tag: "form",
        window: { title: "Critical FX Configuration" },
        position: { width: 400, height: "auto" },
        form: { handler: CritConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-config.hbs" } };
    }

    async _prepareContext(options) {
        const settings = game.settings.get("daggerheart-critical", "critFXSettings") || { type: "none", options: {} };
        const config = foundry.utils.deepClone(settings);

        if (this.tempType) config.type = this.tempType;

        // Ensure options exists and set default color for border to prevent warning
        config.options ??= {};
        if (config.type === "border" && !config.options.color) {
            config.options.color = "#ff0000";
        }

        return {
            config,
            effects: {
                none: "None",
                shake: "Screen Shake",
                shatter: "Glass Shatter",
                border: "Screen Border",
                pulsate: "Pulsate"
            },
            isShake: config.type === "shake",
            isShatter: config.type === "shatter",
            isBorder: config.type === "border",
            isPulsate: config.type === "pulsate"
        };
    }

    _onRender(context, options) {
        this.element.querySelector("select[name='type']").addEventListener("change", (event) => {
            this.tempType = event.target.value;
            this.render();
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        await game.settings.set("daggerheart-critical", "critFXSettings", object);
    }
}