import { CritOverlay } from "./crit-overlay.js";

export class CritFX {
    constructor() {
        this.layer = null;
        this.borderLayer = null;
        this.confettiCanvas = null;
        this.particles = [];
        this.confettiParticles = [];
        this.running = false;
        this.confettiRunning = false;
        this.lastTime = 0;
        this.shakeInterval = null;
        this.globalRotation = 0;
    }

    initialize() {
        // Inject CSS if not present
        if (!document.getElementById("dh-crit-fx-styles")) {
            const css = `
                #dh-crit-fx-layer { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 100000; overflow: hidden; }
                #dh-crit-fx-border { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 200000; box-sizing: border-box; border: 0px solid transparent; transition: border 0.3s ease; display: none; --cfx-border-rgb: 255, 0, 0; }
                /* Confetti Canvas Style */
                #celebrate-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 100000; background: transparent; }
                .cfx-shard-realistic { position: absolute; background: rgba(220, 240, 255, 0.6); box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.8), 0 0 5px rgba(0,0,0,0.2); pointer-events: none; will-change: transform; z-index: 100002; }
                @keyframes cfx-pulse-border { 0% { box-shadow: inset 0 0 20px rgba(var(--cfx-border-rgb), 0.5); border-color: rgba(var(--cfx-border-rgb), 0.8); } 50% { box-shadow: inset 0 0 50px rgba(var(--cfx-border-rgb), 0.8); border-color: rgba(var(--cfx-border-rgb), 1); } 100% { box-shadow: inset 0 0 20px rgba(var(--cfx-border-rgb), 0.5); border-color: rgba(var(--cfx-border-rgb), 0.8); } }
                @keyframes cfx-pulse-anim { 0% { transform: scale(1) rotate(0deg); } 50% { transform: scale(var(--cfx-pulse-scale)); } 100% { transform: scale(1) rotate(0deg); } }
                #dh-crit-fx-border.active { display: block; animation: cfx-pulse-border 2s infinite; }
            `;
            const style = document.createElement("style");
            style.id = "dh-crit-fx-styles";
            style.textContent = css;
            document.head.appendChild(style);
        }

        // Get or Create Layer
        this.layer = document.getElementById("dh-crit-fx-layer");
        if (!this.layer) {
            this.layer = document.createElement("div");
            this.layer.id = "dh-crit-fx-layer";
            document.body.appendChild(this.layer);
        }

        // Get or Create Border Layer
        this.borderLayer = document.getElementById("dh-crit-fx-border");
        if (!this.borderLayer) {
            this.borderLayer = document.createElement("div");
            this.borderLayer.id = "dh-crit-fx-border";
            document.body.appendChild(this.borderLayer);
        }
    }

    ScreenShake(options = {}) {
        this.initialize();
        if (this.shakeInterval) clearInterval(this.shakeInterval);
        const mag = options.intensity === "extreme" ? 20 : options.intensity === "mild" ? 3 : 10;
        const start = Date.now();
        const dur = options.duration || 600;
        this.shakeInterval = setInterval(() => {
            if (Date.now() - start >= dur) { 
                clearInterval(this.shakeInterval); 
                document.body.style.transform = `rotate(${this.globalRotation}deg)`; 
                return; 
            }
            const x = (Math.random() - 0.5) * mag * 2;
            const y = (Math.random() - 0.5) * mag * 2;
            document.body.style.transform = `translate(${x}px, ${y}px) rotate(${this.globalRotation}deg)`;
        }, 16);
    }

    GlassShatter(options = {}) {
        this.initialize();
        const count = options.count || 300;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        for (let i = 0; i < count; i++) {
            const el = document.createElement("div");
            el.classList.add("cfx-shard-realistic");
            const p1 = `${Math.random()*100}% ${Math.random()*100}%`;
            const p2 = `${Math.random()*100}% ${Math.random()*100}%`;
            const p3 = `${Math.random()*100}% ${Math.random()*100}%`;
            el.style.clipPath = `polygon(${p1}, ${p2}, ${p3})`;
            const size = 20 + Math.random() * 80;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            const startX = Math.random() * screenW;
            const startY = Math.random() * screenH;
            const angle = Math.random() * Math.PI * 2;
            const force = 200 + Math.random() * 600;
            const vx = Math.cos(angle) * force;
            const vy = Math.sin(angle) * force;

            const particle = {
                element: el,
                x: startX,
                y: startY,
                vx: vx,
                vy: vy,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 720,
                gravity: 1000 
            };

            el.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
            this.layer.appendChild(el);
            this.particles.push(particle);
        }
        
        this.ScreenShake({ intensity: "heavy", duration: 400 });
        this.startLoop();
    }

    ScreenBorder(options = {}) {
        this.initialize();
        const thickness = options.thickness || 20;
        const color = options.color || "#ff0000";
        const duration = options.duration || 3000;

        this.borderLayer.classList.add("active"); 
        this.borderLayer.style.display = "block";
        this.borderLayer.style.borderWidth = `${thickness}px`; 
        
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.fillStyle = color;
        let hex = ctx.fillStyle; 
        let rgb = "255, 0, 0";
        if (hex.startsWith("#")) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            rgb = `${r}, ${g}, ${b}`;
        }
        this.borderLayer.style.setProperty('--cfx-border-rgb', rgb);

        setTimeout(() => {
             this.borderLayer.classList.remove("active"); 
             this.borderLayer.style.display = "none"; 
        }, duration);
    }

    Pulsate(options = {}) {
        this.initialize();
        document.body.style.animation = 'none'; void document.body.offsetHeight;
        document.body.style.setProperty('--cfx-pulse-scale', 1 + (0.02 * (options.intensity || 2)));
        document.body.style.animation = `cfx-pulse-anim ${options.duration || 600}ms ease-in-out ${options.iterations || 4}`;
    }

    Confetti(options = {}) {
        this.initialize();
        
        // Setup Canvas
        if (!this.confettiCanvas) {
            this.confettiCanvas = document.getElementById("celebrate-canvas");
        }
        if (!this.confettiCanvas) {
            this.confettiCanvas = document.createElement("canvas");
            this.confettiCanvas.id = "celebrate-canvas";
            document.body.appendChild(this.confettiCanvas);
        }

        const canvas = this.confettiCanvas;
        const ctx = canvas.getContext("2d");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Map intensity (1-5) to particle count
        // Default to intensity 3 (Normal) if not provided
        const intensityMap = { 1: 50, 2: 100, 3: 200, 4: 400, 5: 800 };
        const particleCount = intensityMap[parseInt(options.intensity)] || 200;
        
        // Default duration 4000ms
        const duration = options.duration || 4000;

        const colors = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];
        
        this.confettiParticles = [];
        for (let i = 0; i < particleCount; i++) {
            this.confettiParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 10 + 5,
                h: Math.random() * 10 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                speed: Math.random() * 3 + 2,
                angle: Math.random() * 360,
                spin: Math.random() < 0.5 ? -1 : 1,
                drift: Math.random() * 2 - 1
            });
        }

        this.confettiRunning = true;
        
        // Start Loop
        const animateConfetti = () => {
            if (!this.confettiRunning) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.confettiParticles.forEach(p => {
                p.y += p.speed;
                p.x += p.drift;
                p.angle += p.spin;
                
                // Draw
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();

                // Recycle if fell off screen (only if still running)
                if (p.y > canvas.height) {
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                }
            });

            requestAnimationFrame(animateConfetti);
        };

        requestAnimationFrame(animateConfetti);

        // Stop after duration
        setTimeout(() => {
            this.confettiRunning = false;
            // Final clear
            setTimeout(() => {
                if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }, 100);
        }, duration);
    }

    startLoop() { 
        if (!this.running) { 
            this.running = true; 
            this.lastTime = performance.now(); 
            requestAnimationFrame(this._animate.bind(this)); 
        } 
    }

    _animate(t) {
        if (!this.running) return;
        const dt = (t - this.lastTime) / 1000; this.lastTime = t;
        const h = window.innerHeight; const w = window.innerWidth;
        
        this.particles = this.particles.filter(p => {
            if (p.gravity) p.vy += p.gravity * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.rotationSpeed * dt;
            p.element.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`;
            const outside = (p.y > h + 150 || p.y < -150 || p.x > w + 150 || p.x < -150);
            if (outside) p.element.remove();
            return !outside;
        });

        if (this.particles.length > 0) requestAnimationFrame(this._animate.bind(this));
        else this.running = false;
    }
}