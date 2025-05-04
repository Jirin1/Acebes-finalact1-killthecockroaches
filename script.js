const CACHE_NAME = 'cockroach-killer-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/assets/cockroach.png',
    '/assets/dead_cockroach.png',
    '/assets/icon.png',
    '/assets/kill.mp3',
    '/assets/music.mp3',
    '/assets/slipper.png',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});


// script.js
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const bgMusic = document.getElementById('bgMusic');
        const killSound = document.getElementById('killSound');
        const muteBtn = document.getElementById('muteBtn');
        const offlineDiv = document.getElementById('offline');
        const timerDisplay = document.getElementById('timer');
        const killsDisplay = document.getElementById('kills');
        const gameOverDiv = document.getElementById('gameOver');
        const finalKillsDisplay = document.getElementById('finalKills');
        const highScoreDisplay = document.getElementById('highScoreValue');
        const startScreen = document.getElementById('startScreen');
        const startBtn = document.getElementById('startBtn');
        const playAgainBtn = document.getElementById('playAgainBtn');
        const gameContainer = document.getElementById('game-container');
        const killsUi = document.getElementById('kills-ui');
        const timerContainer = document.getElementById('timer-container');
        const uiTop = document.getElementById('ui-top');

        let width, height, cockroaches = [], kills = 0, time = 90 * 1000, spawnRate = 2000, spawnCount = 1;
        let isMuted = false, gameOver = false, gameStarted = false;
        let misses = [];
        let messages = [];
        const GAME_DURATION = 90 * 1000;
        let COCKROACH_LIFETIME = 1000;
        const SPAWN_STAGGER_DELAY = 300;
        const DISAPPEARANCE_MIN_INTERVAL = 300;
        const DISAPPEARANCE_MAX_INTERVAL = 500;
        const FADE_DURATION = 600;
        const POPUP_DURATION = 600;
        const MISS_DURATION = 1200;
        const MESSAGE_DURATION = 2000;
        let highScore = localStorage.getItem('highScore') ? parseInt(localStorage.getItem('highScore')) : 0;
        let removalQueue = [];
        let isProcessingQueue = false;
        highScoreDisplay.textContent = highScore;

        function ensureSlipperCursor() {
            document.body.classList.add('slipper-cursor');
            canvas.classList.add('slipper-cursor');
            console.log('Body cursor style:', getComputedStyle(document.body).cursor);
            console.log('Canvas cursor style:', getComputedStyle(canvas).cursor);
        }

        function resizeCanvas() {
            width = gameContainer.offsetWidth;
            height = gameContainer.offsetHeight;
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            spawnRate = width < 600 ? 2500 : 2000;
            COCKROACH_LIFETIME = width < 600 ? 1200 : 1000;
            ensureSlipperCursor();
        }

        window.addEventListener('resize', () => {
            resizeCanvas();
            cockroaches.forEach(c => {
                c.size = Math.min(Math.max(40, 0.05 * width), 90);
                c.x = Math.min(c.x, width - c.size);
                c.y = Math.min(c.y, height - c.size);
            });
        });
        resizeCanvas();

        const images = {
            cockroach: new Image(),
            deadCockroach: new Image(),
            slipper: new Image()
        };
        images.cockroach.src = 'assets/cockroach.png';
        images.deadCockroach.src = 'assets/dead_cockroach.png';
        images.slipper.src = 'assets/slipper_64.png';

        class Cockroach {
            constructor() {
                this.size = Math.min(Math.max(40, 0.05 * width), 90);
                this.x = Math.random() * (width - this.size);
                this.y = Math.random() * (height - this.size);
                this.isDead = false;
                this.deadTime = 0;
                this.spawnTime = 0;
                this.markedForRemoval = false;
                this.opacity = 1;
                this.scale = 0;
                this.isPoppingUp = true;
            }

            draw() {
                if (!this.markedForRemoval && this.opacity > 0) {
                    ctx.save();
                    ctx.globalAlpha = this.opacity;
                    ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
                    ctx.scale(this.scale, this.scale);
                    ctx.translate(-this.size / 2, -this.size / 2);
                    ctx.drawImage(this.isDead ? images.deadCockroach : images.cockroach, 0, 0, this.size, this.size);
                    ctx.restore();
                }
            }

            update(deltaTime) {
                if (this.markedForRemoval) return false;

                if (this.isPoppingUp) {
                    this.spawnTime += deltaTime;
                    this.scale = Math.min(1, this.spawnTime / POPUP_DURATION);
                    if (this.scale >= 1) {
                        this.isPoppingUp = false;
                        this.spawnTime = 0;
                    }
                } else if (this.isDead) {
                    this.deadTime += deltaTime;
                    this.opacity = 1 - (this.deadTime / FADE_DURATION);
                    if (this.opacity <= 0 && !this.markedForRemoval) {
                        this.markedForRemoval = true;
                        removalQueue.push(this);
                        processRemovalQueue();
                        return false;
                    }
                } else {
                    this.spawnTime += deltaTime;
                    if (this.spawnTime > COCKROACH_LIFETIME && !this.markedForRemoval) {
                        this.markedForRemoval = true;
                        misses.push(new MissText(this.x + this.size / 2, this.y - 10));
                        removalQueue.push(this);
                        processRemovalQueue();
                        return false;
                    }
                }

                // Keep cockroaches within the game container bounds
                this.x = Math.max(0, Math.min(this.x, width - this.size));
                this.y = Math.max(0, Math.min(this.y, height - this.size));

                return true;
            }
        }

        class MissText {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.opacity = 1;
                this.time = 0;
            }

            draw() {
                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'White';
                ctx.shadowBlur = 2;
                ctx.fillText('Miss', this.x, this.y);
                ctx.restore();
            }

            update(deltaTime) {
                this.time += deltaTime;
                this.opacity = 1 - (this.time / MISS_DURATION);
                return this.opacity > 0;
            }
        }

        class MessageText {
            constructor(x, y, text) {
                this.x = x;
                this.y = y;
                this.text = text;
                this.opacity = 1;
                this.time = 0;
            }

            draw() {
                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.font = `bold ${clamp(20, 4 * width / 100, 24)}px Arial`;
                ctx.fillStyle = '#f6c6d9';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.text, this.x, this.y);
                ctx.restore();
            }

            update(deltaTime) {
                this.time += deltaTime;
                this.opacity = 1 - (this.time / MESSAGE_DURATION);
                return this.opacity > 0;
            }
        }

        function clamp(min, val, max) {
            return Math.min(Math.max(min, val), max);
        }

        function processRemovalQueue() {
            if (removalQueue.length > 0 && !isProcessingQueue) {
                isProcessingQueue = true;
                const cockroach = removalQueue.shift();
                cockroaches = cockroaches.filter(c => c !== cockroach);
                const delay = DISAPPEARANCE_MIN_INTERVAL + Math.random() * (DISAPPEARANCE_MAX_INTERVAL - DISAPPEARANCE_MIN_INTERVAL);
                setTimeout(() => {
                    isProcessingQueue = false;
                    processRemovalQueue();
                }, delay);
            }
        }

        function spawnCockroaches() {
            if (!gameOver && gameStarted) {
                for (let i = 0; i < spawnCount; i++) {
                    setTimeout(() => {
                        if (!gameOver && gameStarted) {
                            cockroaches.push(new Cockroach());
                        }
                    }, i * SPAWN_STAGGER_DELAY);
                }
                setTimeout(spawnCockroaches, spawnRate);
            }
        }

        function updateSpawnDifficulty() {
            if (!gameOver && gameStarted) {
                const oldSpawnRate = spawnRate;
                const oldSpawnCount = spawnCount;
                spawnRate = Math.max(500, spawnRate * 0.9);
                spawnCount = Math.min(5, spawnCount + 1);
                if (spawnRate !== oldSpawnRate || spawnCount !== oldSpawnCount) {
                    messages.push(new MessageText(width / 2, height / 2, 'Speed Spawn!'));
                }
            }
        }

        function resetGame(autoStart = false) {
            kills = 0;
            time = GAME_DURATION;
            spawnRate = width < 600 ? 2500 : 2000;
            spawnCount = 1;
            cockroaches = [];
            misses = [];
            messages = [];
            removalQueue = [];
            isProcessingQueue = false;
            gameOver = false;
            killsDisplay.textContent = kills;
            timerDisplay.textContent = Math.ceil(time / 1000);
            gameOverDiv.style.display = 'none';
            ctx.clearRect(0, 0, width, height);
            ensureSlipperCursor();

            if (autoStart) {
                gameStarted = true;
                startScreen.style.display = 'none';
                spawnCockroaches();
                if (!isMuted) {
                    bgMusic.play().catch(err => console.error('Background music error:', err));
                }
            } else {
                gameStarted = false;
                startScreen.style.display = 'block';
            }
        }

        canvas.addEventListener('click', (e) => {
            if (gameOver || !gameStarted) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX / window.devicePixelRatio;
            const clickY = (e.clientY - rect.top) * scaleY / window.devicePixelRatio;

            for (let i = cockroaches.length - 1; i >= 0; i--) {
                const c = cockroaches[i];
                if (!c.isDead && !c.markedForRemoval &&
                    clickX >= c.x && clickX <= c.x + c.size &&
                    clickY >= c.y && clickY <= c.y + c.size) {
                    c.isDead = true;
                    kills++;
                    killsDisplay.textContent = kills;
                    if (!isMuted) {
                        killSound.currentTime = 0;
                        killSound.play().catch(err => console.error('Kill sound error:', err));
                    }
                    break;
                }
            }
        });

        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
            bgMusic.muted = isMuted;
            killSound.muted = isMuted;
            if (!isMuted && bgMusic.paused) {
                bgMusic.play().catch(err => console.error('Background music error:', err));
            }
            ensureSlipperCursor();
        });

        startBtn.addEventListener('click', () => {
            resetGame(true);
        });

        playAgainBtn.addEventListener('click', () => {
            resetGame(true);
        });

        function checkOnlineStatus() {
            offlineDiv.style.display = navigator.onLine ? 'none' : 'block';
            ensureSlipperCursor();
        }

        window.addEventListener('online', checkOnlineStatus);
        window.addEventListener('offline', checkOnlineStatus);
        checkOnlineStatus();

        let lastTime = 0;
        function gameLoop(timestamp) {
            if (!gameStarted) {
                ctx.clearRect(0, 0, width, height);
                requestAnimationFrame(gameLoop);
                return;
            }

            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            if (!gameOver) {
                time -= deltaTime;
                const remainingSeconds = Math.ceil(time / 1000);
                timerDisplay.textContent = remainingSeconds;

                if (time <= 0) {
                    gameOver = true;
                    time = 0;
                    timerDisplay.textContent = 0;
                    if (kills > highScore) {
                        highScore = kills;
                        localStorage.setItem('highScore', highScore);
                    }
                    highScoreDisplay.textContent = highScore;
                    finalKillsDisplay.textContent = kills;
                    gameOverDiv.style.display = 'block';
                    ensureSlipperCursor();
                }
            }

            ctx.clearRect(0, 0, width, height);
            cockroaches.forEach(c => c.draw());
            misses.forEach(m => m.draw());
            messages.forEach(m => m.draw());
            cockroaches = cockroaches.filter(c => c.update(deltaTime));
            misses = misses.filter(m => m.update(deltaTime));
            messages = messages.filter(m => m.update(deltaTime));

            requestAnimationFrame(gameLoop);
        }

        setInterval(() => {
            if (!gameOver && gameStarted) {
                updateSpawnDifficulty();
            }
        }, 10000);

        bgMusic.addEventListener('error', (e) => {
            console.error('Error loading background music:', e);
        });
        killSound.addEventListener('error', (e) => {
            console.error('Error loading kill sound:', e);
        });

        images.slipper.onload = () => {
            console.log('Slipper image loaded.');
            resetGame();
            requestAnimationFrame(gameLoop);
        };
    