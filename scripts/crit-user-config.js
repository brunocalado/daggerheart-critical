import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

const TEXT_DEFAULTS = {
    content: "CRITICAL",
    fontFamily: "Bangers",
    fontSize: "normal",
    letterSpacing: "normal",
    color: "#ffcc00",
    backgroundColor: "#000000",
    fill: "none",
    usePlayerColor: false,
    useImage: false,
    imagePath: "",
    imageSize: "normal"
};

export class CritUserConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-user-config",
        tag: "form",
        window: { title: "Per-User Override Configuration" },
        position: { width: 540, height: "auto" },
        form: { handler: CritUserConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: `modules/${MODULE_ID}/templates/crit-user-config.hbs` } };
    }

    async _prepareContext(options) {
        const overrides = game.settings.get(MODULE_ID, "critUserOverrides");

        const players = game.users.filter(u => !u.isGM).map(u => {
            const userOverride = overrides[u.id] || {};

            // Text: use saved override or defaults
            const textOverride = userOverride.text
                ? { ...TEXT_DEFAULTS, ...userOverride.text }
                : { ...TEXT_DEFAULTS };

            // FX: use saved override or empty
            const fxOverride = { ...(userOverride.fx || {}) };
            fxOverride.type ??= "none";
            fxOverride.options ??= {};
            if (fxOverride.type === "border" && !fxOverride.options.color) {
                fxOverride.options.color = "#ff0000";
            }

            return {
                id: u.id,
                name: u.name,
                color: u.color?.toString() || "#ffffff",
                hasText: !!userOverride.text,
                hasFx: !!userOverride.fx,
                hasSound: !!userOverride.sound,
                textOverride,
                fxOverride,
                soundOverride: userOverride.sound || {}
            };
        });

        return {
            players,
            fonts: {
                "Bangers": "Bangers",
                "Black Ops One": "Black Ops One",
                "Cinzel Decorative": "Cinzel Decorative",
                "Creepster": "Creepster",
                "Eater": "Eater",
                "MedievalSharp": "MedievalSharp",
                "Metal Mania": "Metal Mania",
                "Nosifer": "Nosifer",
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
            effects: {
                none: "None",
                shake: "Screen Shake",
                shatter: "Glass Shatter",
                border: "Screen Border",
                pulsate: "Pulsate"
            }
        };
    }

    _onRender(context, options) {
        // Toggle buttons for collapsible sections
        this.element.querySelectorAll(".crit-user-toggle-btn").forEach(btn => {
            btn.addEventListener("click", event => {
                event.preventDefault();
                const targetId = btn.dataset.target;
                const section = this.element.querySelector(`#${targetId}`);
                if (section) {
                    const isVisible = section.style.display !== "none";
                    section.style.display = isVisible ? "none" : "";
                    btn.classList.toggle("expanded", !isVisible);
                }
            });
        });

        // Toggle color picker visibility based on usePlayerColor checkbox
        this.element.querySelectorAll("input[name$='.text.usePlayerColor']").forEach(checkbox => {
            checkbox.addEventListener("change", event => {
                const section = event.target.closest(".crit-user-section");
                const colorGroup = section?.querySelector(".user-color-group");
                if (colorGroup) {
                    colorGroup.style.display = event.target.checked ? "none" : "";
                }
            });
        });

        // Toggle image/text groups based on useImage checkbox
        this.element.querySelectorAll("input[name$='.text.useImage']").forEach(checkbox => {
            checkbox.addEventListener("change", event => {
                const section = event.target.closest(".crit-user-section");
                const imageGroup = section?.querySelector(".user-image-group");
                const textGroup = section?.querySelector(".user-text-group");
                if (imageGroup) imageGroup.style.display = event.target.checked ? "" : "none";
                if (textGroup) textGroup.style.display = event.target.checked ? "none" : "";
            });
        });

        // Toggle sound path visibility based on enabled checkbox
        this.element.querySelectorAll("input[name$='.sound.enabled']").forEach(checkbox => {
            checkbox.addEventListener("change", event => {
                const section = event.target.closest(".crit-user-section");
                const soundGroup = section?.querySelector(".user-sound-path-group");
                if (soundGroup) soundGroup.style.display = event.target.checked ? "" : "none";
            });
        });

        // FX type selector change -> show/hide option groups via DOM (NO re-render)
        this.element.querySelectorAll("select[name$='.fx.type']").forEach(select => {
            select.addEventListener("change", event => {
                const fxSection = event.target.closest(".crit-user-section");
                if (!fxSection) return;
                const selectedType = event.target.value;
                // Hide all fx option groups
                fxSection.querySelectorAll(".fx-options-group").forEach(g => g.style.display = "none");
                // Show the selected one
                const target = fxSection.querySelector(`.fx-options-group[data-fx-type="${selectedType}"]`);
                if (target) target.style.display = "";
            });
        });

        // Clear buttons
        this.element.querySelectorAll(".crit-user-clear-btn").forEach(btn => {
            btn.addEventListener("click", event => {
                event.preventDefault();
                const clearPrefix = btn.dataset.clear;
                const category = btn.dataset.category; // "text", "fx", or "sound"
                const section = btn.closest(".crit-user-section");
                const card = btn.closest(".crit-user-card");
                if (section) {
                    // Reset fields
                    if (category === "text") {
                        // Reset to defaults
                        const fields = {
                            content: TEXT_DEFAULTS.content,
                            fontFamily: TEXT_DEFAULTS.fontFamily,
                            fontSize: TEXT_DEFAULTS.fontSize,
                            letterSpacing: TEXT_DEFAULTS.letterSpacing,
                            color: TEXT_DEFAULTS.color,
                            backgroundColor: TEXT_DEFAULTS.backgroundColor,
                            fill: TEXT_DEFAULTS.fill
                        };
                        for (const [field, val] of Object.entries(fields)) {
                            const input = section.querySelector(`[name="${clearPrefix}.${field}"]`);
                            if (input) input.value = val;
                        }
                        // Uncheck toggles
                        const useImage = section.querySelector(`[name="${clearPrefix}.useImage"]`);
                        if (useImage) useImage.checked = false;
                        const usePlayerColor = section.querySelector(`[name="${clearPrefix}.usePlayerColor"]`);
                        if (usePlayerColor) usePlayerColor.checked = false;
                        // Reset visibility
                        const imageGroup = section.querySelector(".user-image-group");
                        const textGroup = section.querySelector(".user-text-group");
                        const colorGroup = section.querySelector(".user-color-group");
                        if (imageGroup) imageGroup.style.display = "none";
                        if (textGroup) textGroup.style.display = "";
                        if (colorGroup) colorGroup.style.display = "";
                        // Clear imagePath
                        const imgPath = section.querySelector(`[name="${clearPrefix}.imagePath"]`);
                        if (imgPath) imgPath.value = "";
                    } else if (category === "fx") {
                        const typeSelect = section.querySelector(`[name="${clearPrefix}.type"]`);
                        if (typeSelect) typeSelect.value = "none";
                        section.querySelectorAll(".fx-options-group").forEach(g => g.style.display = "none");
                        section.querySelectorAll(`[name^="${clearPrefix}.options."]`).forEach(input => {
                            if (input.type === "color") input.value = "#ff0000";
                            else input.value = "";
                        });
                    } else if (category === "sound") {
                        const enabled = section.querySelector(`[name="${clearPrefix}.enabled"]`);
                        if (enabled) enabled.checked = false;
                        const soundPath = section.querySelector(`[name="${clearPrefix}.soundPath"]`);
                        if (soundPath) soundPath.value = "";
                        const soundGroup = section.querySelector(".user-sound-path-group");
                        if (soundGroup) soundGroup.style.display = "none";
                    }

                    // Collapse the section
                    section.style.display = "none";
                    const toggleBtn = this.element.querySelector(`[data-target="${section.id}"]`);
                    if (toggleBtn) toggleBtn.classList.remove("expanded");

                    // Remove the badge
                    if (card) {
                        const badge = card.querySelector(`.badge-${category}`);
                        if (badge) badge.remove();
                    }
                }
            });
        });

        // Per-user preview buttons
        this.element.querySelectorAll(".crit-user-preview-btn").forEach(btn => {
            btn.addEventListener("click", event => {
                event.preventDefault();
                const userId = btn.dataset.userId;
                const card = btn.closest(".crit-user-card");
                if (!card) return;

                const formData = new foundry.applications.ux.FormDataExtended(this.element);
                const object = foundry.utils.expandObject(formData.object);
                const userData = object.users?.[userId];
                if (!userData) return;

                const userColor = game.users.get(userId)?.color?.toString() || "#ffffff";

                // Text override
                if (userData.text) {
                    userData.text.usePlayerColor ??= false;
                    userData.text.useImage ??= false;
                }
                new CritOverlay({
                    type: "duality",
                    userColor,
                    authorId: userId,
                    configOverride: userData.text || null
                }).render(true);

                // FX override
                const fxConfig = userData.fx || {};
                fxConfig.options ??= {};
                if (fxConfig.type && fxConfig.type !== "none") {
                    const fx = new CritFX();
                    switch (fxConfig.type) {
                        case "shake": fx.ScreenShake(fxConfig.options); break;
                        case "shatter": fx.GlassShatter(fxConfig.options); break;
                        case "border": fx.ScreenBorder(fxConfig.options); break;
                        case "pulsate": fx.Pulsate(fxConfig.options); break;
                    }
                }

                // Sound override
                if (userData.sound?.enabled && userData.sound.soundPath) {
                    foundry.audio.AudioHelper.play({
                        src: userData.sound.soundPath,
                        volume: 0.8,
                        autoplay: true,
                        loop: false
                    }, true);
                }
            });
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        const cleanedData = {};

        if (object.users) {
            for (const [userId, userData] of Object.entries(object.users)) {
                const userOverride = {};

                // Text override - only save if content or imagePath is set
                if (userData.text) {
                    userData.text.usePlayerColor ??= false;
                    userData.text.useImage ??= false;
                    const hasTextContent = userData.text.content?.trim();
                    const hasImageContent = userData.text.useImage && userData.text.imagePath?.trim();
                    if (hasTextContent || hasImageContent) {
                        userOverride.text = userData.text;
                    }
                }

                // FX override - only save if type is not "none"
                if (userData.fx) {
                    const fxType = userData.fx.type;
                    if (fxType && fxType !== "none") {
                        // Map prefixed option names back to generic names
                        const rawOpts = userData.fx.options || {};
                        const cleanOpts = {};
                        for (const [key, val] of Object.entries(rawOpts)) {
                            if (key.startsWith(`${fxType}_`)) {
                                cleanOpts[key.replace(`${fxType}_`, "")] = val;
                            }
                        }
                        userOverride.fx = { type: fxType, options: cleanOpts };
                    }
                }

                // Sound override - only save if enabled with a path
                if (userData.sound) {
                    userData.sound.enabled ??= false;
                    if (userData.sound.enabled && userData.sound.soundPath?.trim()) {
                        userOverride.sound = userData.sound;
                    }
                }

                if (Object.keys(userOverride).length > 0) {
                    cleanedData[userId] = userOverride;
                }
            }
        }

        await game.settings.set(MODULE_ID, "critUserOverrides", cleanedData);
    }
}
