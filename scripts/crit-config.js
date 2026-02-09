const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
                pulsate: "Pulsate"
            },
            state: this.tabState
        };
    }

    _onRender(context, options) {
        this.element.querySelectorAll(".tabs a").forEach(tab => {
            tab.addEventListener("click", event => {
                event.preventDefault();
                const activeTab = event.currentTarget.dataset.tab;
                
                // Atualiza a navegação
                this.element.querySelectorAll(".tabs a").forEach(t => t.classList.remove("active"));
                event.currentTarget.classList.add("active");

                // Atualiza o conteúdo visível via CSS (sem re-renderizar)
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
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        object.pc.options ??= {};
        object.adversary.options ??= {};
        await game.settings.set("daggerheart-critical", "critFXSettings", object);
    }
}