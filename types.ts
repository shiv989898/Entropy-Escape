export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LEVEL_UP = 'LEVEL_UP',
  GAME_OVER = 'GAME_OVER',
}

export interface Vector2 {
  x: number;
  y: number;
}

export enum EnemyType {
  SWARMER = 'SWARMER',
  DASHER = 'DASHER',
  TANK = 'TANK',
  SNIPER = 'SNIPER',
  GUNNER = 'GUNNER',
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY' | 'CORRUPTED';
  type: 'STAT' | 'WEAPON' | 'UTILITY';
  apply: (engine: any) => void;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface LoreFragment {
  id: string;
  title: string;
  content: string;
  unlocked: boolean;
}

export interface StatHooks {
  onHealthChange: (current: number, max: number) => void;
  onScoreChange: (score: number) => void;
  onLoopChange: (loop: number, timeRemaining: number, maxTime: number) => void;
  onGameOver: (stats: any) => void;
  onLevelUp: () => void;
  onPauseToggle: (isPaused: boolean) => void;
  onXpChange: (current: number, max: number, level: number) => void;
  onAbilityCooldown: (current: number, max: number) => void;
  onDangerWarning: () => void;
  // New hook
  onLoreUnlock: (fragment: LoreFragment) => void;
}