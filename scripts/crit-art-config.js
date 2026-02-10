import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritArtConfig extends HandlebarsApplicationMixin(ApplicationV2) {

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

        // Get all non-GM users
        const players = game.users.filter(u => !u.isGM).map(u => {
            const userSettings = saved[u.id] || {};
            return {
                id: u.id,
                name: u.name,
                color: u.color?.toString() || "#ffffff",
                imagePath: userSettings.imagePath || "",
                position: userSettings.position || "middle",
                positionY: userSettings.positionY || "middle",
                artSize: userSettings.artSize || "normal"
            };
        });

        return { players };
    }

    _onRender(context, options) {
        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();

            // Read current form values
            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            const users = object.users || {};

            // Pick the first user that has an image configured for preview
            const currentUserId = game.user.id;
            let previewUser = users[currentUserId];
            if (!previewUser?.imagePath) {
                previewUser = Object.values(users).find(u => u.imagePath);
            }
            if (!previewUser?.imagePath) return;

            // Trigger overlay with art override
            const userColor = game.user.color?.toString() || "#ffffff";
            new CritOverlay({
                type: "duality",
                userColor,
                authorId: currentUserId,
                artOverride: {
                    imagePath: previewUser.imagePath,
                    position: previewUser.position || "middle",
                    positionY: previewUser.positionY || "middle",
                    artSize: previewUser.artSize || "normal"
                }
            }).render(true);

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
            if (soundSettings.dualityEnabled && soundSettings.dualitySoundPath) {
                foundry.audio.AudioHelper.play({ src: soundSettings.dualitySoundPath, volume: 0.8, autoplay: true, loop: false }, true);
            }
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        const users = object.users || {};
        await game.settings.set(MODULE_ID, "critArtSettings", users);
    }
}
