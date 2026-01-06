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

export const COLORS = {
  background: '#050505',
  player: '#00f3ff', 
  enemySwarmer: '#ff0055', 
  enemyDasher: '#ff9900', 
  enemyTank: '#9dff00', 
  enemySniper: '#a855f7', // Purple
  enemyGunner: '#ffaa00', // Orange
  enemyBullet: '#ff4400',
  bullet: '#ffffff',
  glitch: '#ff00ff',
  pickupHealth: '#00ff88',
  pickupXp: '#0099ff',
  pickupLore: '#ffffff', // Bright white for data shards
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