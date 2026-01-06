import { Vector2, EnemyType, Particle, StatHooks } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_ACCELERATION, PLAYER_FRICTION, PLAYER_MAX_SPEED, COLORS, BULLET_SPEED, FIRE_RATE, LOOP_DURATION, PLAYER_DASH_SPEED, PLAYER_DASH_DURATION, PLAYER_DASH_COOLDOWN, PLAYER_BASE_HP, PLAYER_NOVA_COOLDOWN, PLAYER_NOVA_RADIUS, PLAYER_NOVA_FORCE, XP_TO_OVERDRIVE, OVERDRIVE_DURATION, LORE_DATABASE } from './constants';
import { AudioSystem } from './AudioSystem';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hooks: StatHooks;
  audio: AudioSystem;

  // Game State
  isRunning: boolean = false;
  isPaused: boolean = false;
  lastTime: number = 0;
  lastUiUpdate: number = 0;
  hitStop: number = 0; // Freeze frame timer
  globalTime: number = 0; // For background animation
  
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
    
    // Stats
    speedMult: 1, 
    damageMult: 1,
    fireRateMult: 1,
    projectileCount: 1,
    piercing: 0,
    dashCooldownMult: 1,
    homing: 0, // Homing strength
    orbitals: 0, // Number of orbital shields
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
  orbitals: any[] = []; // Floating shields
  dashGhosts: any[] = []; // Visual trails
  pickups: any[] = []; // Health/Powerups

  // Gameplay Systems
  spawnTimer: number = 0;
  score: number = 0;
  difficultyMultiplier: number = 1;
  combo: number = 0;
  comboTimer: number = 0;
  
  // Lore
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
      
      // Set actual size in memory (scaled to account for extra pixel density)
      this.canvas.width = Math.floor(cssW * this.dpr);
      this.canvas.height = Math.floor(cssH * this.dpr);
      
      this.scaleRatio = scale;
      this.ctx.scale(this.scaleRatio * this.dpr, this.scaleRatio * this.dpr);
      this.ctx.imageSmoothingEnabled = false; // Sharpen rendering
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
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Block context menu

    // Handle focus loss
    window.addEventListener('blur', () => {
         this.keys = {}; // Clear keys so player doesn't get stuck running
         if (this.isRunning) this.togglePause();
    });

    setTimeout(() => { this.cachedRect = this.canvas.getBoundingClientRect(); }, 100);
  }
  
  destroy() {
      this.stop();
      this.eventListeners.forEach(l => {
          l.target.removeEventListener(l.type, l.handler);
      });
      // Close audio context on destroy to prevent leaks/warnings
      if (this.audio.ctx.state !== 'closed') {
          this.audio.ctx.close();
      }
  }

  togglePause() {
      this.isPaused = !this.isPaused;
      this.lastTime = performance.now(); // Reset delta so we don't jump
      this.hooks.onPauseToggle(this.isPaused);
      if(!this.isPaused) this.loop();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    
    // Ensure audio is ready (browser policy often requires user interaction first)
    if (this.audio.ctx.state === 'suspended') {
        this.audio.ctx.resume();
    }
    
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  reset() {
    this.player.x = CANVAS_WIDTH / 2;
    this.player.y = CANVAS_HEIGHT / 2;
    this.player.hp = this.player.maxHp;
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

    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.orbitals = [];
    this.dashGhosts = [];
    this.pickups = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.loopCount = 1;
    this.loopTimer = LOOP_DURATION;
    this.difficultyMultiplier = 1;
    this.hitStop = 0;
    this.warningTriggered = false;
    
    // NOTE: unlockedLoreIds persists within the session (don't clear it on reset)

    this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
    this.hooks.onScoreChange(0);
    this.hooks.onXpChange(0, XP_TO_OVERDRIVE, 0);
    this.hooks.onAbilityCooldown(0, PLAYER_NOVA_COOLDOWN);
  }

  loop = () => {
    if (!this.isRunning || this.isPaused) return;

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Cap dt to prevent tunneling on lag spikes
    if (dt > 0.05) dt = 0.05;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    this.globalTime += dt;

    // --- Hit Stop Logic ---
    if (this.hitStop > 0) {
        this.hitStop -= dt;
        // Still update shaking/visuals during hitstop if desired, but for now freeze frame
        if (this.screenshake > 0) this.screenshake -= 30 * dt;
        return; 
    }

    // --- Loop Logic ---
    this.loopTimer -= dt;
    const timePressure = 1 - (this.loopTimer / this.loopMaxTime);
    this.glitchIntensity = Math.max(0, (timePressure - 0.7) * 3);

    // Audio cue for low time
    if (this.loopTimer <= 10 && this.loopTimer > 0) {
        if (!this.warningTriggered) {
             this.warningTriggered = true;
             this.hooks.onDangerWarning();
        }

        // Pulse every second approx
        if (Math.floor(this.loopTimer) !== Math.floor(this.loopTimer + dt)) {
             this.audio.play('alert');
        }
    }

    if (this.loopTimer <= 0) {
      this.triggerLoopReset();
    }
    
    // Throttle UI
    const now = performance.now();
    if (now - this.lastUiUpdate > 100) {
        this.hooks.onLoopChange(this.loopCount, this.loopTimer, this.loopMaxTime);
        this.hooks.onAbilityCooldown(Math.max(0, this.player.novaCooldownTimer), PLAYER_NOVA_COOLDOWN);
        this.lastUiUpdate = now;
    }

    // --- Overdrive Logic ---
    if (this.player.overdriveTimer > 0) {
        this.player.overdriveTimer -= dt;
        // Heal over time in overdrive
        if (this.player.overdriveTimer % 0.5 < dt) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
            this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
            this.createDamageNumber(this.player.x, this.player.y - 30, 2);
        }
        if (this.player.overdriveTimer <= 0) {
             // Reset overdrive
        }
    }

    // --- Player Movement (Snappy Physics) ---
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
      
      // Impulse
      const dashDirX = dx || (this.player.vx === 0 ? 1 : Math.sign(this.player.vx));
      const dashDirY = dy || (this.player.vy === 0 ? 0 : Math.sign(this.player.vy));
      
      this.player.vx = dashDirX * PLAYER_DASH_SPEED;
      this.player.vy = dashDirY * PLAYER_DASH_SPEED;
      
      // Dash Burst
      this.createParticles(this.player.x, this.player.y, 12, COLORS.player);
      this.screenshake = 5;
      this.audio.play('dash');
    }

    // Ability: Pulse Nova (E or Right Click)
    if ((this.keys['KeyE'] || this.rightMouseDown) && this.player.novaCooldownTimer <= 0) {
        this.triggerNova();
    }
    this.player.novaCooldownTimer -= dt;

    if (this.player.dashing) {
      this.player.dashTimer -= dt;
      
      // TRAIL EFFECT: Create distinct particle trail
      const trailDensity = 2; // Particles per frame
      for (let i = 0; i < trailDensity; i++) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 10,
          y: this.player.y + (Math.random() - 0.5) * 10,
          vx: -this.player.vx * 0.1 + (Math.random() - 0.5) * 50, // Drift back opposite to movement
          vy: -this.player.vy * 0.1 + (Math.random() - 0.5) * 50,
          life: 0.2 + Math.random() * 0.2,
          maxLife: 0.4,
          color: '#e0ffff', // Bright cyan/white
          size: Math.random() * 3 + 2
        });
      }

      // Visuals: Afterimages (Ghosts)
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
        this.player.vx *= 0.5; // Brake at end of dash
        this.player.vy *= 0.5;
      }
    } else {
      // Acceleration & Friction
      if (dx !== 0 || dy !== 0) {
          this.player.vx += dx * PLAYER_ACCELERATION * dt;
          this.player.vy += dy * PLAYER_ACCELERATION * dt;
          
          // Speed Cap (Increased in Overdrive)
          let speedCap = PLAYER_MAX_SPEED * this.player.speedMult;
          if (this.player.overdriveTimer > 0) speedCap *= 1.3;

          const currentSpeed = Math.hypot(this.player.vx, this.player.vy);
          if (currentSpeed > speedCap) {
              const scale = speedCap / currentSpeed;
              this.player.vx *= scale;
              this.player.vy *= scale;
          }
      } else {
          // Friction
          this.player.vx *= PLAYER_FRICTION;
          this.player.vy *= PLAYER_FRICTION;
      }
    }

    this.player.dashCooldownTimer -= dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    // Boundaries
    this.player.x = Math.max(this.player.radius, Math.min(CANVAS_WIDTH - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(CANVAS_HEIGHT - this.player.radius, this.player.y));

    // Aim
    this.player.angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);

    // --- Orbitals ---
    while(this.orbitals.length < this.player.orbitals) {
        this.orbitals.push({ angle: (Math.PI * 2 / (this.player.orbitals || 1)) * this.orbitals.length });
    }
    const orbitalRadius = 60;
    const orbitalSpeed = 3;
    for(let i=0; i<this.orbitals.length; i++) {
        const orb = this.orbitals[i];
        orb.angle += orbitalSpeed * dt;
        orb.x = this.player.x + Math.cos(orb.angle) * orbitalRadius;
        orb.y = this.player.y + Math.sin(orb.angle) * orbitalRadius;
        
        // Orbital Collision
        for(const enemy of this.enemies) {
            const dist = Math.hypot(orb.x - enemy.x, orb.y - enemy.y);
            if(dist < 15 + enemy.radius) {
                enemy.hp -= 200 * dt; // DPS
                if(enemy.hp <= 0) this.killEnemy(enemy);
                this.createParticles(orb.x, orb.y, 1, '#00ffff');
            }
        }
    }

    // --- Shooting ---
    this.player.fireTimer -= dt;
    if (this.mouseDown && this.player.fireTimer <= 0) {
      this.fireBullet();
      let rate = FIRE_RATE / this.player.fireRateMult;
      // Faster fire rate in overdrive
      if (this.player.overdriveTimer > 0) rate *= 0.6; 
      this.player.fireTimer = rate;
    }

    // --- Bullets ---
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      
      // Enemy Bullet Logic
      if (b.isEnemy) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;
          
          if (b.life <= 0 || b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
            this.bullets[i] = this.bullets[this.bullets.length - 1];
            this.bullets.pop();
            continue;
          }

          // Player Collision (Dash I-Frame)
          const distSq = (b.x - this.player.x) ** 2 + (b.y - this.player.y) ** 2;
          const radSum = this.player.radius + b.radius;
          if (distSq < radSum * radSum) {
              if (!this.player.dashing) {
                  this.takeDamage(b.damage);
                  this.createParticles(this.player.x, this.player.y, 5, COLORS.player);
                  // destroy bullet
                  this.bullets[i] = this.bullets[this.bullets.length - 1];
                  this.bullets.pop();
              }
              continue; // If dashing, bullet passes through
          }
          continue; // Enemy bullets dont hit enemies
      }

      // Player Bullet Homing
      if (this.player.homing > 0) {
          let closest = null;
          let closestDist = 400; // Range
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
          // Bonus damage in Overdrive
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
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = (1.5 / Math.sqrt(this.loopCount)) * (1 / this.difficultyMultiplier); 
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      
      // AI Behavior
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
               desiredSpeed = 0; // Stop to shoot
               if (e.attackTimer <= 0) {
                   this.fireEnemyBullet(e);
                   e.attackTimer = 2.5; // Fire rate
               }
           }
      }

      // Movement Logic
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

      // Soft collision
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

      // Player Collision
      const distSqToPlayer = (e.x - this.player.x)**2 + (e.y - this.player.y)**2;
      const radSumPlayer = e.radius + this.player.radius;
      if (distSqToPlayer < radSumPlayer * radSumPlayer) {
        if (!this.player.dashing) {
          this.takeDamage(10);
          const pushAngle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
          e.vx += Math.cos(pushAngle) * 500;
          e.vy += Math.sin(pushAngle) * 500;
          this.player.vx -= Math.cos(pushAngle) * 500;
          this.player.vy -= Math.sin(pushAngle) * 500;
          this.screenshake = 10;
        } else {
            // Dash Kill (Ramming)
            e.hp -= 50; 
            if (e.hp <= 0) this.killEnemy(e);
        }
      }
    }

    // --- Pickups (Health, XP, Lore) ---
    for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        // Bobbing effect
        p.y += Math.sin(performance.now() / 200) * 0.5 * dt; 
        
        // Magnet
        const magnetRange = this.player.overdriveTimer > 0 ? 300 : 120; // Increased range in overdrive
        const distToPlayer = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        
        if (distToPlayer < magnetRange) {
            const pullSpeed = this.player.overdriveTimer > 0 ? 15 : 8;
            p.x += (this.player.x - p.x) * pullSpeed * dt;
            p.y += (this.player.y - p.y) * pullSpeed * dt;
        }

        if (distToPlayer < this.player.radius + 15) {
            // Collect
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
                // Find a locked lore
                const available = LORE_DATABASE.filter(l => !this.unlockedLoreIds.has(l.id));
                if (available.length > 0) {
                    const lore = available[Math.floor(Math.random() * available.length)];
                    this.unlockedLoreIds.add(lore.id);
                    this.hooks.onLoreUnlock({ ...lore, unlocked: true });
                    this.togglePause(); // Pause game to read
                } else {
                    // Fallback if all collected: Big XP
                    this.createDamageNumber(this.player.x, this.player.y, 100);
                    this.player.xp += 25;
                }
                this.createParticles(this.player.x, this.player.y, 20, COLORS.pickupLore);
                this.audio.play('powerup');
            }

            this.pickups[i] = this.pickups[this.pickups.length - 1];
            this.pickups.pop();
        }
    }

    // --- Particles & Ghosts ---
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

     // --- Damage Numbers ---
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
        const d = this.damageNumbers[i];
        d.y -= 20 * dt;
        d.life -= dt;
        if (d.life <= 0) {
            this.damageNumbers[i] = this.damageNumbers[this.damageNumbers.length - 1];
            this.damageNumbers.pop();
        }
    }

    // --- Combo Decay ---
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
      this.hooks.onXpChange(XP_TO_OVERDRIVE, XP_TO_OVERDRIVE, 0); // Show full bar
      this.screenshake = 10;
      this.audio.play('powerup');
      
      // Explosion of visuals
      this.createParticles(this.player.x, this.player.y, 30, COLORS.glitch);
  }

  triggerNova() {
      this.player.novaCooldownTimer = PLAYER_NOVA_COOLDOWN;
      this.audio.play('nova');
      this.screenshake = 15;
      this.hitStop = 0.1;
      this.hooks.onAbilityCooldown(PLAYER_NOVA_COOLDOWN, PLAYER_NOVA_COOLDOWN);

      // Visual Ring
      this.createParticles(this.player.x, this.player.y, 40, '#ffffff');

      // Clear Enemy Bullets in Radius
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

      // Push Enemies
      for (const e of this.enemies) {
           const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
           if (dist < PLAYER_NOVA_RADIUS) {
               e.hp -= 25; // Small Damage
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
    const count = this.player.overdriveTimer > 0 ? this.player.projectileCount + 1 : this.player.projectileCount; // Bonus projectile in overdrive

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
            color: this.player.overdriveTimer > 0 ? '#ff00ff' : COLORS.bullet // Purple bullets in overdrive
        });
    }
    this.screenshake = 2;
    this.audio.play('shoot');
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 + 50; 
    const x = CANVAS_WIDTH/2 + Math.cos(angle) * dist;
    const y = CANVAS_HEIGHT/2 + Math.sin(angle) * dist;

    // Progression
    const isTank = Math.random() < (0.1 * this.loopCount);
    const isDasher = Math.random() < (0.2 * this.loopCount);
    const isSniper = this.loopCount > 1 && Math.random() < 0.15;
    const isGunner = this.loopCount > 1 && Math.random() < 0.15;
    
    let type = EnemyType.SWARMER;
    let hp = 30 * this.loopCount;
    let speed = 150 + (this.loopCount * 10);
    // Increased sizes
    let radius = 15; 
    let color = COLORS.enemySwarmer;
    let acc = 800;
    let state = 'IDLE';
    let attackTimer = 0;

    if (isTank) {
        type = EnemyType.TANK;
        hp = 100 * this.loopCount;
        speed = 80;
        radius = 30; // Bigger tank
        color = COLORS.enemyTank;
        acc = 400;
    } else if (isDasher) {
        type = EnemyType.DASHER;
        hp = 20 * this.loopCount;
        speed = 250 + (this.loopCount * 20);
        radius = 12; // Bigger dasher
        color = COLORS.enemyDasher;
        acc = 1200;
    } else if (isSniper) {
        type = EnemyType.SNIPER;
        hp = 40 * this.loopCount;
        speed = 100;
        radius = 18; // Bigger sniper
        color = COLORS.enemySniper;
        acc = 600;
        attackTimer = 1.0;
    } else if (isGunner) {
        type = EnemyType.GUNNER;
        hp = 50 * this.loopCount;
        speed = 120;
        radius = 20; // Bigger gunner
        color = COLORS.enemyGunner;
        acc = 500;
        attackTimer = 1.5;
    }

    this.enemies.push({
        x, y, vx: 0, vy: 0,
        type, hp, radius, color,
        acceleration: acc,
        maxSpeed: speed,
        state, attackTimer
    });
  }

  spawnPickup(x: number, y: number, type: 'HEALTH' | 'XP' | 'DATA') {
      this.pickups.push({
          x, y, type,
          vx: (Math.random()-0.5)*100,
          vy: (Math.random()-0.5)*100
      });
  }

  killEnemy(enemy: any) {
    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
      this.enemies[index] = this.enemies[this.enemies.length - 1];
      this.enemies.pop();
      
      this.createParticles(enemy.x, enemy.y, 10, enemy.color);
      this.screenshake = 5;
      this.hitStop = 0.05; // Hit stop!
      
      // Score & Combo
      this.combo++;
      this.comboTimer = 3.0; // reset decay
      const comboMult = 1 + (this.combo * 0.1);
      this.score += Math.floor(10 * this.loopCount * comboMult);
      this.hooks.onScoreChange(this.score);

      // Pickup Drop Chance
      // DATA SHARD (Rare, more likely on tanks/snipers)
      if (Math.random() < 0.02 || (enemy.type === EnemyType.TANK && Math.random() < 0.3)) {
         this.spawnPickup(enemy.x, enemy.y, 'DATA');
      }
      // Health is rare
      else if (Math.random() < 0.05) {
          this.spawnPickup(enemy.x, enemy.y, 'HEALTH');
      }
      // XP is common (Data Fragments)
      else if (Math.random() < 0.6) {
          const amount = 1 + Math.floor(Math.random() * 3);
          for(let k=0; k<amount; k++) {
              this.spawnPickup(enemy.x, enemy.y, 'XP');
          }
      }
      
      this.audio.play('explosion');
    }
  }

  takeDamage(amount: number) {
    if (this.player.overdriveTimer > 0) amount *= 0.5; // Damage reduction in overdrive

    this.player.hp -= amount;
    this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
    this.createParticles(this.player.x, this.player.y, 15, COLORS.player);
    this.screenshake = 20;
    this.hitStop = 0.15; // Strong hit stop on damage
    this.audio.play('hit');
    
    // Reset combo on hit
    this.combo = 0;
    
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.stop();
      this.hooks.onGameOver({ score: this.score, loop: this.loopCount });
    }
  }

  triggerLoopReset() {
    this.stop();
    this.loopCount++;
    this.difficultyMultiplier += 0.2;
    this.hooks.onLevelUp();
    this.audio.play('powerup');
    
    // Always spawn a data shard at the start of a new loop
    this.spawnPickup(CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 100, 'DATA');
  }

  startNextLoop() {
      this.player.x = CANVAS_WIDTH / 2;
      this.player.y = CANVAS_HEIGHT / 2;
      this.player.vx = 0;
      this.player.vy = 0;
      this.enemies = [];
      this.bullets = [];
      this.particles = [];
      this.orbitals = [];
      this.dashGhosts = [];
      this.pickups = [];
      this.loopTimer = LOOP_DURATION; 
      this.hitStop = 0;
      
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.5);
      this.hooks.onHealthChange(this.player.hp, this.player.maxHp);
      
      this.hooks.onAbilityCooldown(0, PLAYER_NOVA_COOLDOWN); // Reset cooldown
      
      this.warningTriggered = false;

      this.start();
  }

  applyUpgrade(upgrade: any) {
      upgrade.apply(this);
      this.startNextLoop();
  }

  createParticles(x: number, y: number, count: number, color: string) {
    if (this.particles.length > 200) return;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 200 + 50;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.5 + 0.2,
        maxLife: 0.5,
        color: color,
        size: Math.random() * 3 + 1
      });
    }
  }

  createDamageNumber(x: number, y: number, val: number) {
      if (this.damageNumbers.length > 50) return; 
      this.damageNumbers.push({
          x, y,
          value: val,
          life: 0.8
      });
  }

  drawBackground() {
      // Perspective Grid Effect
      const time = this.globalTime * 100;
      const w = CANVAS_WIDTH;
      const h = CANVAS_HEIGHT;
      const cx = w / 2;
      const cy = h / 2;

      // Dark background
      this.ctx.fillStyle = COLORS.background;
      this.ctx.fillRect(0, 0, w, h);

      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = `rgba(30, 30, 40, 0.5)`;
      
      // Moving floor/ceiling lines (Perspective)
      const fov = 300;
      const gridSpacing = 80;
      
      // Vertical lines fan out from center
      for (let i = -10; i <= 10; i++) {
          const xOffset = i * 150;
          this.ctx.beginPath();
          this.ctx.moveTo(cx, cy);
          this.ctx.lineTo(cx + xOffset * 10, h + 100); // Floor
          this.ctx.moveTo(cx, cy);
          this.ctx.lineTo(cx + xOffset * 10, -100); // Ceiling
          this.ctx.stroke();
      }

      // Horizontal lines scroll towards screen
      const speed = 200;
      const offset = (this.globalTime * speed) % gridSpacing;
      
      // Draw grid moving "towards" camera (actually just scaling rectangles)
      // This is a simple trick: concentric rects expanding
      for(let i = 0; i < 15; i++) {
          let dist = (i * gridSpacing + offset); // Distance from center
          // Scale grows exponentially to simulate Z-axis
          let scale = Math.pow(dist / 500, 2); 
          if(scale < 0.05) continue;
          
          let rectW = w * scale * 0.5;
          let rectH = h * scale * 0.5;
          
          this.ctx.strokeStyle = `rgba(0, 100, 255, ${Math.min(0.2, scale * 0.1)})`;
          this.ctx.strokeRect(cx - rectW/2, cy - rectH/2, rectW, rectH);
      }
  }

  draw() {
    this.drawBackground();

    const shakeX = (Math.random() - 0.5) * this.screenshake;
    const shakeY = (Math.random() - 0.5) * this.screenshake;
    
    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);

    this.ctx.globalCompositeOperation = 'lighter';

    // Pickups
    for(const p of this.pickups) {
        if (p.type === 'DATA') {
            this.ctx.fillStyle = COLORS.pickupLore;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = COLORS.pickupLore;
            // Draw Glitchy shard
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y - 10);
            this.ctx.lineTo(p.x + 8, p.y + 5);
            this.ctx.lineTo(p.x - 8, p.y + 5);
            this.ctx.fill();
        } else {
            this.ctx.fillStyle = p.type === 'HEALTH' ? COLORS.pickupHealth : COLORS.pickupXp;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = this.ctx.fillStyle;
            
            if (p.type === 'HEALTH') {
                this.ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
                // Draw Plus
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(p.x - 2, p.y - 4, 4, 8);
                this.ctx.fillRect(p.x - 4, p.y - 2, 8, 4);
            } else {
                // XP are small diamonds
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y - 5);
                this.ctx.lineTo(p.x + 5, p.y);
                this.ctx.lineTo(p.x, p.y + 5);
                this.ctx.lineTo(p.x - 5, p.y);
                this.ctx.fill();
            }
        }
        
        this.ctx.shadowBlur = 0;
    }

    // Dash Ghosts - Enhanced visuals
    for(const g of this.dashGhosts) {
        const alpha = (g.life / g.maxLife) * (g.opacity || 0.3); // Fading logic
        this.ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(g.x, g.y, g.radius, 0, Math.PI*2);
        this.ctx.fill();
    }

    // Player
    this.ctx.shadowBlur = this.player.overdriveTimer > 0 ? 40 : (this.player.dashing ? 30 : 15);
    this.ctx.shadowColor = this.player.overdriveTimer > 0 ? '#ff00ff' : COLORS.player;
    this.ctx.fillStyle = this.player.overdriveTimer > 0 ? '#ffffff' : COLORS.player;
    
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0; 
    
    // Nova Visual Effect (Ring)
    if (this.player.novaCooldownTimer > PLAYER_NOVA_COOLDOWN - 0.2) {
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, this.player.y, PLAYER_NOVA_RADIUS, 0, Math.PI*2);
        this.ctx.stroke();
    }

    // Orbitals
    this.ctx.fillStyle = '#00ffff';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#00ffff';
    for(const orb of this.orbitals) {
        this.ctx.beginPath();
        this.ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
    }
    this.ctx.shadowBlur = 0;
    
    // Aim Line
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.x, this.player.y);
    this.ctx.lineTo(this.player.x + Math.cos(this.player.angle) * 1000, this.player.y + Math.sin(this.player.angle) * 1000);
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Crosshair
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.mouse.x - 10, this.mouse.y);
    this.ctx.lineTo(this.mouse.x + 10, this.mouse.y);
    this.ctx.moveTo(this.mouse.x, this.mouse.y - 10);
    this.ctx.lineTo(this.mouse.x, this.mouse.y + 10);
    this.ctx.stroke();

    // Enemies
    for (const e of this.enemies) {
      this.ctx.fillStyle = e.color;
      this.ctx.beginPath();
      
      if (e.type === EnemyType.SWARMER) {
          const size = e.radius;
          this.ctx.moveTo(e.x + size * Math.cos(0), e.y + size * Math.sin(0));
          this.ctx.lineTo(e.x + size * Math.cos(2.6), e.y + size * Math.sin(2.6));
          this.ctx.lineTo(e.x + size * Math.cos(3.7), e.y + size * Math.sin(3.7));
      } else if (e.type === EnemyType.SNIPER) {
          // Triangle
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          const size = e.radius;
          this.ctx.moveTo(e.x + Math.cos(angle)*size*1.5, e.y + Math.sin(angle)*size*1.5);
          this.ctx.lineTo(e.x + Math.cos(angle + 2.5)*size, e.y + Math.sin(angle + 2.5)*size);
          this.ctx.lineTo(e.x + Math.cos(angle - 2.5)*size, e.y + Math.sin(angle - 2.5)*size);
          
          if (e.state === 'CHARGING') {
              // Laser Sight
              this.ctx.strokeStyle = `rgba(168, 85, 247, ${1 - e.attackTimer})`; 
              this.ctx.lineWidth = 1;
              this.ctx.beginPath();
              this.ctx.moveTo(e.x, e.y);
              this.ctx.lineTo(this.player.x, this.player.y);
              this.ctx.stroke();
          }
      } else if (e.type === EnemyType.GUNNER) {
          // Square with cannon
          this.ctx.rect(e.x - e.radius, e.y - e.radius, e.radius*2, e.radius*2);
          // Cannon (visual only, simple line)
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          this.ctx.moveTo(e.x, e.y);
          this.ctx.lineTo(e.x + Math.cos(angle)*20, e.y + Math.sin(angle)*20);
      } else {
          this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      }
      this.ctx.fill();
      if(e.type === EnemyType.GUNNER) this.ctx.stroke(); // Draw cannon line
    }

    // Bullets
    for (const b of this.bullets) {
      this.ctx.fillStyle = b.color;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Particles
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life / p.maxLife;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    // Damage Numbers
    this.ctx.font = 'bold 20px "Jersey 10"';
    this.ctx.fillStyle = '#fff';
    for (const d of this.damageNumbers) {
        this.ctx.fillText(d.value, d.x, d.y);
    }

    // Combo UI (In-Game)
    if (this.combo > 1) {
        this.ctx.font = 'italic bold 48px "Rajdhani"';
        this.ctx.fillStyle = `rgba(255, 255, 0, ${Math.min(1, this.comboTimer)})`;
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        const text = `x${this.combo}`;
        // Draw near player but offset
        this.ctx.strokeText(text, this.player.x + 30, this.player.y - 30);
        this.ctx.fillText(text, this.player.x + 30, this.player.y - 30);
    }

    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();

    // GLITCH EFFECT
    if (this.glitchIntensity > 0 && Math.random() < this.glitchIntensity * 0.1) {
        this.ctx.fillStyle = `rgba(${Math.random()*255}, 0, ${Math.random()*255}, 0.1)`;
        const h = Math.random() * 100;
        const y = Math.random() * CANVAS_HEIGHT;
        this.ctx.fillRect(0, y, CANVAS_WIDTH, h);
    }
  }
}