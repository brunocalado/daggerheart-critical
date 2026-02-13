const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FONT_SIZE_MAP = {
    small: "4",
    normal: "8",
    large: "12",
    "extra-large": "16"
};

const LETTER_SPACING_MAP = {
    normal: "normal",
    tight: "-0.05em",
    wide: "0.15em",
    "extra-wide": "0.3em"
};

export class CritOverlay extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        super(options);
        this.type = options.type || "duality"; // 'duality' or 'adversary'
        this.userColor = options.userColor || "#ffffff";
        this.configOverride = options.configOverride || null;
        this.authorId = options.authorId || null;
        this.artOverride = options.artOverride || null;
    }

    static DEFAULT_OPTIONS = {
        id: "daggerheart-crit-overlay",
        tag: "div",
        window: {
            frame: false,
            positioned: false,
        },
        classes: ["crit-overlay-app"],
        position: {
            width: "100%",
            height: "100%",
            top: 0,
            left: 0
        }
    };

    static get PARTS() {
        return {
            content: {
                template: "modules/daggerheart-critical/templates/crit-splash.hbs",
            },
        };
    }

    async _prepareContext(options) {
        const configKey = (this.type === "adversary") ? "adversary" : "pc";
        const cssClass = (this.type === "adversary") ? "adversary-style" : "duality-style";

        // Load text settings
        const textSettings = game.settings.get("daggerheart-critical", "critTextSettings");
        const defaults = {
            pc: { content: "CRITICAL", fontFamily: "Bangers", fontSize: "large", letterSpacing: "wide", color: "#ffcc00", backgroundColor: "#000000", fill: "none", usePlayerColor: false, useImage: false, imagePath: "modules/daggerheart-critical/assets/critical-img-demo/molten_voltage.webp", imageSize: "normal", duration: 0 },
            adversary: { content: "CRITICAL", fontFamily: "Bangers", fontSize: "large", letterSpacing: "wide", color: "#ff0000", backgroundColor: "#000000", fill: "none", usePlayerColor: false, useImage: false, imagePath: "modules/daggerheart-critical/assets/critical-img-demo/molten_voltage.webp", imageSize: "normal", duration: 0 }
        };
        const textConfig = this.configOverride
            ? foundry.utils.mergeObject(defaults[configKey], this.configOverride)
            : foundry.utils.mergeObject(defaults[configKey], textSettings[configKey] || {});

        // Map fontSize name to rem value
        textConfig.fontSizeRem = FONT_SIZE_MAP[textConfig.fontSize] || "8";

        // Map letterSpacing name to CSS value
        textConfig.letterSpacingCSS = LETTER_SPACING_MAP[textConfig.letterSpacing] || "normal";

        // Resolve color: use player color if enabled
        if (textConfig.usePlayerColor) {
            textConfig.resolvedColor = this.userColor;
        } else {
            textConfig.resolvedColor = textConfig.color || defaults[configKey].color;
        }

        // Determine if imagePath is a video
        let isVideo = false;
        let mediaPath = textConfig.imagePath;
        
        if (textConfig.useImage && mediaPath) {
            const ext = mediaPath.split('.').pop().toLowerCase();
            if (ext === "webm" || ext === "mp4") {
                isVideo = true;
            }
        }

        // Load art settings for PC criticals
        let artImagePath = null;
        let artPosition = "middle";
        let artPositionY = "middle";
        let artSize = "normal";
        let artOffsetX = 0;
        let artOffsetY = 0;

        if (this.artOverride) {
            if (this.artOverride.imagePath) {
                artImagePath = this.artOverride.imagePath;
                artPosition = this.artOverride.position || "middle";
                artPositionY = this.artOverride.positionY || "middle";
                artSize = this.artOverride.artSize || "normal";
                artOffsetX = this.artOverride.offsetX || 0;
                artOffsetY = this.artOverride.offsetY || 0;
            }
        } else {
            const artSettings = game.settings.get("daggerheart-critical", "critArtSettings");
            if (this.type === "adversary") {
                // Adversary: use shared adversary art config
                const advArt = artSettings.adversary;
                if (advArt && advArt.imagePath) {
                    artImagePath = advArt.imagePath;
                    artPosition = advArt.position || "middle";
                    artPositionY = advArt.positionY || "middle";
                    artSize = advArt.artSize || "normal";
                    artOffsetX = advArt.offsetX || 0;
                    artOffsetY = advArt.offsetY || 0;
                }
            } else {
                // PC: use default PC art config
                const pcArt = artSettings.pc;
                if (pcArt && pcArt.imagePath) {
                    artImagePath = pcArt.imagePath;
                    artPosition = pcArt.position || "middle";
                    artPositionY = pcArt.positionY || "middle";
                    artSize = pcArt.artSize || "normal";
                    artOffsetX = pcArt.offsetX || 0;
                    artOffsetY = pcArt.offsetY || 0;
                }
            }
        }

        return {
            critTitle: textConfig.content || "CRITICAL",
            typeClass: cssClass,
            textConfig,
            isVideo,
            mediaPath,
            artImagePath,
            artPosition,
            artPositionY,
            artSize,
            artOffsetX,
            artOffsetY
        };
    }

    _onRender(context, options) {
        // Look for a video element
        const videoElement = this.element.querySelector("video.crit-video");

        // Get custom duration from config (in ms), default to 0 (use default behavior)
        const customDuration = parseInt(context.textConfig.duration, 10) || 0;
        
        // Get debug setting
        const debugEnabled = game.settings.get("daggerheart-critical", "debugmode");
        
        if (debugEnabled) {
            console.log("DH-CRIT DEBUG | CritOverlay: Custom duration =", customDuration, "ms, useImage =", context.textConfig.useImage);
        }

        // Set CSS variable for animation duration
        if (customDuration > 0) {
            const durationInSeconds = customDuration / 1000;
            this.element.style.setProperty('--crit-duration', `${durationInSeconds}s`);
            if (debugEnabled) {
                console.log("DH-CRIT DEBUG | CritOverlay: Set CSS animation duration to", durationInSeconds, "seconds");
            }
        }

        // Store audio context to stop it when closing
        this.audioContext = null;

        if (videoElement) {
            // Mute the video element so it doesn't play raw audio
            // This allows us to play the audio separately via AudioHelper (Interface Channel)
            videoElement.muted = true;

            // Play the audio track via Foundry's AudioHelper
            const src = videoElement.getAttribute("src");
            if (src) {
                // Store the audio context so we can stop it later
                this.audioContext = { src: src };
                foundry.audio.AudioHelper.play({
                    src: src,
                    volume: 0.8,
                    autoplay: true,
                    loop: false
                }, false).then(sound => {
                    this.audioSound = sound;
                });
            }
            
            if (customDuration > 0) {
                // Use custom duration - close after specified time
                if (debugEnabled) {
                    console.log("DH-CRIT DEBUG | CritOverlay: Using custom duration for video:", customDuration, "ms");
                }
                setTimeout(() => {
                    if (this.element) this.close();
                }, customDuration);
            } else {
                // Close when video ends
                if (debugEnabled) {
                    console.log("DH-CRIT DEBUG | CritOverlay: Using video end event");
                }
                videoElement.onended = () => {
                    this.close();
                };

                // Fallback safety: close after 15 seconds if video loops or hangs
                setTimeout(() => {
                    if (this.element) this.close();
                }, 15000);
            }

        } else {
            // Standard Image/Text behavior: use custom duration or default 3 seconds
            const duration = customDuration > 0 ? customDuration : 3000;
            if (debugEnabled) {
                console.log("DH-CRIT DEBUG | CritOverlay: Using duration for image/text:", duration, "ms");
            }
            setTimeout(() => {
                this.close();
            }, duration);
        }
    }

    async close(options = {}) {
        // Stop audio if it's playing
        if (this.audioSound) {
            try {
                this.audioSound.stop();
            } catch (e) {
                // Audio might already be stopped
            }
        }
        
        // Also try to stop all sounds from the video source
        if (this.audioContext && this.audioContext.src) {
            try {
                game.audio.playing.forEach(sound => {
                    if (sound.src === this.audioContext.src) {
                        sound.stop();
                    }
                });
            } catch (e) {
                // Ignore errors
            }
        }
        
        return super.close(options);
    }
}