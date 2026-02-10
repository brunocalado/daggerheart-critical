import { CritOverlay } from "./crit-overlay.js";
import { CritConfig } from "./crit-config.js";
import { CritTextConfig } from "./crit-text-config.js";
import { CritSoundConfig } from "./crit-sound-config.js";
import { CritArtConfig } from "./crit-art-config.js";
import { CritFX } from "./crit-fx.js";

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

    // --- Critical Text Settings ---
    game.settings.registerMenu(MODULE_ID, "critTextMenu", {
        name: "Critical Text",
        label: "Configure Text",
        hint: "Customize text appearance, size, color, and animation. You can use image.",
        icon: "fas fa-font",
        type: CritTextConfig,
        restricted: true
    });

    // --- Visual FX Settings ---
    game.settings.registerMenu(MODULE_ID, "critFXMenu", {
        name: "Critical FX",
        label: "Configure Visual FX",
        hint: "Visual effect to play on critical hits.",
        icon: "fas fa-bolt",
        type: CritConfig,
        restricted: true
    });

    // --- Sound Settings ---
    game.settings.registerMenu(MODULE_ID, "critSoundMenu", {
        name: "Critical Sound",
        label: "Configure Sound",
        hint: "Sound effects played on critical hits.",
        icon: "fas fa-music",
        type: CritSoundConfig,
        restricted: true
    });

    // --- Critical Art Settings ---
    game.settings.registerMenu(MODULE_ID, "critArtMenu", {
        name: "Critical Art",
        label: "Configure Art",
        hint: "Configure per-player artwork displayed behind the critical text.",
        icon: "fas fa-palette",
        type: CritArtConfig,
        restricted: true
    });

    game.settings.register(MODULE_ID, "critSoundSettings", {
        scope: "world",
        config: false,
        type: Object,
        default: {
            dualityEnabled: true,
            adversaryEnabled: true,
            dualitySoundPath: `modules/${MODULE_ID}/assets/sfx/pc-orchestral-win.mp3`,
            adversarySoundPath: `modules/${MODULE_ID}/assets/sfx/adv-critical-tension-impact.mp3`
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
    // Renders the visual
    const userColor = message.author?.color?.toString() || "#ffffff";
    const authorId = message.author?.id;
    new CritOverlay({ type, userColor, authorId }).render(true);

    // Triggers configured Visual FX
    const fxSettings = game.settings.get(MODULE_ID, "critFXSettings");
    // The 'type' variable is 'duality' or 'adversary'. We map 'duality' to 'pc'.
    const configKey = (type === "duality") ? "pc" : "adversary";
    const fxConfig = fxSettings[configKey];

    if (fxConfig && fxConfig.type !== "none") {
        const fx = new CritFX();
        switch (fxConfig.type) {
            case "shake": fx.ScreenShake(fxConfig.options); break;
            case "shatter": fx.GlassShatter(fxConfig.options); break;
            case "border": fx.ScreenBorder(fxConfig.options); break;
            case "pulsate": fx.Pulsate(fxConfig.options); break;
        }
    }

    // Selects sound based on type
    const soundSettings = game.settings.get(MODULE_ID, "critSoundSettings");
    const soundEnabled = (type === "adversary") ? soundSettings.adversaryEnabled : soundSettings.dualityEnabled;
    if (soundEnabled) {
        const soundPath = (type === "adversary") ? soundSettings.adversarySoundPath : soundSettings.dualitySoundPath;
        if (soundPath) {
            foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, true);
        }
    }
}