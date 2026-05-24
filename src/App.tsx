import { useEffect, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { initGame, tickGame, spendPoint, evolveClass, awardXp } from './gameEngine';
import { ControlState, GameMode, StatName, Tank } from './types';
import { CLASS_TREE, STATS_BASE, getStatValue } from './constants';
import { Sparkles, Swords, Play } from 'lucide-react';

export default function App() {
  const [activeMode, setActiveMode] = useState<GameMode>('FFA');
  const [godMode, setGodMode] = useState(false);

  // Synchronized React-state for overlay HUD layers to avoid lag
  const [playerHud, setPlayerHud] = useState({
    level: 1,
    xp: 0,
    score: 0,
    currentClass: CLASS_TREE[0],
    availablePoints: 0,
    statPointsSpent: {
      healthRegen: 0, maxHealth: 0, bodyDamage: 0, bulletSpeed: 0,
      bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0
    },
    alerts: [] as any[],
    scoreLeaderboard: [] as any[],
    gameActive: false,
    gameMode: 'FFA' as GameMode,
    mapSize: 4000,
    victoryStatus: null as 'victory' | 'defeat' | null,
    defeatReason: '',
    gameTimeElapsed: 0,
    totalKills: 0,
    peakScore: 0,
    botCountSetting: 25
  });

  // Mutably updated core game states to run physics smoothly at 60fps
  const stateRef = useRef(initGame('FFA', 'Tank'));
  const controlsRef = useRef<ControlState>({
    w: false,
    a: false,
    s: false,
    d: false,
    mouseLeft: false,
    mouseRight: false,
    mouseX: 2000,
    mouseY: 2000,
  });

  const handleControlChange = (updates: Partial<ControlState>) => {
    Object.assign(controlsRef.current, updates);
  };

  // Synchronize initial configuration parameters
  useEffect(() => {
    setPlayerHud({
      level: stateRef.current.player.level,
      xp: stateRef.current.player.xp,
      score: stateRef.current.player.score,
      currentClass: stateRef.current.player.currentClass,
      availablePoints: stateRef.current.player.availablePoints,
      statPointsSpent: { ...stateRef.current.player.statPointsSpent },
      alerts: [...stateRef.current.alerts],
      scoreLeaderboard: [...stateRef.current.scoreLeaderboard],
      gameActive: stateRef.current.gameActive,
      gameMode: stateRef.current.gameMode,
      mapSize: stateRef.current.mapSize,
      victoryStatus: stateRef.current.victoryStatus || null,
      defeatReason: stateRef.current.defeatReason || '',
      gameTimeElapsed: stateRef.current.gameTimeElapsed || 0,
      totalKills: stateRef.current.totalKills || 0,
      peakScore: stateRef.current.peakScore || 0,
      botCountSetting: stateRef.current.botCountSetting || 25,
    });
  }, []);

  const handleSpawn = (mode: GameMode, nickname: string, chosenBotCount?: number) => {
    // Blur any active inputs to ensure keyboard controls focus immediately
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const cleanedName = nickname.trim() || 'Tank';
    const nextState = initGame(mode, cleanedName, chosenBotCount);
    stateRef.current = nextState;
    setActiveMode(mode);
    setGodMode(false);
    
    controlsRef.current = {
      w: false, a: false, s: false, d: false,
      mouseLeft: false, mouseRight: false,
      mouseX: nextState.mapSize / 2,
      mouseY: nextState.mapSize / 2
    };

    setPlayerHud({
      level: nextState.player.level,
      xp: nextState.player.xp,
      score: nextState.player.score,
      currentClass: nextState.player.currentClass,
      availablePoints: nextState.player.availablePoints,
      statPointsSpent: { ...nextState.player.statPointsSpent },
      alerts: [...nextState.alerts],
      scoreLeaderboard: [...nextState.scoreLeaderboard],
      gameActive: nextState.gameActive,
      gameMode: nextState.gameMode,
      mapSize: nextState.mapSize,
      victoryStatus: nextState.victoryStatus || null,
      defeatReason: nextState.defeatReason || '',
      gameTimeElapsed: nextState.gameTimeElapsed || 0,
      totalKills: nextState.totalKills || 0,
      peakScore: nextState.peakScore || 0,
      botCountSetting: nextState.botCountSetting || 25,
    });
  };

  // Setup key down listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') return; // don't capture typing

      const key = e.key.toLowerCase();
      const code = e.code;
      
      // Movements (Supports standard WASD, QWERTY physical layout-independent positions, Cyrillic цфыв, and Arrows)
      if (key === 'w' || code === 'KeyW' || e.key === 'ArrowUp' || key === 'arrowup' || key === 'ц') { controlsRef.current.w = true; }
      if (key === 's' || code === 'KeyS' || e.key === 'ArrowDown' || key === 'arrowdown' || key === 'ы') { controlsRef.current.s = true; }
      if (key === 'a' || code === 'KeyA' || e.key === 'ArrowLeft' || key === 'arrowleft' || key === 'ф') { controlsRef.current.a = true; }
      if (key === 'd' || code === 'KeyD' || e.key === 'ArrowRight' || key === 'arrowright' || key === 'в') { controlsRef.current.d = true; }

      // Spacebar to respawn if game ended
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (!stateRef.current.gameActive) {
          handleSpawn(stateRef.current.gameMode, stateRef.current.player.name);
        }
      }

      // Quick-spend hotkeys '1' to '8'
      const keyMap: Record<string, StatName> = {
        '1': 'healthRegen',
        '2': 'maxHealth',
        '3': 'bodyDamage',
        '4': 'bulletSpeed',
        '5': 'bulletPenetration',
        '6': 'bulletDamage',
        '7': 'reload',
        '8': 'movementSpeed'
      };

      if (keyMap[key]) {
        e.preventDefault();
        handleSpendPoint(keyMap[key]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      const code = e.code;
      if (key === 'w' || code === 'KeyW' || e.key === 'ArrowUp' || key === 'arrowup' || key === 'ц') { controlsRef.current.w = false; }
      if (key === 's' || code === 'KeyS' || e.key === 'ArrowDown' || key === 'arrowdown' || key === 'ы') { controlsRef.current.s = false; }
      if (key === 'a' || code === 'KeyA' || e.key === 'ArrowLeft' || key === 'arrowleft' || key === 'ф') { controlsRef.current.a = false; }
      if (key === 'd' || code === 'KeyD' || e.key === 'ArrowRight' || key === 'arrowright' || key === 'в') { controlsRef.current.d = false; }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Frame simulation ticker
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let counter = 0;

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);

      // Bound delta limits to avoid extreme splits
      let dt = (time - lastTime) / 16.666; // Normalized to 60 FPS scale
      if (dt > 4.5) dt = 4.5; // slow down physics to avoid wall clips
      lastTime = time;

      // Ensure God Mode protection applies every frame
      if (godMode && stateRef.current.player) {
        stateRef.current.player.hp = stateRef.current.player.maxHp;
      }

      // Tick core game engine parameters
      stateRef.current = tickGame(stateRef.current, controlsRef.current, dt);

      // Force instant React state sync upon game over or victory to remove throttled latency
      const isGameOverTransition = !stateRef.current.gameActive && playerHud.gameActive;

      // Throttling React state sync to keep performance high (at 20 FPS instead of 60Hz)
      counter++;
      if (counter >= 3 || isGameOverTransition) {
        counter = 0;
        const pl = stateRef.current.player;
        setPlayerHud({
          level: pl.level,
          xp: pl.xp,
          score: pl.score,
          currentClass: pl.currentClass,
          availablePoints: pl.availablePoints,
          statPointsSpent: { ...pl.statPointsSpent },
          alerts: [...stateRef.current.alerts],
          scoreLeaderboard: [...stateRef.current.scoreLeaderboard],
          gameActive: stateRef.current.gameActive,
          gameMode: stateRef.current.gameMode,
          mapSize: stateRef.current.mapSize,
          victoryStatus: stateRef.current.victoryStatus || null,
          defeatReason: stateRef.current.defeatReason || '',
          gameTimeElapsed: stateRef.current.gameTimeElapsed || 0,
          totalKills: stateRef.current.totalKills || 0,
          peakScore: stateRef.current.peakScore || 0,
          botCountSetting: stateRef.current.botCountSetting || 25,
        });
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [godMode]);

  // Handle stat points allocation
  const handleSpendPoint = (stat: StatName) => {
    const pl = stateRef.current.player;
    spendPoint(pl, stat);
    
    // Sync React overlays instantly for prompt button disabling feedback
    setPlayerHud(prev => ({
      ...prev,
      availablePoints: pl.availablePoints,
      statPointsSpent: { ...pl.statPointsSpent }
    }));
  };

  // Handle Class mutation evolution
  const handleEvolve = (classId: string) => {
    const pl = stateRef.current.player;
    evolveClass(pl, classId, stateRef.current);
    
    setPlayerHud(prev => ({
      ...prev,
      currentClass: pl.currentClass,
      statPointsSpent: { ...pl.statPointsSpent },
      availablePoints: pl.availablePoints,
    }));
  };

  // Handle god mode state toggles
  const handleGodModeToggle = () => {
    setGodMode(!godMode);
    
    const textLabel = !godMode ? '🛡️ God Mode activated!' : '⚠️ God Mode deactivated!';
    stateRef.current.alerts.push({
      id: `cheat_god_${Math.random()}`,
      text: textLabel,
      color: !godMode ? '#00e16f' : '#f14e54',
      timestamp: Date.now()
    });
  };

  // Sandbox Cheats implementation:
  const handleApplyCheat = (action: string) => {
    const pl = stateRef.current.player;
    if (!pl) return;

    if (action === 'XP') {
      // Award XP points
      awardXp(pl, 5000, stateRef.current);
    } else if (action === 'LVL') {
      // Direct max
      awardXp(pl, 25000, stateRef.current);
    } else if (action === 'STATS') {
      // Max out spent points directly
      const cap = pl.currentClass.id.includes('smasher') ? 10 : 7;
      (Object.keys(pl.statPointsSpent) as StatName[]).forEach((s) => {
        pl.statPointsSpent[s] = cap;
        pl.stats[s] = getStatValue(s, cap, pl.currentClass.id.includes('smasher'));
      });
      pl.availablePoints = 0;
      
      stateRef.current.alerts.push({
        id: `cheat_sts_${Math.random()}`,
        text: '💪 All stats maxed fully!',
        color: '#00e16f',
        timestamp: Date.now()
      });
    }

    setPlayerHud(prev => ({
      ...prev,
      level: pl.level,
      xp: pl.xp,
      score: pl.score,
      availablePoints: pl.availablePoints,
      statPointsSpent: { ...pl.statPointsSpent },
    }));
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 flex flex-col justify-center items-center overflow-hidden">
      
      {/* Outer Dashboard layout wrapper */}
      <div className="w-full h-full max-w-7xl max-h-4xl flex flex-col relative p-2 sm:p-4">
        
        {/* Absolute Game view screen grid */}
        <div className="flex-grow w-full h-full relative">
          <GameCanvas
            gameStateRef={stateRef}
            onControlChange={handleControlChange}
            onSpawn={(name) => handleSpawn(activeMode, name)}
          />
          
          <HUD
            gameState={{
              player: {
                level: playerHud.level,
                xp: playerHud.xp,
                score: playerHud.score,
                currentClass: playerHud.currentClass,
                availablePoints: playerHud.availablePoints,
                statPointsSpent: playerHud.statPointsSpent,
                x: stateRef.current?.player?.x || 0,
                y: stateRef.current?.player?.y || 0,
                id: stateRef.current?.player?.id || 'player',
                team: stateRef.current?.player?.team || 'blue',
              },
              tanks: stateRef.current?.tanks || [],
              dominators: stateRef.current?.dominators || [],
              alerts: playerHud.alerts,
              scoreLeaderboard: playerHud.scoreLeaderboard,
              gameActive: playerHud.gameActive,
              gameMode: playerHud.gameMode,
              mapSize: playerHud.mapSize,
              victoryStatus: playerHud.victoryStatus,
              defeatReason: playerHud.defeatReason,
              gameTimeElapsed: playerHud.gameTimeElapsed,
              totalKills: playerHud.totalKills,
              peakScore: playerHud.peakScore,
              botCountSetting: playerHud.botCountSetting,
            } as any}
            onSpendPoint={handleSpendPoint}
            onEvolve={handleEvolve}
            onRestart={handleSpawn}
            onApplyCheat={handleApplyCheat}
            onGodModeToggle={handleGodModeToggle}
            godModeActive={godMode}
          />
        </div>

      </div>

    </div>
  );
}
