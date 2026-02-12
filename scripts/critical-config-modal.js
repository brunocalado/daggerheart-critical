import { CriticalSettingsManager } from "./critical-settings-manager.js";
import { CriticalConfiguration } from "./critical-data-model.js";
import { ConfigurationValidator } from "./critical-validator.js";
import { CritTextConfig } from "./crit-text-config.js";
import { CritConfig } from "./crit-config.js";
import { CritSoundConfig } from "./crit-sound-config.js";
import { CritArtConfig } from "./crit-art-config.js";
import { CritOverlay } from "./crit-overlay.js";
import { CritFX } from "./crit-fx.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "daggerheart-critical";

/**
 * Critical Configuration Modal
 * Centralized interface for managing critical configurations
 */
export class CriticalConfigurationModal extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-critical-config-modal",
        tag: "form",
        window: { title: "Configure Criticals" },
        position: { width: 1000, height: "auto" },
        form: { 
            handler: CriticalConfigurationModal.formHandler, 
            closeOnSubmit: true,
            submitOnChange: false
        }
    };

    static get PARTS() {
        return {
            content: {
                template: "modules/daggerheart-critical/templates/critical-config-modal.hbs"
            }
        };
    }

    async _prepareContext(options) {
        const configurations = CriticalSettingsManager.getConfigurations();
        
        // Get non-GM users for dropdowns
        const nonGMUsers = game.users.filter(u => !u.isGM).map(u => ({
            id: u.id,
            name: u.name,
            color: u.color?.toString() || "#ffffff"
        }));

        // Resolve adversary names from UUIDs
        const configsWithNames = await Promise.all(configurations.map(async (c) => {
            const configData = c.toJSON();
            
            // If it's an adversary type with an adversaryId, resolve the name
            if (configData.type === "Adversary" && configData.adversaryId && configData.adversaryId !== "all") {
                try {
                    const actor = await fromUuid(configData.adversaryId);
                    if (actor) {
                        configData.adversaryName = actor.name;
                    }
                } catch (error) {
                    console.warn("Failed to resolve adversary:", configData.adversaryId, error);
                }
            }
            
            return configData;
        }));

        return {
            configurations: configsWithNames,
            nonGMUsers
        };
    }

    _onRender(context, options) {
        // Set selected users based on saved userId values (default to "all" if not set)
        // This must run BEFORE restoring pending form state to avoid overwriting user selections
        this.element.querySelectorAll("select[name$='.userId'][data-current-user]").forEach(select => {
            const currentUserId = select.dataset.currentUser;
            select.value = currentUserId || "all";
        });

        // Restore pending form state if it exists (from addEntry or other operations)
        // This runs AFTER the default userId setting so it can override with user selections
        if (this._pendingFormState) {
            this._restoreFormState(this._pendingFormState);
            this._pendingFormState = null;
        }

        // Restore scroll position if it was saved
        if (this._savedScrollPosition !== undefined) {
            const scrollableElement = this.element.querySelector('.window-content') || this.element;
            scrollableElement.scrollTop = this._savedScrollPosition;
            this._savedScrollPosition = undefined;
        }

        // Add entry button
        this.element.querySelector(".add-entry-btn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            await this.addEntry();
        });

        // Delete entry buttons
        this.element.querySelectorAll(".delete-entry-btn").forEach(btn => {
            btn.addEventListener("click", async (event) => {
                event.preventDefault();
                const entryId = event.currentTarget.dataset.id;
                await this.deleteEntry(entryId);
            });
        });

        // Type change handlers - re-render to show/hide user/adversary fields and update trigger type options
        this.element.querySelectorAll("select[name$='.type']").forEach(select => {
            select.addEventListener("change", async (event) => {
                const configId = event.target.name.match(/config_(.+)\.type/)[1];
                const newType = event.target.value;
                
                // Save scroll position before re-rendering
                this._saveScrollPosition();
                
                // Capture current form state before re-rendering (for ALL entries)
                const formState = this._captureFormState();
                
                // Update the configuration in memory before re-rendering
                const configs = CriticalSettingsManager.getConfigurations();
                
                // Apply form state to ALL configs to preserve user selections
                configs.forEach(cfg => {
                    if (formState[cfg.id]) {
                        // Preserve userId if it exists in form state
                        if (formState[cfg.id].userId !== undefined) {
                            cfg.userId = formState[cfg.id].userId;
                        }
                        // Preserve triggerType if it exists in form state
                        if (formState[cfg.id].triggerType !== undefined) {
                            cfg.triggerType = formState[cfg.id].triggerType;
                        }
                    }
                });
                
                // Now update the specific config that changed type
                const config = configs.find(c => c.id === configId);
                if (config) {
                    config.type = newType;
                    // Clear the opposite field when switching types
                    if (newType === "Player Character") {
                        config.adversaryId = "";
                        config.userId = config.userId || "all";
                        // Reset trigger type if it was Fumble
                        if (config.triggerType === "Fumble") {
                            config.triggerType = "Action and Reaction";
                        }
                    } else {
                        config.userId = "";
                        config.adversaryId = config.adversaryId || "";
                    }
                }
                
                await CriticalSettingsManager.saveConfigurations(configs);
                this.render();
            });
        });

        // Action buttons (Text, FX, Sound, Art, Preview)
        this.element.querySelectorAll(".action-btn").forEach(btn => {
            btn.addEventListener("click", async (event) => {
                event.preventDefault();
                const action = event.currentTarget.dataset.action;
                const entryId = event.currentTarget.dataset.id;
                await this.handleActionButton(action, entryId);
            });
        });

        // Drag-and-drop for adversary fields
        this.element.querySelectorAll(".adversary-drop-zone").forEach(zone => {
            zone.addEventListener("dragover", (event) => {
                event.preventDefault();
                zone.classList.add("drag-over");
            });

            zone.addEventListener("dragleave", (event) => {
                zone.classList.remove("drag-over");
            });

            zone.addEventListener("drop", async (event) => {
                event.preventDefault();
                zone.classList.remove("drag-over");
                
                try {
                    const data = JSON.parse(event.dataTransfer.getData("text/plain"));
                    if (data.type === "Actor") {
                        // Get the actor to validate it's an adversary
                        const actor = await fromUuid(data.uuid);
                        if (!actor) {
                            ui.notifications.warn("Actor not found");
                            return;
                        }
                        
                        if (actor.type !== "adversary") {
                            ui.notifications.warn("Only adversary actors can be assigned here");
                            return;
                        }
                        
                        const configId = zone.dataset.configId;
                        
                        // Update the configuration in memory before re-rendering
                        const configs = CriticalSettingsManager.getConfigurations();
                        const config = configs.find(c => c.id === configId);
                        if (config) {
                            config.adversaryId = data.uuid;
                            await CriticalSettingsManager.saveConfigurations(configs);
                            this.render();
                        }
                    }
                } catch (error) {
                    console.error("Error handling drop:", error);
                    ui.notifications.error("Failed to assign adversary");
                }
            });
        });

        // Clear adversary buttons
        this.element.querySelectorAll(".clear-adversary-btn").forEach(btn => {
            btn.addEventListener("click", async (event) => {
                event.preventDefault();
                const configId = event.currentTarget.dataset.id;
                
                // Update the configuration in memory before re-rendering
                const configs = CriticalSettingsManager.getConfigurations();
                const config = configs.find(c => c.id === configId);
                if (config) {
                    config.adversaryId = "";
                    await CriticalSettingsManager.saveConfigurations(configs);
                    this.render();
                }
            });
        });
    }

    /**
     * Saves the current scroll position before re-rendering
     */
    _saveScrollPosition() {
        const scrollableElement = this.element?.querySelector('.window-content') || this.element;
        if (scrollableElement) {
            this._savedScrollPosition = scrollableElement.scrollTop;
        }
    }

    /**
     * Captures current form state from unsaved entries
     * @returns {Object} State object keyed by config ID
     */
    _captureFormState() {
        const state = {};
        
        // Only capture state from non-default entries (they can be edited)
        this.element.querySelectorAll(".config-entry:not(.default-entry)").forEach(entry => {
            const configId = entry.dataset.id;
            if (!configId) return;
            
            state[configId] = {};
            
            // Capture type dropdown
            const typeSelect = entry.querySelector(`select[name="config_${configId}.type"]`);
            if (typeSelect) {
                state[configId].type = typeSelect.value;
            }
            
            // Capture userId dropdown (for Player Character type)
            const userSelect = entry.querySelector(`select[name="config_${configId}.userId"]`);
            if (userSelect) {
                state[configId].userId = userSelect.value;
            }
            
            // Capture triggerType dropdown
            const triggerSelect = entry.querySelector(`select[name="config_${configId}.triggerType"]`);
            if (triggerSelect) {
                state[configId].triggerType = triggerSelect.value;
            }
            
            // Note: adversaryId is handled via drag-and-drop and saved immediately,
            // so we don't need to capture it here
        });
        
        return state;
    }

    /**
     * Restores form state after re-render
     * @param {Object} state - State object from _captureFormState()
     */
    _restoreFormState(state) {
        if (!state) return;
        
        for (const [configId, values] of Object.entries(state)) {
            const entry = this.element.querySelector(`.config-entry[data-id="${configId}"]`);
            if (!entry) continue; // Entry may have been deleted
            
            // Restore type dropdown
            if (values.type) {
                const typeSelect = entry.querySelector(`select[name="config_${configId}.type"]`);
                if (typeSelect) {
                    typeSelect.value = values.type;
                }
            }
            
            // Restore userId dropdown
            if (values.userId) {
                const userSelect = entry.querySelector(`select[name="config_${configId}.userId"]`);
                if (userSelect) {
                    userSelect.value = values.userId;
                }
            }
            
            // Restore triggerType dropdown
            if (values.triggerType) {
                const triggerSelect = entry.querySelector(`select[name="config_${configId}.triggerType"]`);
                if (triggerSelect) {
                    triggerSelect.value = values.triggerType;
                }
            }
        }
    }

    /**
     * Adds new entry
     */
    async addEntry() {
        // Save scroll position before re-rendering
        this._saveScrollPosition();
        
        // Capture current form state before re-rendering
        this._pendingFormState = this._captureFormState();
        
        const newConfig = new CriticalConfiguration();
        await CriticalSettingsManager.addConfiguration(newConfig);
        this.render();
    }

    /**
     * Deletes entry (prevents deletion of defaults)
     * @param {string} entryId
     */
    async deleteEntry(entryId) {
        if (entryId === "default-player-character" || entryId === "default-adversary") {
            ui.notifications.warn("Cannot delete default configuration entries");
            return;
        }
        
        await CriticalSettingsManager.deleteConfiguration(entryId);
        this.render();
    }

    /**
     * Handles action button clicks
     * @param {string} action - text, fx, sound, art, preview
     * @param {string} entryId
     */
    async handleActionButton(action, entryId) {
        const configs = CriticalSettingsManager.getConfigurations();
        const config = configs.find(c => c.id === entryId);
        
        if (!config) {
            ui.notifications.error("Configuration not found");
            return;
        }

        switch (action) {
            case "text":
                new CritTextConfig({ configId: entryId }).render(true);
                break;
            case "fx":
                new CritConfig({ configId: entryId }).render(true);
                break;
            case "sound":
                new CritSoundConfig({ configId: entryId }).render(true);
                break;
            case "art":
                new CritArtConfig({ configId: entryId }).render(true);
                break;
            case "preview":
                await this.previewConfiguration(config);
                break;
        }
    }

    /**
     * Previews a configuration
     * @param {CriticalConfiguration} config
     */
    async previewConfiguration(config) {
        const MODULE_ID = "daggerheart-critical";
        
        // Determine type based on configuration
        const type = config.type === "Player Character" ? "duality" : "adversary";
        const userColor = game.user.color?.toString() || "#ffffff";

        // Get config-specific settings
        const configSettings = game.settings.get(MODULE_ID, "critConfigSettings");
        const entrySettings = configSettings[config.id] || {};

        // Fallback to global settings if no config-specific settings
        const configKey = type === "duality" ? "pc" : "adversary";
        const globalTextSettings = game.settings.get(MODULE_ID, "critTextSettings");
        const globalFxSettings = game.settings.get(MODULE_ID, "critFXSettings");
        const globalSoundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
        const globalArtSettings = game.settings.get(MODULE_ID, "critArtSettings");

        const textConfig = entrySettings.text || globalTextSettings[configKey] || null;
        const fxConfig = entrySettings.fx || globalFxSettings[configKey];
        const soundConfig = entrySettings.sound || globalSoundSettings[type === "adversary" ? "adversary" : "duality"];
        const artConfig = entrySettings.art || globalArtSettings[configKey] || null;

        // Trigger overlay
        new CritOverlay({
            type,
            userColor,
            configOverride: textConfig,
            artOverride: artConfig
        }).render(true);

        // Trigger FX
        if (fxConfig && fxConfig.type !== "none") {
            const fx = new CritFX();
            switch (fxConfig.type) {
                case "shake": fx.ScreenShake(fxConfig.options || {}); break;
                case "shatter": fx.GlassShatter(fxConfig.options || {}); break;
                case "border": fx.ScreenBorder(fxConfig.options || {}); break;
                case "pulsate": fx.Pulsate(fxConfig.options || {}); break;
                case "confetti": fx.Confetti(fxConfig.options || {}); break;
            }
        }

        // Play sound
        if (soundConfig && soundConfig.enabled && soundConfig.soundPath) {
            const soundPath = await CritSoundConfig.getSoundPath(soundConfig);
            if (soundPath) {
                const volume = (soundConfig.volume ?? 90) / 100;
                foundry.audio.AudioHelper.play({ 
                    src: soundPath, 
                    volume: volume, 
                    autoplay: true, 
                    loop: false 
                }, true);
            }
        }
    }

    /**
     * Form submission handler
     */
    static async formHandler(event, form, formData) {
        const object = foundry.utils.expandObject(formData.object);
        const configurations = [];

        // Parse form data into configurations
        for (const [key, value] of Object.entries(object)) {
            if (key.startsWith("config_")) {
                // Convert string booleans to actual booleans
                if (typeof value.isDefault === "string") {
                    value.isDefault = value.isDefault === "true";
                }
                
                const config = new CriticalConfiguration(value);
                
                // Force static names for default entries
                if (config.isDefault) {
                    const staticName = CriticalSettingsManager.getDefaultName(config.id);
                    if (staticName) {
                        config.name = staticName;
                    }
                }
                
                // Validate (skip validation for defaults)
                if (!config.isDefault) {
                    const errors = ConfigurationValidator.validateConfiguration(config);
                    if (errors.length > 0) {
                        ui.notifications.error(`Validation failed for ${config.name}: ${errors.join(", ")}`);
                        throw new Error(`Validation failed for ${config.name}`);
                    }
                }
                
                configurations.push(config);
            }
        }

        await CriticalSettingsManager.saveConfigurations(configurations);
        ui.notifications.info("Critical configurations saved successfully");
    }
}
