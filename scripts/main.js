import { CritOverlay } from "./crit-overlay.js";
import { CritConfig } from "./crit-config.js";
import { CritTextConfig } from "./crit-text-config.js";
import { CritSoundConfig } from "./crit-sound-config.js";
import { CritArtConfig } from "./crit-art-config.js";
import { CritFX } from "./crit-fx.js";
import { CriticalConfigurationModal } from "./critical-config-modal.js";
import { CriticalSettingsManager } from "./critical-settings-manager.js";

const MODULE_ID = "daggerheart-critical";

/** Pending criticals waiting for Dice So Nice animation to finish */
const pendingCriticals = new Map();

function logDebug(...args) {
    if (game.settings.get(MODULE_ID, 'debugmode')) {
        console.log("DH-CRIT DEBUG |", ...args);
    }
}

function isDSNActive() {
    return game.modules.get("dice-so-nice")?.active;
}

Hooks.once("init", () => {

    // Register Handlebars helpers
    Handlebars.registerHelper("eq", function(a, b) {
        return a === b;
    });

    // Register critical configurations settings
    CriticalSettingsManager.registerSettings();

    // --- Configure Criticals Menu ---
    game.settings.registerMenu(MODULE_ID, "critConfigModal", {
        name: "Configure Criticals",
        label: "Configure Criticals",
        hint: "Centralized interface to manage all critical configurations for players and adversaries.",
        icon: "fas fa-cog",
        type: CriticalConfigurationModal,
        restricted: true
    });

    game.settings.register(MODULE_ID, "critSoundSettings", {
        scope: "world",
        config: false,
        type: Object,
        default: {
            duality: {
                enabled: true,
                soundPath: `modules/${MODULE_ID}/assets/sfx/pc-orchestral-win.mp3`
            },
            adversary: {
                enabled: true,
                soundPath: `modules/${MODULE_ID}/assets/sfx/adv-critical-tension-impact.mp3`
            }
        }
    });

    game.settings.register(MODULE_ID, "debugmode", {
        name: "Enable Debug Mode",
        hint: "Prints debug info to console (F12).",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
    


    game.settings.register(MODULE_ID, "critFXSettings", {
        scope: "world",
        config: false,
        type: Object,
        default: {
            pc: { type: "none", options: {} },
            adversary: { type: "none", options: {} }
        }
    });



    game.settings.register(MODULE_ID, "critArtSettings", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "critUserOverrides", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });



    game.settings.register(MODULE_ID, "critTextSettings", {
        scope: "world",
        config: false,
        type: Object,
        default: {
            pc: {
                content: "CRITICAL!",
                fontFamily: "Bangers",
                fontSize: "normal",
                letterSpacing: "normal",
                color: "#ffcc00",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false,
                useImage: false,
                imagePath: `modules/${MODULE_ID}/assets/critical-img-demo/molten_voltage.webp`,
                imageSize: "normal"
            },
            adversary: {
                content: "CRITICAL!",
                fontFamily: "Bangers",
                fontSize: "normal",
                letterSpacing: "normal",
                color: "#ff0000",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false,
                useImage: false,
                imagePath: `modules/${MODULE_ID}/assets/critical-img-demo/molten_voltage.webp`,
                imageSize: "normal"
            }
        }
    });
});

Hooks.once("ready", async () => {
    // Initialize default critical configurations
    await CriticalSettingsManager.initializeDefaults();
});

Hooks.on("createChatMessage", (message) => {
    if (game.system.id !== "daggerheart") return;

    const dhRoll = message.system?.roll;
    if (!dhRoll) return;

    if (dhRoll.isCritical === true) {
        logDebug("Critical confirmed!");
        const type = detectCritType(message, dhRoll);

        if (isDSNActive()) {
            logDebug("Dice So Nice active — deferring effect for message", message.id);
            pendingCriticals.set(message.id, type);
        } else {
            triggerCriticalEffect(message, type);
        }
    }
});

Hooks.on("diceSoNiceRollComplete", (messageId) => {
    if (!pendingCriticals.has(messageId)) return;

    const type = pendingCriticals.get(messageId);
    pendingCriticals.delete(messageId);

    // Re-validate: retrieve the message and confirm it's still a critical
    const message = game.messages.get(messageId);
    if (!message) {
        logDebug("DSN complete — message not found:", messageId);
        return;
    }

    const dhRoll = message.system?.roll;
    if (!dhRoll?.isCritical) {
        logDebug("DSN complete — re-validation failed, not a critical:", messageId);
        return;
    }

    logDebug("DSN complete — triggering critical effect for message", messageId);
    triggerCriticalEffect(message, type);
});

function detectCritType(message, rollData) {
    const dice = rollData.dice || [];
    const hasD12 = dice.some(d => d.faces === 12 || (d.formula && d.formula.includes("d12")));
    const hasD20 = dice.some(d => d.faces === 20 || (d.formula && d.formula.includes("d20")));

    if (hasD20) return "adversary";
    if (hasD12) return "duality";
    
    // Fallback by user if the die is not clear
    return message.author.isGM ? "adversary" : "duality";
}

function triggerCriticalEffect(message, type) {
    const userColor = message.author?.color?.toString() || "#ffffff";
    const authorId = message.author?.id;
    const rollType = message.system?.roll?.type; // "action" or "reaction"
    const actorUuid = message.speaker?.actor;

    logDebug("=== Triggering Critical Effect ===");
    logDebug("Type:", type, "| Author ID:", authorId, "| Roll Type:", rollType);

    // Get all configurations
    const configurations = CriticalSettingsManager.getConfigurations();

    // Find matching configuration
    let matchedConfig = null;
    
    if (type === "duality") {
        // Player Character: match by userId AND rollType
        // Filter configurations that match the user (specific user or "all")
        // Exclude default if there are custom configs
        const userConfigs = configurations.filter(c => 
            c.type === "Player Character" && 
            (c.userId === authorId || c.userId === "all")
        );
        
        logDebug("Found user configs:", userConfigs.map(c => ({ id: c.id, name: c.name, userId: c.userId, target: c.target, isDefault: c.isDefault })));
        
        // Prioritize specific user match over "all"
        // First try to find specific user match (non-default)
        matchedConfig = userConfigs.find(c => 
            c.userId === authorId && 
            !c.isDefault &&
            c.getRollTypes().includes(rollType)
        );
        
        logDebug("Specific user match:", matchedConfig ? matchedConfig.name : "none");
        
        // If no specific match, try "all" (non-default)
        if (!matchedConfig) {
            matchedConfig = userConfigs.find(c => 
                c.userId === "all" && 
                !c.isDefault &&
                c.getRollTypes().includes(rollType)
            );
            logDebug("All user match:", matchedConfig ? matchedConfig.name : "none");
        }
        
        // Fallback to default Player Character if it matches the rollType
        if (!matchedConfig) {
            matchedConfig = configurations.find(c => 
                c.id === "default-player-character" &&
                c.getRollTypes().includes(rollType)
            );
            logDebug("Default match:", matchedConfig ? matchedConfig.name : "none");
        }
    } else if (type === "adversary") {
        // Adversary: match by adversaryId (actor UUID) AND rollType
        // Priority: specific adversary > all adversaries > default
        
        logDebug("Actor UUID from speaker:", actorUuid);
        
        // First, try to find a specific adversary match (non-default)
        if (actorUuid) {
            // Log all adversary configurations for debugging
            const adversaryConfigs = configurations.filter(c => c.type === "Adversary");
            logDebug("All adversary configs:", adversaryConfigs.map(c => ({ 
                id: c.id, 
                name: c.name, 
                adversaryId: c.adversaryId,
                isDefault: c.isDefault,
                target: c.target
            })));
            
            matchedConfig = configurations.find(c => 
                c.type === "Adversary" && 
                c.adversaryId === actorUuid &&
                !c.isDefault &&
                c.getRollTypes().includes(rollType)
            );
            logDebug("Specific adversary match:", matchedConfig ? matchedConfig.name : "none");
            
            // If no match, check if it's a UUID format issue
            if (!matchedConfig) {
                logDebug("Checking for UUID format issues...");
                matchedConfig = configurations.find(c => {
                    if (c.type !== "Adversary" || c.isDefault || !c.adversaryId) return false;
                    const matches = c.adversaryId === actorUuid || 
                                  c.adversaryId.includes(actorUuid) || 
                                  actorUuid.includes(c.adversaryId);
                    if (matches) {
                        logDebug("Found match with UUID comparison:", c.adversaryId, "vs", actorUuid);
                    }
                    return matches && c.getRollTypes().includes(rollType);
                });
            }
        }
        
        // If no specific match, try "all adversaries" (empty adversaryId, non-default)
        if (!matchedConfig) {
            matchedConfig = configurations.find(c => 
                c.type === "Adversary" && 
                (!c.adversaryId || c.adversaryId === "") &&
                !c.isDefault &&
                c.getRollTypes().includes(rollType)
            );
            logDebug("All adversaries match:", matchedConfig ? matchedConfig.name : "none");
        }
        
        // Fallback to default Adversary if it matches the rollType
        if (!matchedConfig) {
            matchedConfig = configurations.find(c => 
                c.id === "default-adversary" &&
                c.getRollTypes().includes(rollType)
            );
            logDebug("Default adversary match:", matchedConfig ? matchedConfig.name : "none");
        }
    }

    // If no matching configuration found, skip effect
    if (!matchedConfig) {
        logDebug("No matching configuration found for type:", type, "rollType:", rollType);
        return;
    }

    logDebug("Using configuration:", matchedConfig.name, "for type:", type);

    // Get settings for the matched configuration
    const configSettings = game.settings.get(MODULE_ID, "critConfigSettings");
    const entrySettings = configSettings[matchedConfig.id] || {};

    // Fallback to global settings if no config-specific settings
    const configKey = (type === "duality") ? "pc" : "adversary";
    const globalTextSettings = game.settings.get(MODULE_ID, "critTextSettings");
    const globalFxSettings = game.settings.get(MODULE_ID, "critFXSettings");
    const globalSoundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
    const globalArtSettings = game.settings.get(MODULE_ID, "critArtSettings");

    const textConfig = entrySettings.text || globalTextSettings[configKey] || null;
    const fxConfig = entrySettings.fx || globalFxSettings[configKey];
    const soundConfig = entrySettings.sound || globalSoundSettings[type === "adversary" ? "adversary" : "duality"];
    const artConfig = entrySettings.art || globalArtSettings[configKey] || null;

    // Renders the visual
    new CritOverlay({
        type,
        userColor,
        authorId,
        configOverride: textConfig,
        artOverride: artConfig
    }).render(true);

    // Triggers configured Visual FX
    if (fxConfig && fxConfig.type !== "none") {
        const fx = new CritFX();
        switch (fxConfig.type) {
            case "shake": fx.ScreenShake(fxConfig.options); break;
            case "shatter": fx.GlassShatter(fxConfig.options); break;
            case "border": fx.ScreenBorder(fxConfig.options); break;
            case "pulsate": fx.Pulsate(fxConfig.options); break;
            case "confetti": fx.Confetti(fxConfig.options); break;
        }
    }

    // Play sound
    if (soundConfig && soundConfig.enabled && soundConfig.soundPath) {
        foundry.audio.AudioHelper.play({ 
            src: soundConfig.soundPath, 
            volume: 0.8, 
            autoplay: true, 
            loop: false 
        }, false);
    }
}