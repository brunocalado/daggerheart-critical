import { CritOverlay } from "./crit-overlay.js";

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
        position: { width: 500, height: "auto" },
        form: { handler: CritArtConfig.formHandler, closeOnSubmit: true }
    };

    static get PARTS() {
        return { content: { template: `modules/${MODULE_ID}/templates/crit-art-config.hbs` } };
    }

    async _prepareContext(options) {
        const settings = game.settings.get(MODULE_ID, "critArtSettings");
        
        // Merge with defaults to ensure structure exists
        // Position defaults are preserved in data but hidden in UI (defaulting to middle)
        const config = foundry.utils.mergeObject({
            pc: { 
                imagePath: "", 
                artSize: "normal", 
                offsetX: 0, 
                offsetY: 0 
            },
            adversary: { 
                imagePath: "", 
                artSize: "normal", 
                offsetX: 0, 
                offsetY: 0 
            }
        }, settings);

        return {
            config,
            state: this.tabState,
            sizes: {
                "very-small": "Very Small",
                "small": "Small",
                "normal": "Normal",
                "large": "Large"
            }
        };
    }

    _onRender(context, options) {
        // Tab navigation logic
        const tabs = this.element.querySelectorAll(".item[data-tab]");
        tabs.forEach(tab => {
            tab.addEventListener("click", (e) => {
                e.preventDefault();
                const tabName = e.currentTarget.dataset.tab;
                
                // Update internal state
                this.tabState.activeTab = tabName;

                // Update UI classes
                this.element.querySelectorAll(".item").forEach(t => t.classList.remove("active"));
                this.element.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
                
                e.currentTarget.classList.add("active");
                const targetContent = this.element.querySelector(`.tab[data-tab="${tabName}"]`);
                if (targetContent) targetContent.classList.add("active");
            });
        });

        // Range Slider Value Display Logic
        this.element.querySelectorAll(".range-slider").forEach(input => {
            // Update on input (drag)
            input.addEventListener("input", (e) => {
                const span = e.target.nextElementSibling;
                if (span && span.classList.contains("range-value")) {
                    span.textContent = e.target.value;
                }
            });
        });

        // Preview Button Logic
        const previewBtn = this.element.querySelector(".crit-preview-btn");
        if (previewBtn) {
            previewBtn.addEventListener("click", (event) => {
                event.preventDefault();
                const formData = new foundry.applications.ux.FormDataExtended(this.element);
                const object = foundry.utils.expandObject(formData.object);
                
                // Determine active tab to preview correct data (pc or adversary)
                const activeTab = this.tabState.activeTab;
                const artData = object[activeTab];

                if (!artData) return;
                
                // Construct override object for CritOverlay
                // We hardcode positions to 'middle' to ensure offsets start from center (0,0)
                const artOverride = {
                    imagePath: artData.imagePath,
                    position: "middle",
                    positionY: "middle",
                    artSize: artData.artSize,
                    offsetX: Number(artData.offsetX) || 0,
                    offsetY: Number(artData.offsetY) || 0
                };

                // Type determines the default text style (Gold/Duality or Red/Adversary)
                const type = activeTab === "pc" ? "duality" : "adversary";

                new CritOverlay({
                    type: type,
                    artOverride: artOverride,
                    userColor: "#ffffff" // Default color for preview
                }).render(true);
            });
        }
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        
        // Ensure defaults if fields are empty
        object.pc.offsetX = Number(object.pc.offsetX) || 0;
        object.pc.offsetY = Number(object.pc.offsetY) || 0;
        object.adversary.offsetX = Number(object.adversary.offsetX) || 0;
        object.adversary.offsetY = Number(object.adversary.offsetY) || 0;

        // Force positions to middle in the saved settings to maintain consistency
        object.pc.position = "middle";
        object.pc.positionY = "middle";
        object.adversary.position = "middle";
        object.adversary.positionY = "middle";

        await game.settings.set(MODULE_ID, "critArtSettings", object);
    }
}