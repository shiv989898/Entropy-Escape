import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { Overlay } from './components/Overlay';
import { StoryOverlay } from './components/StoryOverlay';
import { GameState, Upgrade, LoreFragment, StoryBeat } from './types';
import { LORE_DATABASE } from './game/constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [showWarning, setShowWarning] = useState(false);
  
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [loop, setLoop] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [maxTime, setMaxTime] = useState(60);
  
  // New States
  const [xp, setXp] = useState(0);
  const [maxXp, setMaxXp] = useState(100);
  const [abilityCooldown, setAbilityCooldown] = useState(0);
  const [maxAbilityCooldown, setMaxAbilityCooldown] = useState(10);
  
  // Lore & Story
  const [collectedLore, setCollectedLore] = useState<LoreFragment[]>([]);
  const [currentLoreFragment, setCurrentLoreFragment] = useState<LoreFragment | null>(null);
  const [activeStoryBeat, setActiveStoryBeat] = useState<StoryBeat | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create engine
    const engine = new GameEngine(canvasRef.current, {
      onHealthChange: (curr, max) => {
          setHealth(curr);
          setMaxHealth(max);
      },
      onScoreChange: (s) => setScore(s),
      onLoopChange: (l, t, max) => {
          setLoop(l);
          setTimeRemaining(Math.max(0, t));
          setMaxTime(max);
      },
      onGameOver: (finalStats) => {
          setGameState(GameState.GAME_OVER);
          setScore(Math.floor(finalStats.score));
          setShowWarning(false);
      },
      onLevelUp: () => {
          setGameState(GameState.LEVEL_UP);
          setShowWarning(false);
      },
      onPauseToggle: (isPaused) => {
          setGameState(isPaused ? GameState.PAUSED : GameState.PLAYING);
      },
      onXpChange: (curr, max, level) => {
          setXp(curr);
          setMaxXp(max);
      },
      onAbilityCooldown: (curr, max) => {
          setAbilityCooldown(curr);
          setMaxAbilityCooldown(max);
      },
      onDangerWarning: () => {
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 3000); 
      },
      onLoreUnlock: (fragment) => {
          setCollectedLore(prev => {
              if (prev.find(p => p.id === fragment.id)) return prev;
              return [...prev, fragment];
          });
          setCurrentLoreFragment(fragment);
      },
      onStoryTrigger: (beat) => {
          setActiveStoryBeat(beat);
          setGameState(GameState.CUTSCENE);
      }
    });

    engineRef.current = engine;
    engine.draw();

    return () => {
      engine.destroy(); 
    };
  }, []);

  const handleStart = useCallback(() => {
      if(engineRef.current) {
          engineRef.current.reset();
          engineRef.current.start();
          setGameState(GameState.PLAYING);
          setShowWarning(false);
      }
  }, []);

  const handleRestart = useCallback(() => {
      handleStart();
  }, [handleStart]);

  const handleLoadCheckpoint = useCallback(() => {
      if(engineRef.current) {
          engineRef.current.loadCheckpoint();
          setGameState(GameState.PLAYING);
          setShowWarning(false);
      }
  }, []);

  const handleResume = useCallback(() => {
      if(engineRef.current) {
          engineRef.current.togglePause();
          setCurrentLoreFragment(null); 
      }
  }, []);

  const handleUpgradeSelect = useCallback((upgrade: Upgrade) => {
      if(engineRef.current) {
          engineRef.current.applyUpgrade(upgrade);
          setGameState(GameState.PLAYING);
      }
  }, []);
  
  const handleCloseLore = useCallback(() => {
      setCurrentLoreFragment(null);
      if(engineRef.current) {
          engineRef.current.togglePause(); 
      }
  }, []);

  const handleStoryComplete = useCallback(() => {
      setActiveStoryBeat(null);
      if(engineRef.current) {
          engineRef.current.resumeFromCutscene();
          setGameState(GameState.PLAYING);
      }
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
        <canvas 
            ref={canvasRef} 
            className="block cursor-none outline-none"
            style={{ display: 'block' }} 
        />
        
        {/* Story Overlay */}
        {activeStoryBeat && (
            <StoryOverlay 
                beat={activeStoryBeat} 
                onComplete={handleStoryComplete} 
            />
        )}

        <Overlay 
            gameState={gameState}
            score={score}
            health={health}
            maxHealth={maxHealth}
            xp={xp}
            maxXp={maxXp}
            abilityCooldown={abilityCooldown}
            maxAbilityCooldown={maxAbilityCooldown}
            loop={loop}
            timeRemaining={timeRemaining}
            maxTime={maxTime}
            showWarning={showWarning}
            collectedLore={collectedLore}
            currentLoreFragment={currentLoreFragment}
            onStart={handleStart}
            onRestart={handleRestart}
            onResume={handleResume}
            onUpgradeSelect={handleUpgradeSelect}
            onCloseLore={handleCloseLore}
            onLoadCheckpoint={handleLoadCheckpoint}
        />
    </div>
  );
};

export default App;