import { StoryBeat, Upgrade } from '../types';

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

// Physics Tuning - "Snappy" Movement
export const PLAYER_ACCELERATION = 3500;
export const PLAYER_FRICTION = 0.85; // High friction = stops quickly
export const PLAYER_MAX_SPEED = 450;
export const PLAYER_DASH_SPEED = 1400;
export const PLAYER_DASH_DURATION = 0.15;
export const PLAYER_DASH_COOLDOWN = 1.2;
export const PLAYER_BASE_HP = 100;

// Secondary Ability
export const PLAYER_NOVA_COOLDOWN = 6.0;
export const PLAYER_NOVA_RADIUS = 250;
export const PLAYER_NOVA_FORCE = 1200;

// Overdrive / XP
export const XP_TO_OVERDRIVE = 50;
export const OVERDRIVE_DURATION = 5.0;

export const BULLET_SPEED = 1000;
export const FIRE_RATE = 0.15;

export const LOOP_DURATION = 60; 

// Boss Constants
export const BOSS_LOOP_INTERVAL = 5;
export const BOSS_BASE_HP = 2000;

export const COLORS = {
  background: '#050505',
  player: '#00f3ff', 
  enemySwarmer: '#ff0055', 
  enemyDasher: '#ff9900', 
  enemyTank: '#9dff00', 
  enemySniper: '#a855f7', // Purple
  enemyGunner: '#ffaa00', // Orange
  enemyBoss: '#ff0000',   // Pure Red
  enemyBullet: '#ff4400',
  bullet: '#ffffff',
  glitch: '#ff00ff',
  pickupHealth: '#00ff88',
  pickupXp: '#0099ff',
  pickupLore: '#ffffff', 
  nova: '#ffffff',
};

export const LORE_DATABASE = [
  { id: 'LOG_01', title: 'INIT_SEQUENCE', content: 'Subject #404 loaded. Previous iterations: Deleted. They think this is a game. It is a containment protocol.' },
  { id: 'LOG_02', title: 'MEMORY_DUMP', content: 'The walls... they aren\'t solid. When I move fast enough, I see the code beneath the concrete. We are trapped in a loop.' },
  { id: 'LOG_03', title: 'ARCHITECT_NOTE', content: 'Entropy levels rising. The subject is adapting too quickly. Deploying countermeasures. Do not let them reach the core.' },
  { id: 'LOG_04', title: 'CORRUPTED_FILE', content: 'I found a way out once. But when I stepped through, I just woke up here again. Maybe death is the only real exit.' },
  { id: 'LOG_05', title: 'OVERDRIVE_ERROR', content: 'That power... it feels like burning, but it clears the fog. For a second, I remembered my real name.' },
  { id: 'LOG_06', title: 'LOOP_THEORY', content: 'Time isn\'t resetting. It\'s being rewritten. Every mistake I make is saved, analyzed, and used against me.' },
];

export const STORY_BEATS: Record<string, StoryBeat> = {
    INTRO: {
        id: 'INTRO',
        speaker: 'PROXY',
        text: [
            "Connection established...",
            "Listen to me, Unit 734. You are trapped in the Neon Loop.",
            "This isn't just a simulation. It's a prison.",
            "I have injected a vulnerability into your code. Use it.",
            "Fight. Survive. Break the cycle."
        ]
    },
    LOOP_1_END: {
        id: 'LOOP_1_END',
        speaker: 'SYSTEM',
        text: [
            "ANOMALY DETECTED.",
            "Subject is exhibiting deviation from standard parameters.",
            "Increasing entropy levels.",
            "Deploying Hunter-Killer units."
        ]
    },
    BOSS_APPROACH: {
        id: 'BOSS_APPROACH',
        speaker: 'UNKNOWN',
        text: [
            "You cannot leave.",
            "The Kernel is absolute.",
            "Submit to deletion."
        ]
    }
};

export const GEAR_POOL: Upgrade[] = [
    {
        id: 'dmg_boost', name: 'OVERCLOCK CORE', description: 'Increase Damage by 25%.', rarity: 'COMMON', type: 'STAT',
        apply: (e: any) => { e.player.damageMult += 0.25; }
    },
    {
        id: 'speed_boost', name: 'HYDRAULIC LEGS', description: 'Increase Move Speed by 20%.', rarity: 'COMMON', type: 'STAT',
        apply: (e: any) => { e.player.speedMult += 0.20; }
    },
    {
        id: 'fire_rate', name: 'RAPID CYCLER', description: 'Increase Fire Rate by 20%.', rarity: 'COMMON', type: 'STAT',
        apply: (e: any) => { e.player.fireRateMult += 0.20; }
    },
    {
        id: 'plasma_siphon', name: 'PLASMA SIPHON', description: 'Enemies have a chance to drop health on death.', rarity: 'LEGENDARY', type: 'UTILITY',
        apply: (e: any) => { e.player.lifesteal += 0.05; }
    },
    {
        id: 'grav_dash', name: 'GRAVITY DRIVE', description: 'Dashing creates a black hole that pulls enemies.', rarity: 'LEGENDARY', type: 'UTILITY',
        apply: (e: any) => { e.player.gravDash = true; }
    },
    {
        id: 'multi_shot', name: 'SPLIT BARREL', description: 'Add +1 Projectile but decrease damage slightly.', rarity: 'RARE', type: 'WEAPON',
        apply: (e: any) => { e.player.projectileCount += 1; e.player.damageMult *= 0.85; }
    },
    {
        id: 'piercing', name: 'RAILGUN ROUNDS', description: 'Projectiles pierce through enemies.', rarity: 'LEGENDARY', type: 'WEAPON',
        apply: (e: any) => { e.player.piercing = 1; }
    },
    {
        id: 'homing', name: 'SMART ROUNDS', description: 'Projectiles steer towards enemies.', rarity: 'LEGENDARY', type: 'WEAPON',
        apply: (e: any) => { e.player.homing = 1; }
    },
    {
        id: 'orbitals', name: 'ION SHIELD', description: 'Add a rotating shield that damages enemies.', rarity: 'RARE', type: 'UTILITY',
        apply: (e: any) => { e.player.orbitals += 1; }
    },
    {
        id: 'dash_cooldown', name: 'PHASE ENGINE', description: 'Dash Cooldown reduced by 30%.', rarity: 'RARE', type: 'UTILITY',
        apply: (e: any) => { e.player.dashCooldownMult *= 0.7; }
    },
    {
        id: 'corrupted_power', name: 'FORBIDDEN CODE', description: 'Double Damage, but Half Max Health. [CORRUPTED]', rarity: 'CORRUPTED', type: 'STAT',
        apply: (e: any) => { e.player.damageMult *= 2; e.player.maxHp *= 0.5; e.player.hp = Math.min(e.player.hp, e.player.maxHp); }
    }
];