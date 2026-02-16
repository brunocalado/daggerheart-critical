import { CritOverlay } from "./crit-overlay.js";
import { CritSoundConfig } from "./crit-sound-config.js";
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

    Handlebars.registerHelper("ne", function(a, b) {
        return a !== b;
    });

    // Pre-load overlay template to avoid async fetch on first render
    foundry.applications.handlebars.loadTemplates(["modules/daggerheart-critical/templates/crit-splash.hbs"]);

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
                fontSize: "large",
                letterSpacing: "wide",
                color: "#ffcc00",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false,
                useImage: false,
                imagePath: `modules/${MODULE_ID}/assets/critical-img-demo/arcane_strike.webp`,
                imageSize: "large"
            },
            adversary: {
                content: "CRITICAL!",
                fontFamily: "Bangers",
                fontSize: "large",
                letterSpacing: "wide",
                color: "#ff0000",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false,
                useImage: false,
                imagePath: `modules/${MODULE_ID}/assets/critical-img-demo/arcane_strike.webp`,
                imageSize: "large"
            }
        }
    });
});

Hooks.once("ready", async () => {
    // Initialize default critical configurations
    await CriticalSettingsManager.initializeDefaults();
    
    // Initialize level up monitoring
    initializeLevelUpMonitoring();

    // Initialize Tag Team Open monitoring
    initializeTagTeamMonitoring();
});

Hooks.on("createChatMessage", (message) => {
    if (game.system.id !== "daggerheart") return;

    // Debug: Log all system messages
    if (message.system && game.settings.get(MODULE_ID, 'debugmode')) {
        console.log("==========");
        console.log("DH-CRIT DEBUG | Chat Message Object:", message);
        console.log("DH-CRIT DEBUG | Key Fields:");
        console.log("  - isCritical:", message.system?.roll?.isCritical);
        console.log("  - type:", message.type);
        console.log("  - system.roll.type:", message.system?.roll?.type);
        console.log("  - system.roll.dice[0].total:", message.system?.roll?.dice?.[0]?.total);
        console.log("  - author.isGM:", message.author?.isGM);
        console.log("  - speaker.actor:", message.speaker?.actor);
        console.log("==========");
    }

    const dhRoll = message.system?.roll;
    if (!dhRoll) return;

    // Detect critical hits
    if (dhRoll.isCritical === true) {
        logDebug("Critical confirmed!");
        const type = detectCritType(message, dhRoll);

        if (isDSNActive()) {
            logDebug("Dice So Nice active — deferring effect for message", message.id);
            pendingCriticals.set(message.id, { type, triggerType: dhRoll.type });
        } else {
            triggerCriticalEffect(message, type, dhRoll.type);
        }
    }
    
    // Detect fumbles (adversary rolls 1 on d20)
    if (message.type === "adversaryRoll" && dhRoll.isCritical === false) {
        const diceTotal = dhRoll.dice?.[0]?.total;
        if (diceTotal === 1) {
            logDebug("Fumble detected!");
            
            if (isDSNActive()) {
                logDebug("Dice So Nice active — deferring fumble effect for message", message.id);
                pendingCriticals.set(message.id, { type: "adversary", triggerType: "fumble" });
            } else {
                triggerCriticalEffect(message, "adversary", "fumble");
            }
        }
    }

});

Hooks.on("diceSoNiceRollComplete", (messageId) => {
    if (!pendingCriticals.has(messageId)) return;

    const pending = pendingCriticals.get(messageId);
    pendingCriticals.delete(messageId);

    // Re-validate: retrieve the message
    const message = game.messages.get(messageId);
    if (!message) {
        logDebug("DSN complete — message not found:", messageId);
        return;
    }

    const dhRoll = message.system?.roll;
    if (!dhRoll) {
        logDebug("DSN complete — no roll data:", messageId);
        return;
    }

    // Re-validate based on trigger type
    if (pending.triggerType === "fumble") {
        // Fumble validation
        if (message.type === "adversaryRoll" && dhRoll.dice?.[0]?.total === 1) {
            logDebug("DSN complete — triggering fumble effect for message", messageId);
            triggerCriticalEffect(message, pending.type, "fumble");
        }
    } else {
        // Critical validation
        if (dhRoll.isCritical) {
            logDebug("DSN complete — triggering critical effect for message", messageId);
            triggerCriticalEffect(message, pending.type, pending.triggerType);
        }
    }
});

function detectCritType(message, rollData) {
    const rollType = message.type;
    
    if (rollType === "adversaryRoll") return "adversary";
    if (rollType === "dualityRoll") return "duality";
    
    // Fallback (should not happen in normal gameplay)
    return "duality";
}

async function triggerCriticalEffect(message, type, triggerType) {
    const userColor = message.author?.color?.toString() || "#ffffff";
    const authorId = message.author?.id;
    const actorUuid = message.speaker?.actor;

    logDebug("=== Triggering Critical Effect ===");
    logDebug("Type:", type, "| Author ID:", authorId, "| Trigger Type:", triggerType);

    // Get all configurations
    const configurations = CriticalSettingsManager.getConfigurations();

    // Find matching configuration
    let matchedConfig = null;
    
    if (type === "duality") {
        // Player Character: match by userId AND triggerType
        const userConfigs = configurations.filter(c => 
            c.type === "Player Character" && 
            (c.userId === authorId || c.userId === "all")
        );
        
        logDebug("Found user configs:", userConfigs.map(c => ({ id: c.id, name: c.name, userId: c.userId, triggerType: c.triggerType, isDefault: c.isDefault })));
        
        // Prioritize specific user match over "all"
        matchedConfig = userConfigs.find(c => 
            c.userId === authorId && 
            !c.isDefault &&
            c.getRollTypes().includes(triggerType)
        );
        
        logDebug("Specific user match:", matchedConfig ? matchedConfig.name : "none");
        
        // If no specific match, try "all" (non-default)
        if (!matchedConfig) {
            matchedConfig = userConfigs.find(c => 
                c.userId === "all" && 
                !c.isDefault &&
                c.getRollTypes().includes(triggerType)
            );
            logDebug("All user match:", matchedConfig ? matchedConfig.name : "none");
        }
        
        // Fallback to default Player Character if it matches the triggerType
        if (!matchedConfig) {
            matchedConfig = configurations.find(c => 
                c.id === "default-player-character" &&
                c.getRollTypes().includes(triggerType)
            );
            logDebug("Default match:", matchedConfig ? matchedConfig.name : "none");
        }
    } else if (type === "adversary") {
        // Adversary: match by adversaryId (actor UUID) AND triggerType
        // Priority: specific adversary > all adversaries > default
        
        logDebug("Actor UUID from speaker:", actorUuid);
        
        // First, try to find a specific adversary match (non-default)
        if (actorUuid) {
            const adversaryConfigs = configurations.filter(c => c.type === "Adversary");
            logDebug("All adversary configs:", adversaryConfigs.map(c => ({ 
                id: c.id, 
                name: c.name, 
                adversaryId: c.adversaryId,
                isDefault: c.isDefault,
                triggerType: c.triggerType
            })));
            
            matchedConfig = configurations.find(c => 
                c.type === "Adversary" && 
                c.adversaryId === actorUuid &&
                !c.isDefault &&
                c.getRollTypes().includes(triggerType)
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
                    return matches && c.getRollTypes().includes(triggerType);
                });
            }
        }
        
        // If no specific match, try "all adversaries" (adversaryId "all" or empty, non-default)
        if (!matchedConfig) {
            matchedConfig = configurations.find(c => 
                c.type === "Adversary" && 
                (!c.adversaryId || c.adversaryId === "" || c.adversaryId === "all") &&
                !c.isDefault &&
                c.getRollTypes().includes(triggerType)
            );
            logDebug("All adversaries match:", matchedConfig ? matchedConfig.name : "none");
        }
        
        // Fallback to default Adversary if it matches the triggerType
        if (!matchedConfig) {
            matchedConfig = configurations.find(c => 
                c.id === "default-adversary" &&
                c.getRollTypes().includes(triggerType)
            );
            logDebug("Default adversary match:", matchedConfig ? matchedConfig.name : "none");
        }
    }

    // If no matching configuration found, skip effect
    if (!matchedConfig) {
        logDebug("No matching configuration found for type:", type, "triggerType:", triggerType);
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
        const soundPath = await CritSoundConfig.getSoundPath(soundConfig);
        if (soundPath) {
            const volume = (soundConfig.volume ?? 90) / 100;
            foundry.audio.AudioHelper.play({ 
                src: soundPath, 
                volume: volume, 
                autoplay: true, 
                loop: false 
            }, false);
        }
    }
}


/**
 * Initialize Level Up monitoring for Player Characters
 */
function initializeLevelUpMonitoring() {
    logDebug("Initializing Level Up monitoring...");

    // Debounce set to prevent duplicate triggers from multiple updateActor events
    const recentLevelUps = new Set();

    Hooks.on("updateActor", (actor, changes, options, userId) => {
        // Check if levelData was updated - the structure is changes.system.levelData.level
        if (!changes.system?.levelData?.level) return;

        // Get the updated values from the actor (after the update)
        const currentLevel = actor.system.levelData.level.current;
        const changedLevel = actor.system.levelData.level.changed;

        logDebug("Level data update detected:", {
            actorName: actor.name,
            actorId: actor.id,
            currentLevel,
            changedLevel,
            userId,
            changes: changes.system.levelData
        });

        // Check if actor leveled up (changed > current)
        if (changedLevel > currentLevel) {
            // Debounce: prevent duplicate triggers for the same actor/level
            const debounceKey = `${actor.id}-${changedLevel}`;
            if (recentLevelUps.has(debounceKey)) {
                logDebug("Skipping duplicate level up trigger for:", actor.name);
                return;
            }
            recentLevelUps.add(debounceKey);
            setTimeout(() => recentLevelUps.delete(debounceKey), 5000);

            logDebug("Level up detected for actor:", actor.name);
            handleLevelUp(actor, userId);
        }
    });
}

/**
 * Handle level up event for an actor
 * @param {Actor} actor - The actor that leveled up
 * @param {string} userId - The user ID who triggered the update
 */
async function handleLevelUp(actor, userId) {
    logDebug("=== Handling Level Up ===");
    logDebug("Actor:", actor.name, "| User ID:", userId);
    
    // Get all configurations
    const configurations = CriticalSettingsManager.getConfigurations();
    
    // Find matching Level Up configurations for Player Character
    const levelUpConfigs = configurations.filter(c => 
        c.type === "Player Character" && 
        c.triggerType === "Level Up"
    );
    
    logDebug("Found Level Up configs:", levelUpConfigs.map(c => ({ 
        id: c.id, 
        name: c.name, 
        userId: c.userId 
    })));
    
    // Find users that have this actor linked
    const linkedUsers = game.users.filter(u => {
        if (u.isGM) return false; // Skip GMs
        const linkedActor = u.character;
        return linkedActor && linkedActor.id === actor.id;
    });
    
    logDebug("Linked users:", linkedUsers.map(u => ({ id: u.id, name: u.name })));
    
    // Process each linked user
    for (const user of linkedUsers) {
        // Find matching configuration for this user
        let matchedConfig = null;
        
        // Priority: specific user match > "all" users > default
        matchedConfig = levelUpConfigs.find(c => 
            c.userId === user.id && !c.isDefault
        );
        
        if (!matchedConfig) {
            matchedConfig = levelUpConfigs.find(c => 
                c.userId === "all" && !c.isDefault
            );
        }
        
        if (!matchedConfig) {
            matchedConfig = levelUpConfigs.find(c => 
                c.id === "default-player-character" && 
                c.triggerType === "Level Up"
            );
        }
        
        if (!matchedConfig) {
            logDebug("No matching Level Up config found for user:", user.name);
            continue;
        }
        
        logDebug("Using config:", matchedConfig.name, "for user:", user.name);
        
        // Trigger effect only for this specific user
        await triggerLevelUpEffect(user, matchedConfig);
    }
}

/**
 * Trigger level up effect for a specific user
 * @param {User} user - The user to show the effect to
 * @param {CriticalConfiguration} config - The configuration to use
 */
async function triggerLevelUpEffect(user, config) {
    logDebug("triggerLevelUpEffect called for user:", user.name, "| Current game.user:", game.user.name);
    
    // Only show effect to the specific user (client-side check)
    if (game.user.id !== user.id) {
        logDebug("Skipping effect - not the target user");
        return;
    }
    
    logDebug("Triggering Level Up effect for user:", user.name);
    
    const userColor = user.color?.toString() || "#ffffff";
    
    // Get settings for the matched configuration
    const configSettings = game.settings.get(MODULE_ID, "critConfigSettings") || {};
    const entrySettings = configSettings[config.id] || {};
    
    // Fallback to global PC settings if no config-specific settings
    const globalTextSettings = game.settings.get(MODULE_ID, "critTextSettings");
    const globalFxSettings = game.settings.get(MODULE_ID, "critFXSettings");
    const globalSoundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
    const globalArtSettings = game.settings.get(MODULE_ID, "critArtSettings");
    
    const textConfig = entrySettings.text || globalTextSettings.pc || null;
    const fxConfig = entrySettings.fx || globalFxSettings.pc;
    const soundConfig = entrySettings.sound || globalSoundSettings.duality;
    const artConfig = entrySettings.art || globalArtSettings.pc || null;
    
    logDebug("Level Up effect config:", {
        textConfig,
        fxConfig,
        soundConfig,
        artConfig,
        userColor,
        userId: user.id
    });

    // Render overlay first, then FX, then sound (same order as triggerCriticalEffect)
    new CritOverlay({
        type: "duality",
        userColor,
        authorId: user.id,
        configOverride: textConfig,
        artOverride: artConfig
    }).render(true);

    // Trigger configured Visual FX
    if (fxConfig && fxConfig.type !== "none") {
        logDebug("Triggering FX:", fxConfig.type);
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
        logDebug("Playing sound:", soundConfig.soundPath);
        const soundPath = await CritSoundConfig.getSoundPath(soundConfig);
        if (soundPath) {
            const volume = (soundConfig.volume ?? 90) / 100;
            foundry.audio.AudioHelper.play({
                src: soundPath,
                volume: volume,
                autoplay: true,
                loop: false
            }, false);
        }
    }
}

/**
 * Initialize Tag Team Open monitoring
 * Watches the Daggerheart TagTeamRoll setting for changes
 * Triggers only when: initiator.id is non-null, members has 2+, and all selected are false
 */
function initializeTagTeamMonitoring() {
    logDebug("Initializing Tag Team Open monitoring...");

    // Debounce set to prevent duplicate triggers for the same initiator
    const recentTagTeams = new Set();

    Hooks.on("updateSetting", (setting) => {
        // Build the expected setting key from Daggerheart system config
        const targetKey = `${CONFIG.DH.id}.${CONFIG.DH.SETTINGS.gameSettings.TagTeamRoll}`;
        if (setting.key !== targetKey) return;

        // Read the current value of the setting
        const tagTeamData = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.TagTeamRoll);
        const initiatorId = tagTeamData?.initiator?.id;

        logDebug("Tag Team setting updated:", {
            initiatorId,
            tagTeamData
        });

        // Must have a non-null initiator
        if (!initiatorId) return;

        // Must have 2 or more members
        const members = tagTeamData?.members;
        if (!members || Object.keys(members).length < 2) {
            logDebug("Tag Team skipped — fewer than 2 members");
            return;
        }

        // All members must have selected === false (avoid false positives from member selection updates)
        const allUnselected = Object.values(members).every(m => m.selected === false);
        if (!allUnselected) {
            logDebug("Tag Team skipped — one or more members already selected");
            return;
        }

        // Debounce: prevent duplicate triggers for the same initiator
        if (recentTagTeams.has(initiatorId)) {
            logDebug("Skipping duplicate Tag Team Open trigger for:", initiatorId);
            return;
        }
        recentTagTeams.add(initiatorId);
        setTimeout(() => recentTagTeams.delete(initiatorId), 5000);

        handleTagTeamOpen(initiatorId);
    });
}

/**
 * Handle Tag Team Open event
 * @param {string} initiatorId - The actor ID of the Tag Team initiator
 */
async function handleTagTeamOpen(initiatorId) {
    logDebug("=== Handling Tag Team Open ===");
    logDebug("Initiator Actor ID:", initiatorId);

    // Get all configurations
    const configurations = CriticalSettingsManager.getConfigurations();

    // Find matching Tag Team Open configurations for Player Character
    const tagTeamConfigs = configurations.filter(c =>
        c.type === "Player Character" &&
        c.triggerType === "Tag Team Open"
    );

    logDebug("Found Tag Team Open configs:", tagTeamConfigs.map(c => ({
        id: c.id,
        name: c.name,
        userId: c.userId
    })));

    if (tagTeamConfigs.length === 0) {
        logDebug("No Tag Team Open configurations found");
        return;
    }

    // Find the non-GM user whose linked actor matches the initiator
    const linkedUser = game.users.find(u => {
        if (u.isGM) return false;
        return u.character?.id === initiatorId;
    });

    logDebug("Linked user for initiator:", linkedUser ? { id: linkedUser.id, name: linkedUser.name } : "none");

    // Find matching configuration using the initiator's linked user
    let matchedConfig = null;

    // Priority: specific user match > "all" users > default
    if (linkedUser) {
        matchedConfig = tagTeamConfigs.find(c =>
            c.userId === linkedUser.id && !c.isDefault
        );
    }

    if (!matchedConfig) {
        matchedConfig = tagTeamConfigs.find(c =>
            c.userId === "all" && !c.isDefault
        );
    }

    if (!matchedConfig) {
        matchedConfig = tagTeamConfigs.find(c =>
            c.id === "default-player-character" &&
            c.triggerType === "Tag Team Open"
        );
    }

    if (!matchedConfig) {
        logDebug("No matching Tag Team Open config found");
        return;
    }

    logDebug("Using config:", matchedConfig.name);

    // Trigger effect for ALL connected users
    await triggerTagTeamEffect(linkedUser, matchedConfig);

    // Send Tag Team whispers to team members
    await sendTagTeamWhispers();
}

/**
 * Send Tag Team whispers to all team members
 * Sends a private chat message to users whose actors are in the Tag Team members list
 * Only runs on GM client to avoid duplicate messages
 */
async function sendTagTeamWhispers() {
    // Only GM creates the messages to avoid duplicates from multiple clients
    if (!game.user.isGM) {
        logDebug("Tag Team whisper: Skipping (not GM client)");
        return;
    }

    logDebug("=== Sending Tag Team Whispers ===");

    // Get the Tag Team data
    const tagTeamData = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.TagTeamRoll);
    const members = tagTeamData?.members || {};

    logDebug("Tag Team members:", Object.keys(members));
    logDebug("Full Tag Team data:", tagTeamData);

    // Get all actor identifiers from members
    const memberActorIds = Object.keys(members);

    if (memberActorIds.length === 0) {
        logDebug("No members in Tag Team");
        return;
    }

    // Find users whose linked actors are in the Tag Team members list
    const targetUsers = [];
    for (const user of game.users) {
        if (user.isGM) continue; // Skip GMs

        const linkedActor = user.character;
        if (!linkedActor) continue;

        logDebug("Checking user:", {
            userId: user.id,
            userName: user.name,
            actorId: linkedActor.id,
            actorUuid: linkedActor.uuid
        });

        // Check if this actor's ID or UUID is in the Tag Team members list
        if (memberActorIds.includes(linkedActor.id) || memberActorIds.includes(linkedActor.uuid)) {
            targetUsers.push(user);
            logDebug("Found Tag Team member user:", { userId: user.id, userName: user.name, actorId: linkedActor.id, actorUuid: linkedActor.uuid });
        }
    }

    logDebug("Target users for whisper:", targetUsers.map(u => ({ id: u.id, name: u.name })));

    // Send whisper to each target user
    for (const user of targetUsers) {
        try {
            const message = await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ alias: "Tag Team" }),
                content: `
            <div style="
                background-color: #1a1a1a;
                border: 2px solid #c5a059;
                border-radius: 6px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.6);
                padding: 12px;
                color: #f0f0f0;
                font-family: 'Cinzel', serif;
                margin-bottom: 5px;
            ">
                <!-- Header -->
                <header style="
                    border-bottom: 1px solid rgba(197, 160, 89, 0.5);
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <h3 style="
                        margin: 0;
                        color: #c5a059;
                        font-size: 1.4em;
                        text-transform: uppercase;
                        text-shadow: 1px 1px 2px black;
                        border: none;
                    ">Tag Team</h3>
                </header>

                <!-- Main Content -->
                <div style="
                    font-family: 'Signika', sans-serif;
                    font-size: 1.1em;
                    color: #f0f0f0;
                    text-align: center;
                    padding: 10px 0;
                ">
                    Make a roll from your character sheet now!
                </div>
            </div>
            `,
                whisper: [user.id]
            });

            logDebug("Tag Team whisper sent to user:", user.name, "| Message ID:", message?.id);
        } catch (error) {
            console.error("Error creating Tag Team whisper for user", user.name, ":", error);
            logDebug("ERROR sending whisper to", user.name, ":", error.message);
        }
    }
}

/**
 * Trigger Tag Team Open effect for all connected users
 * @param {User|null} linkedUser - The user whose actor initiated the Tag Team (used for color)
 * @param {CriticalConfiguration} config - The configuration to use
 */
async function triggerTagTeamEffect(linkedUser, config) {
    logDebug("Triggering Tag Team Open effect for all connected users");

    const userColor = linkedUser?.color?.toString() || game.user.color?.toString() || "#ffffff";
    const authorId = linkedUser?.id || game.user.id;

    // Get settings for the matched configuration
    const configSettings = game.settings.get(MODULE_ID, "critConfigSettings") || {};
    const entrySettings = configSettings[config.id] || {};

    // Fallback to global PC settings if no config-specific settings
    const globalTextSettings = game.settings.get(MODULE_ID, "critTextSettings");
    const globalFxSettings = game.settings.get(MODULE_ID, "critFXSettings");
    const globalSoundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
    const globalArtSettings = game.settings.get(MODULE_ID, "critArtSettings");

    const textConfig = entrySettings.text || globalTextSettings.pc || null;
    const fxConfig = entrySettings.fx || globalFxSettings.pc;
    const soundConfig = entrySettings.sound || globalSoundSettings.duality;
    const artConfig = entrySettings.art || globalArtSettings.pc || null;

    // Render overlay
    new CritOverlay({
        type: "duality",
        userColor,
        authorId,
        configOverride: textConfig,
        artOverride: artConfig
    }).render(true);

    // Trigger configured Visual FX
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
        const soundPath = await CritSoundConfig.getSoundPath(soundConfig);
        if (soundPath) {
            const volume = (soundConfig.volume ?? 90) / 100;
            foundry.audio.AudioHelper.play({
                src: soundPath,
                volume: volume,
                autoplay: true,
                loop: false
            }, false);
        }
    }
}
