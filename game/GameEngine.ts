import { Vector2, EnemyType, Particle, StatHooks, Upgrade, CheckpointData, StoryBeat } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_ACCELERATION, PLAYER_FRICTION, PLAYER_MAX_SPEED, COLORS, BULLET_SPEED, FIRE_RATE, LOOP_DURATION, PLAYER_DASH_SPEED, PLAYER_DASH_DURATION, PLAYER_DASH_COOLDOWN, PLAYER_BASE_HP, PLAYER_NOVA_COOLDOWN, PLAYER_NOVA_RADIUS, PLAYER_NOVA_FORCE, XP_TO_OVERDRIVE, OVERDRIVE_DURATION, LORE_DATABASE, BOSS_LOOP_INTERVAL, BOSS_BASE_HP, STORY_BEATS } from './constants';
import { AudioSystem } from './AudioSystem';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hooks: StatHooks;
  audio: AudioSystem;

  // Game State
  isRunning: boolean = false;
  isPaused: boolean = false;
  isInCutscene: boolean = false;
  lastTime: number = 0;
  lastUiUpdate: number = 0;
  hitStop: number = 0; 
  globalTime: number = 0; 
  
  // Rendering
  dpr: number = 1;
  scaleRatio: number = 1;
  
  // World
  screenshake: number = 0;
  glitchIntensity: number = 0;

  // Loop
  loopTimer: number = LOOP_DURATION;
  loopCount: number = 1;
  loopMaxTime: number = LOOP_DURATION;
  warningTriggered: boolean = false;
  isBossLoop: boolean = false;
  hasSeenIntro: boolean = false;

  // Player
  player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: 12,
    hp: PLAYER_BASE_HP,
    maxHp: PLAYER_BASE_HP,
    xp: 0,
    overdriveTimer: 0,
    angle: 0,
    dashing: false,
    dashTimer: 0,
    dashCooldownTimer: 0,
    novaCooldownTimer: 0,
    fireTimer: 0,
    
    // Stats & Gear
    speedMult: 1, 
    damageMult: 1,
    fireRateMult: 1,
    projectileCount: 1,
    piercing: 0,
    dashCooldownMult: 1,
    homing: 0, 
    orbitals: 0,
    lifesteal: 0, // Chance to heal on kill
    gravDash: false, // Black hole dash
  };

  // Input
  keys: { [key: string]: boolean } = {};
  mouse: Vector2 = { x: 0, y: 0 };
  mouseDown: boolean = false;
  rightMouseDown: boolean = false;
  cachedRect: DOMRect | null = null;

  // Entities
  bullets: any[] = [];
  enemies: any[] = [];
  particles: Particle[] = [];
  damageNumbers: any[] = [];
  orbitals: any[] = []; 
  dashGhosts: any[] = []; 
  pickups: any[] = []; 
  gravWells: any[] = []; // Black holes

  // Gameplay Systems
  spawnTimer: number = 0;
  score: number = 0;
  difficultyMultiplier: number = 1;
  combo: number = 0;
  comboTimer: number = 0;
  abilityReadyPlayed: boolean = false;
  
  // Lore & Persistence
  unlockedLoreIds: Set<string> = new Set();
  
  // Cleanup
  eventListeners: { type: string, handler: any, target: any }[] = [];

  constructor(canvas: HTMLCanvasElement, hooks: StatHooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
    this.hooks = hooks;
    this.audio = new AudioSystem();
    
    this.initResolution();
    this.bindEvents();
    this.loadGlobalProgress();
  }
  
  initResolution() {
      this.dpr = window.devicePixelRatio || 1;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const scaleX = winW / CANVAS_WIDTH;
      const scaleY = winH / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      
      const cssW = Math.floor(CANVAS_WIDTH * scale);
      const cssH = Math.floor(CANVAS_HEIGHT * scale);
      
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
      
      this.canvas.width = Math.floor(cssW * this.dpr);
      this.canvas.height = Math.floor(cssH * this.dpr);
      
      this.scaleRatio = scale;
      this.ctx.scale(this.scaleRatio * this.dpr, this.scaleRatio * this.dpr);
      this.ctx.imageSmoothingEnabled = false; 
  }

  bindEvents() {
    const onKeyDown = (e: KeyboardEvent) => {
        if(e.code === 'Escape') {
            this.togglePause();
        }
        this.keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys[e.code] = false;
    const onResize = () => {
        this.initResolution();
        this.cachedRect = this.canvas.getBoundingClientRect();
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    this.eventListeners.push(
        { type: 'keydown', handler: onKeyDown, target: window },
        { type: 'keyup', handler: onKeyUp, target: window },
        { type: 'resize', handler: onResize, target: window }
    );
    
    const updateMouse = (e: MouseEvent) => {
        if (!this.cachedRect) this.cachedRect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - this.cachedRect.left) / this.scaleRatio;
        this.mouse.y = (e.clientY - this.cachedRect.top) / this.scaleRatio;
    };
    
    this.canvas.addEventListener('mousemove', updateMouse);
    this.canvas.addEventListener('mousedown', (e) => { 
        updateMouse(e); 
        if(e.button === 0) this.mouseDown = true; 
        if(e.button === 2) this.rightMouseDown = true;
    });
    this.canvas.addEventListener('mouseup', (e) => {
        if(e.button === 0) this.mouseDown = false;
        if(e.button === 2) this.rightMouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); 

    window.addEventListener('blur', () => {
         this.keys = {}; 
         if (this.isRunning && !this.isInCutscene) this.togglePause();
    });

    setTimeout(() => { this.cachedRect = this.canvas.getBoundingClientRect(); }, 100);
  }
  
  destroy() {
      this.stop();
      this.eventListeners.forEach(l => {
          l.target.removeEventListener(l.type, l.handler);
      });
      if (this.audio.ctx.state !== 'closed') {
          this.audio.ctx.close();
      }
  }

  togglePause() {
      if (this.isInCutscene) return;
      this.isPaused = !this.isPaused;
      this.lastTime = performance.now(); 
      this.hooks.onPauseToggle(this.isPaused);
      if(!this.isPaused) this.loop();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    
    if (this.audio.ctx.state === 'suspended') {
        this.audio.ctx.resume();
    }
    
    // Check Intro
    if (!this.hasSeenIntro) {
        this.playCutscene(STORY_BEATS.INTRO);
        this.hasSeenIntro = true;
        this.saveGlobalProgress();
    } else {
        this.saveCheckpoint(); // Initial Save
    }
    
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  reset() {
    this.player.x = CANVAS_WIDTH / 2;
    this.player.y = CANVAS_HEIGHT / 2;
    this.player.hp = PLAYER_BASE_HP; // Use base HP on full reset
    this.player.maxHp = PLAYER_BASE_HP;
    this.player.xp = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.dashing = false;
    this.player.novaCooldownTimer = 0;
    this.player.overdriveTimer = 0;
    
    // Stats Reset
    this.player.speedMult = 1;
    this.player.damageMult = 1;
    this.player.fireRateMult = 1;
    this.player.projectileCount = 1;
    this.player.piercing = 0;
    this.player.homing = 0;
    this.player.orbitals = 0;
    this.player.lifesteal = 0;
    this.player.gravDash = false;

    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.orbitals = [];
    this.dashGhosts = [];
    this.pickups = [];
    this.gravWells = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.loopCount = 1;
    this.loopTimer = LOOP_DURATION;
    this.difficultyMultiplier = 1;
    this.hitStop = 0;
    this.warningTriggered = false;
    this.isBossLoop = false;
    this.abilityReadyPlayed = false;
    
    this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
    this.hooks.onScoreChange(0);
    this.hooks.onXpChange(0, XP_TO_OVERDRIVE, 0);
    this.hooks.onAbilityCooldown(0, PLAYER_NOVA_COOLDOWN);
  }

  // --- PERSISTENCE ---

  saveCheckpoint() {
      const data: CheckpointData = {
          loop: this.loopCount,
          score: this.score,
          playerStats: {
              hp: this.player.hp,
              maxHp: this.player.maxHp,
              xp: this.player.xp,
              speedMult: this.player.speedMult,
              damageMult: this.player.damageMult,
              fireRateMult: this.player.fireRateMult,
              projectileCount: this.player.projectileCount,
              piercing: this.player.piercing,
              dashCooldownMult: this.player.dashCooldownMult,
              homing: this.player.homing,
              orbitals: this.player.orbitals,
              lifesteal: this.player.lifesteal,
              gravDash: this.player.gravDash,
          },
          collectedLore: Array.from(this.unlockedLoreIds)
      };
      localStorage.setItem('neon_loop_checkpoint', JSON.stringify(data));
      // Visual feedback
      this.createDamageNumber(CANVAS_WIDTH/2, CANVAS_HEIGHT - 100, 0); // Hacky way to show text, ideally add a toast
  }

  loadCheckpoint() {
      const raw = localStorage.getItem('neon_loop_checkpoint');
      if (raw) {
          const data: CheckpointData = JSON.parse(raw);
          this.loopCount = data.loop;
          this.score = data.score;
          this.difficultyMultiplier = 1 + (this.loopCount * 0.2);
          
          this.player.hp = data.playerStats.hp;
          this.player.maxHp = data.playerStats.maxHp;
          this.player.xp = data.playerStats.xp;
          this.player.speedMult = data.playerStats.speedMult;
          this.player.damageMult = data.playerStats.damageMult;
          this.player.fireRateMult = data.playerStats.fireRateMult;
          this.player.projectileCount = data.playerStats.projectileCount;
          this.player.piercing = data.playerStats.piercing;
          this.player.dashCooldownMult = data.playerStats.dashCooldownMult;
          this.player.homing = data.playerStats.homing;
          this.player.orbitals = data.playerStats.orbitals;
          this.player.lifesteal = data.playerStats.lifesteal || 0;
          this.player.gravDash = data.playerStats.gravDash || false;
          
          this.unlockedLoreIds = new Set(data.collectedLore);
          
          // Reset Entities
          this.player.x = CANVAS_WIDTH/2;
          this.player.y = CANVAS_HEIGHT/2;
          this.enemies = [];
          this.bullets = [];
          this.particles = [];
          this.pickups = [];
          this.gravWells = [];
          this.loopTimer = LOOP_DURATION;
          this.isBossLoop = this.loopCount % BOSS_LOOP_INTERVAL === 0;

          if (this.isBossLoop) this.spawnBoss();

          this.start();
          this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
          this.hooks.onLoopChange(this.loopCount, this.loopTimer, this.loopMaxTime);
      } else {
          this.reset();
          this.start();
      }
  }

  saveGlobalProgress() {
      localStorage.setItem('neon_loop_intro', JSON.stringify({ seen: this.hasSeenIntro }));
  }

  loadGlobalProgress() {
      const raw = localStorage.getItem('neon_loop_intro');
      if (raw) {
          const data = JSON.parse(raw);
          this.hasSeenIntro = data.seen;
      }
  }
  
  playCutscene(beat: StoryBeat) {
      this.isInCutscene = true;
      this.hooks.onStoryTrigger(beat);
  }

  resumeFromCutscene() {
      this.isInCutscene = false;
      this.lastTime = performance.now(); // avoid big delta
  }

  // --- MAIN LOOP ---

  loop = () => {
    if (!this.isRunning || this.isPaused || this.isInCutscene) return;

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (dt > 0.05) dt = 0.05;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    this.globalTime += dt;

    if (this.hitStop > 0) {
        this.hitStop -= dt;
        if (this.screenshake > 0) this.screenshake -= 30 * dt;
        return; 
    }

    this.loopTimer -= dt;
    const timePressure = 1 - (this.loopTimer / this.loopMaxTime);
    this.glitchIntensity = Math.max(0, (timePressure - 0.7) * 3);

    if (this.loopTimer <= 10 && this.loopTimer > 0) {
        if (!this.warningTriggered) {
             this.warningTriggered = true;
             this.hooks.onDangerWarning();
        }
        if (Math.floor(this.loopTimer) !== Math.floor(this.loopTimer + dt)) {
             this.audio.play('alert');
        }
    }

    if (this.loopTimer <= 0) {
      if (!this.isBossLoop) {
        this.triggerLoopReset();
      } else {
         this.glitchIntensity = 1.0;
         if (this.loopTimer < -5 && this.loopTimer % 1 > -0.05) {
             this.takeDamage(5); 
         }
      }
    }
    
    const now = performance.now();
    if (now - this.lastUiUpdate > 100) {
        this.hooks.onLoopChange(this.loopCount, this.loopTimer, this.loopMaxTime);
        this.hooks.onAbilityCooldown(Math.max(0, this.player.novaCooldownTimer), PLAYER_NOVA_COOLDOWN);
        this.lastUiUpdate = now;
    }

    if (this.player.novaCooldownTimer <= 0 && !this.abilityReadyPlayed) {
        this.audio.play('cooldownReady');
        this.abilityReadyPlayed = true;
    }
    if (this.player.novaCooldownTimer > 0) {
        this.abilityReadyPlayed = false;
    }

    if (this.player.overdriveTimer > 0) {
        this.player.overdriveTimer -= dt;
        if (this.player.overdriveTimer % 0.5 < dt) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
            this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
            this.createDamageNumber(this.player.x, this.player.y - 30, 2);
        }
    }

    // --- Movement ---
    let dx = 0;
    let dy = 0;
    if (this.keys['KeyW']) dy -= 1;
    if (this.keys['KeyS']) dy += 1;
    if (this.keys['KeyA']) dx -= 1;
    if (this.keys['KeyD']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    // Dash
    if (this.keys['Space'] && this.player.dashCooldownTimer <= 0 && !this.player.dashing) {
      this.player.dashing = true;
      this.player.dashTimer = PLAYER_DASH_DURATION;
      this.player.dashCooldownTimer = PLAYER_DASH_COOLDOWN * this.player.dashCooldownMult;
      
      const dashDirX = dx || (this.player.vx === 0 ? 1 : Math.sign(this.player.vx));
      const dashDirY = dy || (this.player.vy === 0 ? 0 : Math.sign(this.player.vy));
      
      this.player.vx = dashDirX * PLAYER_DASH_SPEED;
      this.player.vy = dashDirY * PLAYER_DASH_SPEED;
      
      this.createParticles(this.player.x, this.player.y, 12, COLORS.player);
      this.screenshake = 5;
      this.audio.play('dash');

      // GRAV DASH ABILITY
      if (this.player.gravDash) {
          this.gravWells.push({
              x: this.player.x, y: this.player.y,
              life: 1.5, radius: 150, force: 1000
          });
          this.audio.play('nova'); // Re-use sound
      }
    }

    if ((this.keys['KeyE'] || this.rightMouseDown) && this.player.novaCooldownTimer <= 0) {
        this.triggerNova();
    }
    this.player.novaCooldownTimer -= dt;

    if (this.player.dashing) {
      this.player.dashTimer -= dt;
      const trailDensity = 2; 
      for (let i = 0; i < trailDensity; i++) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 10,
          y: this.player.y + (Math.random() - 0.5) * 10,
          vx: -this.player.vx * 0.1 + (Math.random() - 0.5) * 50, 
          vy: -this.player.vy * 0.1 + (Math.random() - 0.5) * 50,
          life: 0.2 + Math.random() * 0.2,
          maxLife: 0.4,
          color: '#e0ffff', 
          size: Math.random() * 3 + 2
        });
      }

      if (this.player.dashTimer % 0.04 < dt) {
          this.dashGhosts.push({
              x: this.player.x, y: this.player.y, 
              radius: this.player.radius, 
              life: 0.3, maxLife: 0.3,
              opacity: 0.4
          });
      }

      if (this.player.dashTimer <= 0) {
        this.player.dashing = false;
        this.player.vx *= 0.5; 
        this.player.vy *= 0.5;
      }
    } else {
      if (dx !== 0 || dy !== 0) {
          this.player.vx += dx * PLAYER_ACCELERATION * dt;
          this.player.vy += dy * PLAYER_ACCELERATION * dt;
          
          let speedCap = PLAYER_MAX_SPEED * this.player.speedMult;
          if (this.player.overdriveTimer > 0) speedCap *= 1.3;

          const currentSpeed = Math.hypot(this.player.vx, this.player.vy);
          if (currentSpeed > speedCap) {
              const scale = speedCap / currentSpeed;
              this.player.vx *= scale;
              this.player.vy *= scale;
          }
      } else {
          this.player.vx *= PLAYER_FRICTION;
          this.player.vy *= PLAYER_FRICTION;
      }
    }

    this.player.dashCooldownTimer -= dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    this.player.x = Math.max(this.player.radius, Math.min(CANVAS_WIDTH - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(CANVAS_HEIGHT - this.player.radius, this.player.y));

    this.player.angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);

    // --- Orbitals ---
    while(this.orbitals.length < this.player.orbitals) {
        this.orbitals.push({ angle: (Math.PI * 2 / (this.player.orbitals || 1)) * this.orbitals.length });
    }
    const orbitalRadius = 60;
    const orbitalSpeed = 3;
    let hitOrbital = false;
    for(let i=0; i<this.orbitals.length; i++) {
        const orb = this.orbitals[i];
        orb.angle += orbitalSpeed * dt;
        orb.x = this.player.x + Math.cos(orb.angle) * orbitalRadius;
        orb.y = this.player.y + Math.sin(orb.angle) * orbitalRadius;
        
        for(const enemy of this.enemies) {
            const dist = Math.hypot(orb.x - enemy.x, orb.y - enemy.y);
            if(dist < 15 + enemy.radius) {
                enemy.hp -= 200 * dt; 
                if(enemy.hp <= 0) this.killEnemy(enemy);
                this.createParticles(orb.x, orb.y, 1, '#00ffff');
                hitOrbital = true;
            }
        }
    }
    if (hitOrbital && this.globalTime % 0.2 < dt) {
        this.audio.play('orbitalHit');
    }

    // --- Grav Wells ---
    for(let i=this.gravWells.length-1; i>=0; i--) {
        const gw = this.gravWells[i];
        gw.life -= dt;
        // Pull enemies
        for(const e of this.enemies) {
            if(e.type === EnemyType.BOSS) continue;
            const dist = Math.hypot(gw.x - e.x, gw.y - e.y);
            if(dist < gw.radius) {
                const angle = Math.atan2(gw.y - e.y, gw.x - e.x);
                e.vx += Math.cos(angle) * gw.force * dt;
                e.vy += Math.sin(angle) * gw.force * dt;
            }
        }
        // Visual
        if(Math.random() < 0.5) this.createParticles(gw.x + (Math.random()-0.5)*20, gw.y + (Math.random()-0.5)*20, 1, '#8800ff');
        
        if(gw.life <= 0) {
            this.gravWells.splice(i, 1);
        }
    }

    this.player.fireTimer -= dt;
    if (this.mouseDown && this.player.fireTimer <= 0) {
      this.fireBullet();
      let rate = FIRE_RATE / this.player.fireRateMult;
      if (this.player.overdriveTimer > 0) rate *= 0.6; 
      this.player.fireTimer = rate;
    }

    // --- Bullets ---
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.isEnemy) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;
          if (b.life <= 0 || b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
            this.bullets[i] = this.bullets[this.bullets.length - 1];
            this.bullets.pop();
            continue;
          }
          const distSq = (b.x - this.player.x) ** 2 + (b.y - this.player.y) ** 2;
          const radSum = this.player.radius + b.radius;
          if (distSq < radSum * radSum) {
              if (!this.player.dashing) {
                  this.takeDamage(b.damage);
                  this.createParticles(this.player.x, this.player.y, 5, COLORS.player);
                  this.bullets[i] = this.bullets[this.bullets.length - 1];
                  this.bullets.pop();
              }
              continue; 
          }
          continue; 
      }

      // Player Bullet Homing
      if (this.player.homing > 0) {
          let closest = null;
          let closestDist = 400; 
          for(const e of this.enemies) {
              const d = Math.hypot(e.x - b.x, e.y - b.y);
              if (d < closestDist) { closestDist = d; closest = e; }
          }
          if (closest) {
              const targetAngle = Math.atan2(closest.y - b.y, closest.x - b.x);
              let angle = Math.atan2(b.vy, b.vx);
              const steer = 5 * dt;
              let diff = targetAngle - angle;
              while (diff < -Math.PI) diff += Math.PI*2;
              while (diff > Math.PI) diff -= Math.PI*2;
              angle += Math.sign(diff) * Math.min(Math.abs(diff), steer);
              const speed = Math.hypot(b.vx, b.vy);
              b.vx = Math.cos(angle) * speed;
              b.vy = Math.sin(angle) * speed;
          }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
        this.bullets[i] = this.bullets[this.bullets.length - 1];
        this.bullets.pop();
        continue;
      }

      let hit = false;
      for (const enemy of this.enemies) {
        const distSq = (b.x - enemy.x) ** 2 + (b.y - enemy.y) ** 2;
        const radSum = enemy.radius + b.radius;
        if (distSq < radSum * radSum) {
          let dmg = b.damage;
          if (this.player.overdriveTimer > 0) dmg *= 1.5;
          enemy.hp -= dmg;
          this.createDamageNumber(enemy.x, enemy.y, Math.round(dmg));
          this.createParticles(b.x, b.y, 2, COLORS.bullet);
          hit = true;
          if (enemy.hp <= 0) {
            this.killEnemy(enemy);
          }
          break; 
        }
      }
      if (hit && this.player.piercing === 0) {
        this.bullets[i] = this.bullets[this.bullets.length - 1];
        this.bullets.pop();
      }
    }

    // --- Enemies ---
    this.spawnTimer -= dt;
    const bossAlive = this.enemies.some(e => e.type === EnemyType.BOSS);
    
    if (this.spawnTimer <= 0 && !bossAlive) {
      this.spawnEnemy();
      this.spawnTimer = (1.5 / Math.sqrt(this.loopCount)) * (1 / this.difficultyMultiplier); 
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.type === EnemyType.BOSS) {
          e.attackTimer -= dt;
          const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
          const targetX = distToPlayer > 300 ? this.player.x : e.x;
          const targetY = distToPlayer > 300 ? this.player.y : e.y;
          const angle = Math.atan2(targetY - e.y, targetX - e.x);
          e.vx += Math.cos(angle) * e.acceleration * dt;
          e.vy += Math.sin(angle) * e.acceleration * dt;
          const currentSpeed = Math.hypot(e.vx, e.vy);
          if(currentSpeed > e.maxSpeed) {
              e.vx *= 0.98; e.vy *= 0.98;
          }
          if (e.attackTimer < 0.5 && e.attackTimer > 0.4) {
             this.audio.play('bossCharge');
          }
          if (e.attackTimer <= 0) {
              const pattern = Math.random();
              if (pattern < 0.4) {
                  for(let k=0; k<16; k++) {
                      const fireAngle = (Math.PI * 2 / 16) * k + performance.now()/1000;
                      this.bullets.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(fireAngle) * 300,
                        vy: Math.sin(fireAngle) * 300,
                        radius: 8, life: 5, damage: 20, isEnemy: true, color: COLORS.enemyBullet
                      });
                  }
                  this.audio.play('enemyShoot');
                  e.attackTimer = 1.5;
              } else if (pattern < 0.7) {
                   const fireAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
                   for(let k=0; k<3; k++) {
                       setTimeout(() => {
                           this.bullets.push({
                               x: e.x, y: e.y,
                               vx: Math.cos(fireAngle + (Math.random()-0.5)*0.2) * 500,
                               vy: Math.sin(fireAngle + (Math.random()-0.5)*0.2) * 500,
                               radius: 8, life: 4, damage: 15, isEnemy: true, color: COLORS.enemyBullet
                           });
                           this.audio.play('enemyShoot');
                       }, k * 100);
                   }
                   e.attackTimer = 1.0;
              } else {
                  for(let k=0; k<2; k++) {
                      const spawnAngle = Math.random() * Math.PI * 2;
                      const sx = e.x + Math.cos(spawnAngle) * 80;
                      const sy = e.y + Math.sin(spawnAngle) * 80;
                      this.enemies.push({
                          x: sx, y: sy, vx: 0, vy: 0,
                          type: EnemyType.SWARMER, hp: 30 * this.loopCount, radius: 15, color: COLORS.enemySwarmer,
                          acceleration: 800, maxSpeed: 150 + (this.loopCount * 10), state: 'IDLE', attackTimer: 0
                      });
                      this.createParticles(sx, sy, 5, COLORS.enemySwarmer);
                  }
                  e.attackTimer = 3.0;
              }
          }
      } else {
          let targetX = this.player.x;
          let targetY = this.player.y;
          let desiredSpeed = e.maxSpeed;
          if (e.type === EnemyType.SNIPER) {
              const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
              e.attackTimer -= dt;
              if (e.state === 'CHARGING') {
                  desiredSpeed = 0; 
                  if (e.attackTimer <= 0) {
                      e.state = 'DASHING';
                      e.attackTimer = 0.5; 
                      const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
                      e.vx = Math.cos(angle) * 900;
                      e.vy = Math.sin(angle) * 900;
                  }
              } else if (e.state === 'DASHING') {
                  desiredSpeed = 0; 
                  if (e.attackTimer <= 0) {
                      e.state = 'IDLE';
                      e.attackTimer = 2.0;
                  }
              } else {
                  if (distToPlayer < 300) desiredSpeed = 0;
                  if (e.attackTimer <= 0) {
                      e.state = 'CHARGING';
                      e.attackTimer = 1.0;
                  }
              }
          } else if (e.type === EnemyType.GUNNER) {
               const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
               e.attackTimer -= dt;
               if (distToPlayer < 400) {
                   desiredSpeed = 0; 
                   if (e.attackTimer <= 0) {
                       this.fireEnemyBullet(e);
                       e.attackTimer = 2.5; 
                   }
               }
          }
          if ((e.type !== EnemyType.SNIPER || e.state === 'IDLE') && (e.type !== EnemyType.GUNNER || desiredSpeed > 0)) {
              const angle = Math.atan2(targetY - e.y, targetX - e.x);
              e.vx += Math.cos(angle) * e.acceleration * dt;
              e.vy += Math.sin(angle) * e.acceleration * dt;
               const currentSpeed = Math.hypot(e.vx, e.vy);
               if (currentSpeed > desiredSpeed) {
                  e.vx *= 0.95;
                  e.vy *= 0.95;
               }
          }
      }
      if (Math.random() < 0.3) {
          for (let j = 0; j < this.enemies.length; j++) {
            if (i === j) continue;
            const other = this.enemies[j];
            if (Math.abs(e.x - other.x) > 50 || Math.abs(e.y - other.y) > 50) continue;
            const distSq = (e.x - other.x)**2 + (e.y - other.y)**2;
            const radSum = e.radius + other.radius;
            if (distSq < radSum * radSum) {
              const pushAngle = Math.atan2(e.y - other.y, e.x - other.x);
              const pushForce = 300 * dt; 
              e.vx += Math.cos(pushAngle) * pushForce;
              e.vy += Math.sin(pushAngle) * pushForce;
            }
          }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const distSqToPlayer = (e.x - this.player.x)**2 + (e.y - this.player.y)**2;
      const radSumPlayer = e.radius + this.player.radius;
      if (distSqToPlayer < radSumPlayer * radSumPlayer) {
        if (!this.player.dashing) {
          this.takeDamage(e.type === EnemyType.BOSS ? 25 : 10);
          const pushAngle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
          e.vx += Math.cos(pushAngle) * 500;
          e.vy += Math.sin(pushAngle) * 500;
          this.player.vx -= Math.cos(pushAngle) * 500;
          this.player.vy -= Math.sin(pushAngle) * 500;
          this.screenshake = 10;
        } else {
            if (e.type !== EnemyType.BOSS) {
                e.hp -= 50; 
                if (e.hp <= 0) this.killEnemy(e);
            } else {
                e.hp -= 25;
                const pushAngle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                this.player.vx -= Math.cos(pushAngle) * 1000;
                this.player.vy -= Math.sin(pushAngle) * 1000;
            }
        }
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        p.y += Math.sin(performance.now() / 200) * 0.5 * dt; 
        const magnetRange = this.player.overdriveTimer > 0 ? 300 : 120; 
        const distToPlayer = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        if (distToPlayer < magnetRange) {
            const pullSpeed = this.player.overdriveTimer > 0 ? 15 : 8;
            p.x += (this.player.x - p.x) * pullSpeed * dt;
            p.y += (this.player.y - p.y) * pullSpeed * dt;
        }
        if (distToPlayer < this.player.radius + 15) {
            if (p.type === 'HEALTH') {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
                this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
                this.createDamageNumber(this.player.x, this.player.y - 20, 20); 
                this.createParticles(this.player.x, this.player.y, 10, COLORS.pickupHealth);
                this.audio.play('powerup');
            } else if (p.type === 'XP') {
                if (this.player.overdriveTimer <= 0) {
                    this.player.xp += 1;
                    if (this.player.xp >= XP_TO_OVERDRIVE) {
                        this.activateOverdrive();
                    }
                    this.hooks.onXpChange(this.player.xp, XP_TO_OVERDRIVE, 0);
                }
                this.createParticles(this.player.x, this.player.y, 5, COLORS.pickupXp);
                this.audio.play('xp');
            } else if (p.type === 'DATA') {
                const available = LORE_DATABASE.filter(l => !this.unlockedLoreIds.has(l.id));
                if (available.length > 0) {
                    const lore = available[Math.floor(Math.random() * available.length)];
                    this.unlockedLoreIds.add(lore.id);
                    this.hooks.onLoreUnlock({ ...lore, unlocked: true });
                    this.togglePause(); 
                } else {
                    this.createDamageNumber(this.player.x, this.player.y, 100);
                    this.player.xp += 25;
                }
                this.createParticles(this.player.x, this.player.y, 20, COLORS.pickupLore);
                this.audio.play('lore');
            }
            this.pickups[i] = this.pickups[this.pickups.length - 1];
            this.pickups.pop();
        }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
          this.particles[i] = this.particles[this.particles.length - 1];
          this.particles.pop();
      }
    }
    
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
        const g = this.dashGhosts[i];
        g.life -= dt;
        if(g.life <= 0) {
            this.dashGhosts[i] = this.dashGhosts[this.dashGhosts.length-1];
            this.dashGhosts.pop();
        }
    }

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
        const d = this.damageNumbers[i];
        d.y -= 20 * dt;
        d.life -= dt;
        if (d.life <= 0) {
            this.damageNumbers[i] = this.damageNumbers[this.damageNumbers.length - 1];
            this.damageNumbers.pop();
        }
    }

    if (this.combo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
            this.combo = 0;
        }
    }

    if (this.screenshake > 0) {
      this.screenshake -= 30 * dt;
      if (this.screenshake < 0) this.screenshake = 0;
    }
  }

  activateOverdrive() {
      this.player.overdriveTimer = OVERDRIVE_DURATION;
      this.player.xp = 0;
      this.hooks.onXpChange(XP_TO_OVERDRIVE, XP_TO_OVERDRIVE, 0); 
      this.screenshake = 10;
      this.audio.play('overdrive');
      this.createParticles(this.player.x, this.player.y, 30, COLORS.glitch);
  }

  triggerNova() {
      this.player.novaCooldownTimer = PLAYER_NOVA_COOLDOWN;
      this.audio.play('nova');
      this.screenshake = 15;
      this.hitStop = 0.1;
      this.hooks.onAbilityCooldown(PLAYER_NOVA_COOLDOWN, PLAYER_NOVA_COOLDOWN);
      this.createParticles(this.player.x, this.player.y, 40, '#ffffff');
      for (let i = this.bullets.length - 1; i >= 0; i--) {
          const b = this.bullets[i];
          if (!b.isEnemy) continue;
          const dist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          if (dist < PLAYER_NOVA_RADIUS) {
               this.createParticles(b.x, b.y, 3, COLORS.enemyBullet);
               this.bullets[i] = this.bullets[this.bullets.length - 1];
               this.bullets.pop();
          }
      }
      for (const e of this.enemies) {
           const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
           if (dist < PLAYER_NOVA_RADIUS) {
               e.hp -= 25; 
               const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
               e.vx += Math.cos(angle) * PLAYER_NOVA_FORCE;
               e.vy += Math.sin(angle) * PLAYER_NOVA_FORCE;
               if (e.hp <= 0) this.killEnemy(e);
           }
      }
  }

  fireEnemyBullet(enemy: any) {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    this.bullets.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * 350,
        vy: Math.sin(angle) * 350,
        radius: 6,
        life: 4,
        damage: 15,
        isEnemy: true,
        color: COLORS.enemyBullet
    });
    this.audio.play('enemyShoot');
  }

  fireBullet() {
    const speed = BULLET_SPEED;
    const offset = 0.1; 
    const count = this.player.overdriveTimer > 0 ? this.player.projectileCount + 1 : this.player.projectileCount; 

    for(let i=0; i<count; i++) {
        const spreadAngle = (Math.random() - 0.5) * offset * (count > 1 ? 2 : 0.5);
        const finalAngle = this.player.angle + spreadAngle;

        this.bullets.push({
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(finalAngle) * speed,
            vy: Math.sin(finalAngle) * speed,
            radius: 4,
            life: 2,
            damage: 25 * this.player.damageMult,
            isEnemy: false,
            color: this.player.overdriveTimer > 0 ? '#ff00ff' : COLORS.bullet 
        });
    }
    this.screenshake = 2;
    this.audio.play('shoot');
  }

  spawnBoss() {
      this.enemies = [];
      this.enemies.push({
          x: CANVAS_WIDTH / 2, 
          y: -100, 
          vx: 0, vy: 100,
          type: EnemyType.BOSS,
          hp: BOSS_BASE_HP * (1 + this.loopCount * 0.5), 
          maxHp: BOSS_BASE_HP * (1 + this.loopCount * 0.5),
          radius: 40,
          color: COLORS.enemyBoss,
          acceleration: 300,
          maxSpeed: 80,
          state: 'IDLE',
          attackTimer: 2.0
      });
      this.screenshake = 20;
      this.audio.play('bossSpawn');
      this.playCutscene(STORY_BEATS.BOSS_APPROACH);
  }

  spawnEnemy() {
    const typeRoll = Math.random();
    let type = EnemyType.SWARMER;
    let hp = 30;
    let radius = 15;
    let color = COLORS.enemySwarmer;
    let accel = 800;
    let maxSpeed = 150;
    
    const difficulty = this.loopCount * this.difficultyMultiplier;

    if (difficulty > 2 && typeRoll > 0.6) {
        type = EnemyType.DASHER;
        hp = 50;
        color = COLORS.enemyDasher;
        accel = 1500;
        maxSpeed = 250;
    } 
    if (difficulty > 4 && typeRoll > 0.8) {
        type = EnemyType.SNIPER;
        hp = 40;
        color = COLORS.enemySniper;
        maxSpeed = 120;
    }
    if (difficulty > 6 && typeRoll > 0.9) {
        type = EnemyType.GUNNER;
        hp = 80;
        color = COLORS.enemyGunner;
        maxSpeed = 100;
        radius = 20;
    }
    if (difficulty > 8 && typeRoll > 0.95) {
        type = EnemyType.TANK;
        hp = 200;
        color = COLORS.enemyTank;
        maxSpeed = 60;
        radius = 25;
    }

    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -50 : CANVAS_WIDTH + 50;
        y = Math.random() * CANVAS_HEIGHT;
    } else {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() < 0.5 ? -50 : CANVAS_HEIGHT + 50;
    }

    this.enemies.push({
        x, y, vx: 0, vy: 0,
        type,
        hp: hp * (1 + (this.loopCount - 1) * 0.2), 
        maxHp: hp * (1 + (this.loopCount - 1) * 0.2),
        radius,
        color,
        acceleration: accel,
        maxSpeed: maxSpeed + (this.loopCount * 5),
        state: 'IDLE',
        attackTimer: Math.random() * 2 
    });
  }

  killEnemy(enemy: any) {
    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
        this.enemies.splice(index, 1);
    }
    
    this.audio.play('explosion');
    this.createParticles(enemy.x, enemy.y, 10, enemy.color);
    this.score += 100 * this.combo;
    this.combo += 1;
    this.comboTimer = 2.0;
    this.hooks.onScoreChange(this.score);

    // Lifesteal Logic
    if (this.player.lifesteal > 0 && Math.random() < this.player.lifesteal) {
        this.pickups.push({ x: enemy.x, y: enemy.y, type: 'HEALTH' });
    }

    if (Math.random() < 0.1) {
        this.pickups.push({ x: enemy.x, y: enemy.y, type: 'HEALTH' });
    } else if (Math.random() < 0.05) {
        this.pickups.push({ x: enemy.x, y: enemy.y, type: 'DATA' });
    } else {
        this.pickups.push({ x: enemy.x, y: enemy.y, type: 'XP' });
    }

    if (enemy.type === EnemyType.BOSS) {
        this.isBossLoop = false;
        this.triggerLoopReset();
    }
  }

  takeDamage(amount: number) {
      if (this.player.hp <= 0) return;
      
      this.player.hp -= amount;
      this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
      this.createDamageNumber(this.player.x, this.player.y, amount);
      this.screenshake = 10;
      this.audio.play('hit');
      this.createParticles(this.player.x, this.player.y, 10, COLORS.player);
      
      if (this.player.hp <= 0) {
          this.hooks.onGameOver({ score: this.score });
          this.audio.play('explosion');
      }
  }

  triggerLoopReset() {
      // Check for story events
      if (this.loopCount === 1) {
          this.playCutscene(STORY_BEATS.LOOP_1_END);
      }

      this.loopCount++;
      this.loopTimer = LOOP_DURATION;
      this.loopMaxTime = LOOP_DURATION;
      this.difficultyMultiplier += 0.2;
      this.warningTriggered = false;
      
      this.saveCheckpoint(); // Auto-save

      if (this.loopCount % BOSS_LOOP_INTERVAL === 0) {
          this.isBossLoop = true;
          this.spawnBoss();
      } else {
          this.hooks.onLevelUp(); 
      }
      
      this.hooks.onLoopChange(this.loopCount, this.loopTimer, this.loopMaxTime);
  }

  createDamageNumber(x: number, y: number, amount: number) {
      this.damageNumbers.push({
          x, y, text: amount.toString(), life: 0.8, color: '#fff'
      });
  }

  createParticles(x: number, y: number, count: number, color: string) {
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 200 + 50;
          this.particles.push({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 0.3 + Math.random() * 0.3,
              maxLife: 0.6,
              color: color,
              size: Math.random() * 3 + 1
          });
      }
  }
  
  applyUpgrade(upgrade: Upgrade) {
      upgrade.apply(this);
      this.audio.play('powerup');
      this.saveCheckpoint(); // Save after upgrades
  }

  draw() {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.ctx.save();
    if (this.screenshake > 0) {
        const dx = (Math.random() - 0.5) * this.screenshake;
        const dy = (Math.random() - 0.5) * this.screenshake;
        this.ctx.translate(dx, dy);
    }
    
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for(let x=0; x<=CANVAS_WIDTH; x+=40) {
        this.ctx.moveTo(x, 0); this.ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for(let y=0; y<=CANVAS_HEIGHT; y+=40) {
        this.ctx.moveTo(0, y); this.ctx.lineTo(CANVAS_WIDTH, y);
    }
    this.ctx.stroke();
    
    if (this.glitchIntensity > 0) {
        this.ctx.fillStyle = `rgba(255, 0, 255, ${this.glitchIntensity * 0.05})`;
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Grav Wells
    for(const gw of this.gravWells) {
        this.ctx.fillStyle = `rgba(100, 0, 255, ${gw.life * 0.2})`;
        this.ctx.beginPath();
        this.ctx.arc(gw.x, gw.y, gw.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#8800ff';
        this.ctx.stroke();
    }

    for(const p of this.pickups) {
        this.ctx.fillStyle = p.type === 'HEALTH' ? COLORS.pickupHealth : (p.type === 'XP' ? COLORS.pickupXp : COLORS.pickupLore);
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.shadowColor = this.ctx.fillStyle;
        this.ctx.shadowBlur = 10;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    for(const g of this.dashGhosts) {
        this.ctx.fillStyle = COLORS.player;
        this.ctx.globalAlpha = g.opacity * (g.life / g.maxLife);
        this.ctx.beginPath();
        this.ctx.arc(g.x, g.y, g.radius, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
    }

    for(const p of this.particles) {
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life / p.maxLife;
        this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        this.ctx.globalAlpha = 1;
    }

    for(const e of this.enemies) {
        this.ctx.fillStyle = e.color;
        this.ctx.beginPath();
        if (e.type === EnemyType.BOSS) {
             this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
             this.ctx.fill();
             this.ctx.strokeStyle = '#fff';
             this.ctx.lineWidth = 2;
             this.ctx.stroke();
        } else {
             this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
             this.ctx.fill();
        }
        
        if (e.maxHp && e.hp < e.maxHp) {
            const w = 40;
            const h = 4;
            this.ctx.fillStyle = 'red';
            this.ctx.fillRect(e.x - w/2, e.y - e.radius - 10, w, h);
            this.ctx.fillStyle = 'green';
            this.ctx.fillRect(e.x - w/2, e.y - e.radius - 10, w * (e.hp/e.maxHp), h);
        }
    }

    this.ctx.fillStyle = this.player.overdriveTimer > 0 ? COLORS.glitch : COLORS.player;
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.rotate(this.player.angle);
    this.ctx.beginPath();
    this.ctx.moveTo(15, 0);
    this.ctx.lineTo(-10, 10);
    this.ctx.lineTo(-10, -10);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.fillStyle = '#00ffff';
    for(const orb of this.orbitals) {
        this.ctx.beginPath();
        this.ctx.arc(orb.x, orb.y, 5, 0, Math.PI*2);
        this.ctx.fill();
    }

    for(const b of this.bullets) {
        this.ctx.fillStyle = b.color;
        this.ctx.beginPath();
        this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        this.ctx.fill();
    }
    
    this.ctx.font = 'bold 20px monospace';
    this.ctx.textAlign = 'center';
    for(const d of this.damageNumbers) {
        this.ctx.fillStyle = d.color;
        this.ctx.globalAlpha = d.life;
        this.ctx.fillText(d.text, d.x, d.y);
        this.ctx.globalAlpha = 1;
    }
    
    this.ctx.restore();
  }
}