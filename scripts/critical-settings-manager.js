import { CriticalConfiguration } from "./critical-data-model.js";

const MODULE_ID = "daggerheart-critical";
const SETTINGS_KEY = "criticalConfigurations";

// Static names for default entries
const DEFAULT_PC_NAME = "Default Player Character";
const DEFAULT_ADV_NAME = "Default Adversary";

/**
 * Settings Integration Manager
 * Manages critical configurations in Foundry VTT module settings
 */
export class CriticalSettingsManager {
    /**
     * Gets all critical configurations from settings
     * @returns {CriticalConfiguration[]}
     */
    static getConfigurations() {
        try {
            const data = game.settings.get(MODULE_ID, SETTINGS_KEY) || [];
            return data.map(d => CriticalConfiguration.fromJSON(d));
        } catch (error) {
            console.error("Failed to load configurations:", error);
            ui.notifications.error("Failed to load configurations");
            return [];
        }
    }

    /**
     * Saves configurations to module settings
     * @param {CriticalConfiguration[]} configs
     * @returns {Promise<void>}
     */
    static async saveConfigurations(configs) {
        try {
            const data = configs.map(c => c.toJSON());
            await game.settings.set(MODULE_ID, SETTINGS_KEY, data);
        } catch (error) {
            console.error("Failed to save configurations:", error);
            ui.notifications.error("Failed to save configuration");
            throw error;
        }
    }

    /**
     * Adds new configuration and saves
     * @param {CriticalConfiguration} config
     * @returns {Promise<void>}
     */
    static async addConfiguration(config) {
        const configs = this.getConfigurations();
        configs.push(config);
        await this.saveConfigurations(configs);
    }

    /**
     * Updates configuration and saves
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<void>}
     */
    static async updateConfiguration(id, updates) {
        const configs = this.getConfigurations();
        const index = configs.findIndex(c => c.id === id);
        
        if (index !== -1) {
            Object.assign(configs[index], updates);
            configs[index].updatedAt = Date.now();
            await this.saveConfigurations(configs);
        }
    }

    /**
     * Deletes configuration and saves
     * @param {string} id
     * @returns {Promise<void>}
     */
    static async deleteConfiguration(id) {
        const configs = this.getConfigurations();
        const filtered = configs.filter(c => c.id !== id);
        await this.saveConfigurations(filtered);
    }

    /**
     * Initializes default entries if they don't exist
     * @returns {Promise<void>}
     */
    static async initializeDefaults() {
        const configs = this.getConfigurations();
        
        const hasDefaultPC = configs.some(c => c.id === "default-player-character");
        const hasDefaultAdv = configs.some(c => c.id === "default-adversary");
        
        if (!hasDefaultPC) {
            const defaultPC = new CriticalConfiguration({
                id: "default-player-character",
                name: DEFAULT_PC_NAME,
                type: "Player Character",
                target: "Action and Reaction",
                userId: "all",
                isDefault: true
            });
            configs.unshift(defaultPC);
            
            // Migrate global PC settings to default entry
            await this.migrateGlobalSettingsToDefault("default-player-character", "pc");
        }
        
        if (!hasDefaultAdv) {
            const defaultAdv = new CriticalConfiguration({
                id: "default-adversary",
                name: DEFAULT_ADV_NAME,
                type: "Adversary",
                target: "Action and Reaction",
                adversaryId: "all",
                isDefault: true
            });
            // Insert after default PC
            const pcIndex = configs.findIndex(c => c.id === "default-player-character");
            configs.splice(pcIndex + 1, 0, defaultAdv);
            
            // Migrate global adversary settings to default entry
            await this.migrateGlobalSettingsToDefault("default-adversary", "adversary");
        }
        
        if (!hasDefaultPC || !hasDefaultAdv) {
            await this.saveConfigurations(configs);
        }
    }
    
    /**
     * Gets the static name for a default entry
     * @param {string} id - The default entry ID
     * @returns {string}
     */
    static getDefaultName(id) {
        if (id === "default-player-character") return DEFAULT_PC_NAME;
        if (id === "default-adversary") return DEFAULT_ADV_NAME;
        return null;
    }

    /**
     * Migrates global settings to a default entry
     * @param {string} configId - The default entry ID
     * @param {string} globalKey - The key in global settings (pc or adversary)
     * @returns {Promise<void>}
     */
    static async migrateGlobalSettingsToDefault(configId, globalKey) {
        const allSettings = game.settings.get(MODULE_ID, "critConfigSettings");
        
        // Skip if already migrated
        if (allSettings[configId]) {
            return;
        }
        
        // Get global settings
        const textSettings = game.settings.get(MODULE_ID, "critTextSettings");
        const fxSettings = game.settings.get(MODULE_ID, "critFXSettings");
        const soundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
        const artSettings = game.settings.get(MODULE_ID, "critArtSettings");
        
        // Determine sound key (duality for pc, adversary for adversary)
        const soundKey = globalKey === "pc" ? "duality" : "adversary";
        
        // Copy global settings to default entry
        allSettings[configId] = {
            text: textSettings[globalKey] || null,
            fx: fxSettings[globalKey] || null,
            sound: soundSettings[soundKey] || null,
            art: artSettings[globalKey] || null
        };
        
        await game.settings.set(MODULE_ID, "critConfigSettings", allSettings);
    }

    /**
     * Registers the settings key with Foundry
     */
    static registerSettings() {
        game.settings.register(MODULE_ID, SETTINGS_KEY, {
            scope: "world",
            config: false,
            type: Array,
            default: []
        });

        // Register per-configuration settings storage
        game.settings.register(MODULE_ID, "critConfigSettings", {
            scope: "world",
            config: false,
            type: Object,
            default: {}
        });
    }

    /**
     * Gets settings for a specific configuration
     * @param {string} configId
     * @param {string} settingType - "text", "fx", "sound", or "art"
     * @returns {Object}
     */
    static getConfigSettings(configId, settingType) {
        const allSettings = game.settings.get(MODULE_ID, "critConfigSettings");
        return allSettings[configId]?.[settingType] || null;
    }

    /**
     * Saves settings for a specific configuration
     * @param {string} configId
     * @param {string} settingType - "text", "fx", "sound", or "art"
     * @param {Object} settings
     * @returns {Promise<void>}
     */
    static async saveConfigSettings(configId, settingType, settings) {
        const allSettings = game.settings.get(MODULE_ID, "critConfigSettings");
        
        if (!allSettings[configId]) {
            allSettings[configId] = {};
        }
        
        allSettings[configId][settingType] = settings;
        
        await game.settings.set(MODULE_ID, "critConfigSettings", allSettings);
    }
}
