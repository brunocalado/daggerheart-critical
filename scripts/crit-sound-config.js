const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritSoundConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-sound-config",
        tag: "form",
        window: { title: "Critical Sound Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritSoundConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-sound-config.hbs" } };
    }

    async _prepareContext(options) {
        const settings = game.settings.get(MODULE_ID, "critSoundSettings");
        const config = foundry.utils.mergeObject({
            dualityEnabled: true,
            adversaryEnabled: true,
            dualitySoundPath: `modules/${MODULE_ID}/assets/sfx/pc-orchestral-win.mp3`,
            adversarySoundPath: `modules/${MODULE_ID}/assets/sfx/adv-critical-tension-impact.mp3`
        }, settings);

        return { config };
    }

    _onRender(context, options) {
        // Toggle duality sound path visibility
        this.element.querySelector("input[name='dualityEnabled']")?.addEventListener("change", (event) => {
            const group = this.element.querySelector(".duality-sound-group");
            if (group) group.style.display = event.target.checked ? "" : "none";
        });

        // Toggle adversary sound path visibility
        this.element.querySelector("input[name='adversaryEnabled']")?.addEventListener("change", (event) => {
            const group = this.element.querySelector(".adversary-sound-group");
            if (group) group.style.display = event.target.checked ? "" : "none";
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        object.dualityEnabled ??= false;
        object.adversaryEnabled ??= false;
        await game.settings.set(MODULE_ID, "critSoundSettings", object);
    }
}
