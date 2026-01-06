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
  nova: '#ffffff',
};