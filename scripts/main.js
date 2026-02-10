import { CritOverlay } from "./crit-overlay.js";
import { CritConfig } from "./crit-config.js";
import { CritTextConfig } from "./crit-text-config.js";
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
    // --- Updated Sound Settings ---

    game.settings.register(MODULE_ID, "dualitySoundPath", {
        name: "Duality Critical Sound",
        hint: "Audio played when a Player/Duality critical occurs.",
        scope: "world",
        config: true,
        type: String,
        default: `modules/${MODULE_ID}/assets/sfx/pc-orchestral-win.mp3`,
        filePicker: "audio"
    });

    game.settings.register(MODULE_ID, "adversarySoundPath", {
        name: "Adversary Critical Sound",
        hint: "Audio played when a GM/Adversary critical occurs.",
        scope: "world",
        config: true,
        type: String,
        default: `modules/${MODULE_ID}/assets/sfx/adv-critical-tension-impact.mp3`,
        filePicker: "audio"
    });

    game.settings.register(MODULE_ID, "debugmode", {
        name: "Enable Debug Mode",
        hint: "Prints roll detection info to console (F12).",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
    
    // --- Visual FX Settings ---
    game.settings.registerMenu(MODULE_ID, "critFXMenu", {
        name: "Critical FX",
        label: "Configure Visual FX",
        hint: "Choose a visual effect to play on critical hits.",
        icon: "fas fa-bolt",
        type: CritConfig,
        restricted: true
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

    // --- Critical Text Settings ---
    game.settings.registerMenu(MODULE_ID, "critTextMenu", {
        name: "Critical Text",
        label: "Configure Text",
        hint: "Customize the critical hit text appearance, size, color, and animation.",
        icon: "fas fa-font",
        type: CritTextConfig,
        restricted: true
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
                usePlayerColor: false
            },
            adversary: {
                content: "CRITICAL!",
                fontFamily: "Bangers",
                fontSize: "normal",
                letterSpacing: "normal",
                color: "#ff0000",
                backgroundColor: "#000000",
                fill: "none",
                usePlayerColor: false
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
    new CritOverlay({ type, userColor }).render(true);

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
    const settingKey = (type === "adversary") ? "adversarySoundPath" : "dualitySoundPath";
    const soundPath = game.settings.get(MODULE_ID, settingKey);

    if (soundPath) {
        // Correct namespace for V12+
        foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, true);
    }
}