import React, { useEffect, useState } from 'react';
import { GameState, Upgrade } from '../types';
import { Play, RotateCcw, Zap, Skull, Shield, Activity, Clock, Pause, Target, Disc, Move } from 'lucide-react';

interface OverlayProps {
  gameState: GameState;
  score: number;
  health: number;
  maxHealth: number;
  xp: number;
  maxXp: number;
  abilityCooldown: number;
  maxAbilityCooldown: number;
  loop: number;
  timeRemaining: number;
  maxTime: number;
  onStart: () => void;
  onRestart: () => void;
  onUpgradeSelect: (upgrade: Upgrade) => void;
  onResume: () => void;
}

const UPGRADES_POOL: Upgrade[] = [
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

const getRandomUpgrades = (count: number) => {
    const shuffled = [...UPGRADES_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

export const Overlay: React.FC<OverlayProps> = ({ 
    gameState, score, health, maxHealth, xp, maxXp, abilityCooldown, maxAbilityCooldown, loop, timeRemaining, maxTime, 
    onStart, onRestart, onUpgradeSelect, onResume
}) => {
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (gameState === GameState.LEVEL_UP) {
        setUpgrades(getRandomUpgrades(3));
    }
  }, [gameState]);

  // Handle fading warning
  useEffect(() => {
      // Trigger warning when time hits 10s. 
      // Using Math.ceil to capture it around the 10 second mark, preventing multi-triggers if possible
      if (gameState === GameState.PLAYING && timeRemaining <= 10 && timeRemaining > 9.5) {
          setShowWarning(true);
          const timer = setTimeout(() => setShowWarning(false), 3000); // Disappear after 3s
          return () => clearTimeout(timer);
      }
      if (timeRemaining > 10) {
          setShowWarning(false);
      }
  }, [Math.floor(timeRemaining), gameState]);

  const healthPerc = (health / maxHealth) * 100;
  const timePerc = (timeRemaining / maxTime) * 100;
  const xpPerc = (xp / maxXp) * 100;
  const abilityReady = abilityCooldown <= 0;
  const abilityPerc = ((maxAbilityCooldown - abilityCooldown) / maxAbilityCooldown) * 100;

  // Render HUD
  if (gameState === GameState.PLAYING) {
    return (
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
                {/* Health */}
                <div className="flex items-center gap-2">
                    <Activity className="text-red-500 animate-pulse" />
                    <div className="w-64 h-6 bg-gray-900 border border-gray-700 skew-x-[-12deg] overflow-hidden relative">
                        <div 
                            className="h-full bg-red-500 transition-all duration-200"
                            style={{ width: `${healthPerc}%` }}
                        ></div>
                         <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                            {Math.ceil(health)} / {maxHealth}
                        </div>
                    </div>
                </div>

                {/* Overdrive / XP Bar */}
                <div className="flex items-center gap-2">
                    <Zap className={`text-cyan-400 ${xp >= maxXp ? 'animate-bounce' : ''}`} size={20} />
                    <div className="w-48 h-4 bg-gray-900 border border-gray-700 skew-x-[-12deg] overflow-hidden relative">
                         <div 
                            className={`h-full transition-all duration-200 ${xp >= maxXp ? 'bg-fuchsia-500 animate-pulse' : 'bg-cyan-500'}`}
                            style={{ width: `${xpPerc}%` }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md tracking-wider">
                            {xp >= maxXp ? 'OVERDRIVE ACTIVE' : 'DATA FRAGMENTS'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xl glitch" data-text={`SCORE: ${score}`}>
                    SCORE: {score}
                </div>
            </div>

            <div className="flex flex-col items-end gap-2">
                 <div className="text-yellow-400 font-mono text-4xl font-bold glitch" data-text={`LOOP: ${loop}`}>
                    LOOP: {loop}
                 </div>
                 <div className="flex items-center gap-2">
                     <Clock className="text-yellow-400" size={18} />
                     <div className="w-48 h-2 bg-gray-900 border border-gray-700">
                        <div 
                            className={`h-full transition-all duration-1000 linear ${timeRemaining < 10 ? 'bg-red-500 animate-pulse' : 'bg-yellow-400'}`}
                            style={{ width: `${timePerc}%` }}
                        ></div>
                     </div>
                 </div>
                 <span className="text-xs text-gray-400 font-mono">{timeRemaining.toFixed(1)}s UNTIL RESET</span>
            </div>
        </div>
        
        {/* Bottom Ability Indicators */}
        <div className="absolute bottom-6 left-6 flex items-end gap-4">
             {/* Pulse Nova Ability */}
             <div className="flex flex-col items-center gap-1">
                 <div className={`w-16 h-16 border-2 flex items-center justify-center transition-all ${abilityReady ? 'border-white bg-white/20 shadow-[0_0_15px_white]' : 'border-gray-600 bg-black/50'}`}>
                    <Move className={`${abilityReady ? 'text-white' : 'text-gray-500'}`} />
                    {!abilityReady && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center font-mono text-xs text-white">
                             {abilityCooldown.toFixed(1)}
                        </div>
                    )}
                 </div>
                 <span className="text-xs font-bold tracking-widest text-gray-400">[E] PULSE</span>
             </div>
        </div>

        {/* Danger Warning */}
        {showWarning && (
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-opacity duration-1000 ease-out animate-pulse">
                <h1 className="text-6xl font-black text-red-600 glitch" data-text="SYSTEM UNSTABLE">SYSTEM UNSTABLE</h1>
                <p className="text-red-400 animate-pulse tracking-[0.5em] mt-2">REALITY COLLAPSE IMMINENT</p>
             </div>
        )}
      </div>
    );
  }

  // Menus
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 pointer-events-auto">
      
      {/* PAUSED */}
      {gameState === GameState.PAUSED && (
          <div className="text-center space-y-8">
              <h1 className="text-6xl font-black text-white tracking-widest glitch" data-text="PAUSED">PAUSED</h1>
              <div className="flex flex-col gap-4">
                <button onClick={onResume} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold skew-x-[-12deg] flex items-center justify-center gap-2">
                    <Play size={20} /> RESUME
                </button>
              </div>
          </div>
      )}

      {/* MAIN MENU */}
      {gameState === GameState.MENU && (
        <div className="text-center space-y-8 max-w-lg">
          <div className="space-y-2">
              <h1 className="text-8xl font-black text-white glitch tracking-tighter" data-text="NEON LOOP">NEON LOOP</h1>
              <h2 className="text-4xl font-bold text-cyan-400 tracking-[0.3em]">ENTROPY</h2>
          </div>
          <div className="p-6 border border-gray-800 bg-gray-900/80 text-left text-sm text-gray-400 font-mono space-y-2">
              <p>> INITIATING SEQUENCE...</p>
              <p>> SUBJECT: USER_01</p>
              <p>> OBJECTIVE: SURVIVE THE LOOP. BREAK THE CYCLE.</p>
              <p>> CONTROLS: [WASD] MOVE // [MOUSE] AIM // [SPACE] DASH</p>
              <p>> ABILITY: [E] or [R-CLICK] PULSE NOVA</p>
              <p>> MECHANIC: COLLECT DATA FRAGMENTS TO TRIGGER OVERDRIVE</p>
          </div>
          <button 
            onClick={onStart}
            className="w-full group relative px-12 py-4 bg-transparent border-2 border-cyan-500 text-cyan-500 text-2xl font-bold hover:bg-cyan-500 hover:text-black transition-all duration-100 skew-x-[-12deg]"
          >
            <span className="block skew-x-[12deg] flex items-center gap-2 justify-center">
                <Play size={24} /> INITIALIZE RUN
            </span>
          </button>
        </div>
      )}

      {/* GAME OVER */}
      {gameState === GameState.GAME_OVER && (
        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-300">
           <div className="space-y-4">
              <Skull className="w-24 h-24 text-red-600 mx-auto animate-bounce" />
              <h1 className="text-7xl font-black text-red-600 glitch" data-text="FATAL ERROR">FATAL ERROR</h1>
              <p className="text-xl text-gray-300">SUBJECT TERMINATED IN LOOP {loop}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left p-6 bg-gray-900 border border-red-900/50">
              <div className="text-gray-500">FINAL SCORE</div>
              <div className="text-right text-2xl font-bold text-white">{score}</div>
              <div className="text-gray-500">LOOPS SURVIVED</div>
              <div className="text-right text-2xl font-bold text-white">{loop - 1}</div>
          </div>

          <button 
            onClick={onRestart}
            className="w-full group relative px-12 py-4 bg-red-600 text-white text-2xl font-bold hover:bg-red-500 transition-all duration-100"
          >
             <span className="flex items-center gap-2 justify-center">
                <RotateCcw size={24} /> REBOOT SYSTEM
            </span>
          </button>
        </div>
      )}

      {/* LEVEL UP / LOOP RESET */}
      {gameState === GameState.LEVEL_UP && (
        <div className="w-full max-w-4xl p-8 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-5xl font-bold text-yellow-400 glitch" data-text="LOOP COMPLETE">LOOP COMPLETE</h1>
                <p className="text-xl text-gray-300">REALITY RECONFIGURING... SELECT MUTATION</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {upgrades.map((u, i) => (
                    <button
                        key={i}
                        onClick={() => onUpgradeSelect(u)}
                        className={`
                            relative p-6 border-2 flex flex-col items-center text-center gap-4 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]
                            ${u.rarity === 'COMMON' ? 'border-gray-600 bg-gray-900 hover:border-gray-400' : ''}
                            ${u.rarity === 'RARE' ? 'border-blue-500 bg-blue-900/20 hover:border-blue-300' : ''}
                            ${u.rarity === 'LEGENDARY' ? 'border-yellow-500 bg-yellow-900/20 hover:border-yellow-300' : ''}
                            ${u.rarity === 'CORRUPTED' ? 'border-red-500 bg-red-900/20 hover:border-red-300' : ''}
                        `}
                    >
                        <div className={`
                            p-4 rounded-full 
                            ${u.rarity === 'COMMON' ? 'bg-gray-800' : ''}
                            ${u.rarity === 'RARE' ? 'bg-blue-900' : ''}
                            ${u.rarity === 'LEGENDARY' ? 'bg-yellow-900' : ''}
                            ${u.rarity === 'CORRUPTED' ? 'bg-red-900' : ''}
                        `}>
                            {u.type === 'STAT' && <Zap size={32} />}
                            {u.type === 'WEAPON' && u.id !== 'homing' && <Activity size={32} />}
                            {u.id === 'homing' && <Target size={32} />}
                            {u.type === 'UTILITY' && u.id !== 'orbitals' && <Shield size={32} />}
                            {u.id === 'orbitals' && <Disc size={32} />}
                        </div>
                        <div>
                            <h3 className={`font-bold text-xl ${u.rarity === 'CORRUPTED' ? 'text-red-400 glitch' : 'text-white'}`}>{u.name}</h3>
                            <div className="text-xs font-mono opacity-50 mb-2">{u.rarity} {u.type}</div>
                            <p className="text-sm text-gray-300">{u.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};