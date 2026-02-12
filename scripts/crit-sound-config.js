import { CriticalSettingsManager } from "./critical-settings-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

export class CritSoundConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.configId = options.configId || null;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        window: { title: "Critical Sound Configuration" },
        position: { width: 500, height: "auto" },
        form: { handler: CritSoundConfig.formHandler, closeOnSubmit: true }
    };

    get id() {
        // Generate unique ID based on configId
        return this.configId 
            ? `daggerheart-crit-sound-config-${this.configId}`
            : "daggerheart-crit-sound-config";
    }

    static get PARTS() {
        return { content: { template: "modules/daggerheart-critical/templates/crit-sound-config.hbs" } };
    }

    async _prepareContext(options) {
        // Get config-specific settings if configId is provided
        let configSettings = null;
        if (this.configId) {
            configSettings = CriticalSettingsManager.getConfigSettings(this.configId, "sound");
        }
        
        // Fallback to global settings if no config-specific settings
        if (!configSettings) {
            const settings = game.settings.get(MODULE_ID, "critSoundSettings");
            configSettings = settings.duality || {};
        }

        const config = foundry.utils.mergeObject({
            enabled: true,
            multiSound: false,
            soundPath: `modules/${MODULE_ID}/assets/sfx/pc-orchestral-win.mp3`
        }, configSettings);

        return { 
            config,
            configId: this.configId // Pass configId to template
        };
    }

    _onRender(context, options) {
        // Toggle sound path visibility
        this.element.querySelector("input[name='enabled']")?.addEventListener("change", (event) => {
            const group = this.element.querySelector(".sound-group");
            if (group) group.style.display = event.target.checked ? "" : "none";
        });

        // Toggle multi-sound mode
        this.element.querySelector("input[name='multiSound']")?.addEventListener("change", (event) => {
            const filePicker = this.element.querySelector("file-picker[name='soundPath']");
            const label = this.element.querySelector(".sound-group label");
            const hint = this.element.querySelector(".field-hint");
            
            if (filePicker) {
                filePicker.setAttribute("type", event.target.checked ? "folder" : "audio");
            }
            if (label) {
                label.innerHTML = event.target.checked ? "Folder Path" : "Sound Path";
            }
            if (hint) {
                hint.textContent = event.target.checked 
                    ? "Folder containing audio files. A random sound will be played."
                    : "Audio played when a critical occurs.";
            }
        });

        // Preview button
        this.element.querySelector(".crit-preview-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            
            // Read current sound values from the form
            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            const object = foundry.utils.expandObject(formData.object);
            object.enabled ??= false;
            object.multiSound ??= false;
            
            if (object.enabled && object.soundPath) {
                const soundPath = await CritSoundConfig.getSoundPath(object);
                if (soundPath) {
                    foundry.audio.AudioHelper.play({ 
                        src: soundPath, 
                        volume: 0.8, 
                        autoplay: true, 
                        loop: false 
                    }, true);
                } else {
                    ui.notifications.warn("No valid sound file found");
                }
            } else {
                ui.notifications.warn("Sound is disabled or no path specified");
            }
        });
    }

    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        object.enabled ??= false;
        object.multiSound ??= false;
        
        // Get configId from hidden field in form
        const configId = object._configId;
        delete object._configId; // Remove from saved data
        
        if (configId) {
            // Save to config-specific settings
            await CriticalSettingsManager.saveConfigSettings(configId, "sound", object);
            ui.notifications.info("Sound configuration saved for this entry");
            
            // Trigger refresh of main config modal if it's open
            const mainModal = Object.values(ui.windows).find(w => w.id === "daggerheart-critical-config-modal");
            if (mainModal) {
                mainModal.render();
            }
        } else {
            // Fallback to global settings
            const settings = game.settings.get(MODULE_ID, "critSoundSettings");
            settings.duality = object;
            await game.settings.set(MODULE_ID, "critSoundSettings", settings);
            ui.notifications.info("Global sound configuration saved");
        }
    }

    /**
     * Get sound path - either single file or random from folder
     * @param {Object} soundConfig - Sound configuration object
     * @returns {Promise<string|null>} - Path to sound file or null
     */
    static async getSoundPath(soundConfig) {
        if (!soundConfig || !soundConfig.soundPath) return null;

        // Single file mode
        if (!soundConfig.multiSound) {
            return soundConfig.soundPath;
        }

        // Multi-sound mode: get random file from folder
        try {
            let folderPath = soundConfig.soundPath.replace(/\/$/, ''); // Remove trailing slash
            const audioExtensions = ['.mp3', '.ogg', '.wav', '.webm', '.flac', '.m4a'];
            
            // Determine the source based on the path
            let source = "data";
            let target = folderPath;
            
            // If path starts with modules/, worlds/, or systems/, adjust accordingly
            if (folderPath.startsWith("modules/") || folderPath.startsWith("systems/") || folderPath.startsWith("worlds/")) {
                source = "data";
                target = folderPath;
            }
            
            // Use the new FilePicker API
            const FilePickerClass = foundry.applications?.apps?.FilePicker || FilePicker;
            const result = await FilePickerClass.browse(source, target);
            
            if (!result || !result.files || result.files.length === 0) {
                console.warn(`No files found in folder: ${folderPath}`);
                return null;
            }

            // Filter audio files
            const audioFiles = result.files.filter(file => {
                const ext = file.substring(file.lastIndexOf('.')).toLowerCase();
                return audioExtensions.includes(ext);
            });

            if (audioFiles.length === 0) {
                console.warn(`No audio files found in folder: ${folderPath}`);
                return null;
            }

            // Return random audio file
            const randomIndex = Math.floor(Math.random() * audioFiles.length);
            return audioFiles[randomIndex];
        } catch (error) {
            console.error("Error getting random sound from folder:", error);
            return null;
        }
    }
}
