import React, { useState, useEffect } from 'react';
import { GameState, spendPoint, evolveClass, awardXp } from '../gameEngine';
import { StatName, UpgradeClass, GameMode } from '../types';
import { CLASS_TREE, COLORS, getXpForLevel } from '../constants';
import { Shield, Sparkles, Award, Zap, ChevronRight, Play, RefreshCw, Eye, Swords, Target, Settings, Info } from 'lucide-react';

interface HUDProps {
  gameState: GameState;
  onSpendPoint: (stat: StatName) => void;
  onEvolve: (classId: string) => void;
  onRestart: (mode: GameMode, name: string, botCount?: number) => void;
  onApplyCheat: (action: string) => void;
  onGodModeToggle: () => void;
  godModeActive: boolean;
}

const STAT_LABELS: Record<StatName, { label: string; color: string; bg: string }> = {
  healthRegen: { label: 'Health Regen', color: '#ffb244', bg: 'bg-[#ffb244]' },
  maxHealth: { label: 'Max Health', color: '#85E37D', bg: 'bg-[#85E37D]' },
  bodyDamage: { label: 'Body Damage', color: '#B363EF', bg: 'bg-[#B363EF]' },
  bulletSpeed: { label: 'Bullet Speed', color: '#6584F6', bg: 'bg-[#6584F6]' },
  bulletPenetration: { label: 'Bullet Penetration', color: '#56F2E7', bg: 'bg-[#56F2E7]' },
  bulletDamage: { label: 'Bullet Damage', color: '#EF5F5F', bg: 'bg-[#EF5F5F]' },
  reload: { label: 'Reload Rate', color: '#F9E45B', bg: 'bg-[#F9E45B]' },
  movementSpeed: { label: 'Movement Speed', color: '#FF85F4', bg: 'bg-[#FF85F4]' },
};

export const HUD: React.FC<HUDProps> = ({
  gameState,
  onSpendPoint,
  onEvolve,
  onRestart,
  onApplyCheat,
  onGodModeToggle,
  godModeActive,
}) => {
  const { player, scoreLeaderboard, gameActive, gameMode, mapSize } = gameState;
  const [spawnName, setSpawnName] = useState('Tanker');
  const [selectedMode, setSelectedMode] = useState<GameMode>('FFA');
  const [showSandbox, setShowSandbox] = useState(false);
  const [botCount, setBotCount] = useState(25);
  const [showResultsReport, setShowResultsReport] = useState(true);

  // Automatically reset results view reporting when a new game starts
  useEffect(() => {
    if (gameActive) {
      setShowResultsReport(true);
    }
  }, [gameActive]);

  useEffect(() => {
    const defaultBotCounts: Record<GameMode, number> = {
      'FFA': 25,
      'TDM': 20,
      'MAZE': 18,
      'DOMINATION': 15
    };
    setBotCount(defaultBotCounts[selectedMode] || 25);
  }, [selectedMode]);

  // Filter possible class evolutions for current level and branch parent
  const getEligibleEvolutions = (): UpgradeClass[] => {
    if (player.level < 15) return [];
    
    // Level 15: parent is 'tank'
    if (player.level >= 15 && player.level < 30 && player.currentClass.id === 'tank') {
      return CLASS_TREE.filter(c => c.level === 15);
    }
    // Level 30: parent is current level 15 class
    if (player.level >= 30 && player.level < 45 && player.currentClass.level === 15) {
      return CLASS_TREE.filter(c => c.level === 30 && c.parentClassId === player.currentClass.id);
    }
    // Level 45: parent is current level 30 class
    if (player.level >= 45 && player.currentClass.level === 30) {
      return CLASS_TREE.filter(c => c.level === 45 && c.parentClassId === player.currentClass.id);
    }
    return [];
  };

  const eligibleEvo = getEligibleEvolutions();

  // Experience progress ratio calculation
  const currentLevelXp = getXpForLevel(player.level);
  const nextLevelXp = getXpForLevel(player.level + 1);
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const xpGainedInCurrent = player.xp - currentLevelXp;
  const xpProgressRatio = player.level >= 45 ? 1.0 : Math.max(0, Math.min(1.0, xpGainedInCurrent / xpNeededForNext));

  return (
    <div id="game_hud_overlay" className="absolute inset-0 pointer-events-none font-diep text-shadow-diep flex flex-col justify-between p-4 select-none">
      
      {/* ===================== TOP BAR / HEADER STATE ===================== */}
      <div className="flex justify-between items-start w-full pointer-events-none">
        
        {/* TOP LEFT: Evolve menu */}
        <div id="evolve_container" className="flex flex-col gap-2 max-w-sm pointer-events-auto">
          {eligibleEvo.length > 0 && (
            <div className="bg-black/15 border-diep-thick p-3.5 rounded-lg shadow-diep-lg flex flex-col gap-2 animate-bounce-short">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                <Sparkles size={14} className="animate-spin-slow" />
                <span>UPGRADES AVAILABLE! (Lvl {player.level})</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {eligibleEvo.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onEvolve(c.id)}
                    className="p-2 bg-[#555555] hover:bg-[#00B2E1]/80 hover:scale-103 active:scale-95 text-white font-diep border-diep rounded-md text-left transition-all duration-150 flex flex-col justify-between aspect-video group cursor-pointer shadow-diep"
                  >
                    <span className="font-bold text-sm tracking-tight text-white group-hover:text-white leading-none">{c.name}</span>
                    <span className="text-[9.5px] text-slate-200 font-sans group-hover:text-white line-clamp-2 mt-1 leading-tight">{c.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Class Badge */}
          <div className="bg-black/15 border-diep px-3.5 py-1.5 rounded-lg flex items-center gap-2 self-start shadow-diep text-white text-xs">
            <span className="text-slate-300 font-bold uppercase tracking-wider">Class:</span>
            <span className="font-black text-[#00B2E1] uppercase">{player.currentClass.name}</span>
            {godModeActive && (
              <span className="bg-[#EF5F5F] text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase shadow-diep animate-pulse">God Mode</span>
            )}
          </div>
        </div>

        {/* TOP MIDDLE: Alerts */}
        <div className="flex flex-col items-center gap-1 max-w-md text-center">
          {gameState.alerts.slice(-3).map((alert) => (
            <div
              key={alert.id}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg border border-slate-700/50 backdrop-blur-md animate-fade-in text-white bg-slate-950/80"
              style={{ borderLeft: `4px solid ${alert.color}` }}
            >
              {alert.text}
            </div>
          ))}
        </div>

        {/* TOP RIGHT: Leaderboard */}
        <div id="leaderboard_panel" className="bg-black/10 border-diep-thick p-3 rounded-lg shadow-diep-lg w-60 max-h-68 flex flex-col gap-2 pointer-events-auto">
          <div className="flex justify-between items-center border-b-2 border-[#555555] pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-100 uppercase tracking-wider">
              <Award size={14} className="text-[#FFE869]" />
              <span>Leaderboard</span>
            </div>
            <span className="text-[10px] bg-black/45 text-slate-300 border border-[#555555] px-1.5 py-0.5 rounded font-black uppercase">
              {gameMode}
            </span>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto text-xs font-black">
            {scoreLeaderboard.map((item, index) => (
              <div
                key={`${item.id}_${index}`}
                className={`flex justify-between items-center px-2 py-1 rounded-md transition-all ${
                  item.isPlayer ? 'bg-[#00B2E1]/20 border-2 border-[#00B2E1]/50' : 'bg-black/15 hover:bg-black/35'
                }`}
              >
                <div className="flex items-center gap-1 truncate max-w-[130px]">
                  <span className="text-[10px] text-slate-300 font-bold w-4">{index + 1}.</span>
                  <span style={{ color: item.color }} className="truncate font-black">{item.name}</span>
                </div>
                <span className="text-[10px] font-mono font-black text-slate-200">{item.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================== BOTTOM MAIN STATS & MINIMAP ===================== */}
      <div className="flex justify-between items-end w-full mt-auto">
        
        {/* BOTTOM LEFT: Stat Upgrades Dashboard */}
        <div id="skills_panel" className="flex flex-col gap-2.5 pointer-events-auto select-none">
          {player.availablePoints > 0 && (
            <div className="bg-yellow-400 border-diep text-[#555555] font-black text-[11px] px-3 py-1.5 rounded-lg shadow-diep animate-pulse self-start flex items-center gap-1.5">
              <Zap size={13} fill="currentColor" />
              <span>{player.availablePoints} SKILL POINTS! Press [+] or keys 1-8</span>
            </div>
          )}

          <div className="bg-black/10 border-diep-thick p-3 rounded-lg shadow-diep-lg w-68 flex flex-col gap-1.5">
            {(Object.keys(STAT_LABELS) as StatName[]).map((statName, index) => {
              const info = STAT_LABELS[statName];
              const points = player.statPointsSpent[statName];
              const cap = player.currentClass.id.includes('smasher') ? 10 : 7;
              
              return (
                <div key={statName} className="flex items-center justify-between text-xs font-black gap-2">
                  <div className="flex flex-col w-full">
                    {/* label and indices */}
                    <div className="flex justify-between text-[10px] text-slate-100 pb-0.5">
                      <span className="truncate uppercase">{info.label}</span>
                      <span className="font-diep text-slate-200">{points}/{cap}</span>
                    </div>
                    {/* indicator slots with professional stat-bar look */}
                    <div className="flex gap-0.5 h-3 bg-black/30 border border-[#555555] rounded-full p-0.5 items-center overflow-hidden">
                      {Array.from({ length: cap }).map((_, slotIdx) => (
                        <div
                          key={slotIdx}
                          className={`flex-1 h-full rounded-sm transition-all duration-150 ${
                            slotIdx < points ? info.bg : 'bg-[#555555]/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Increment button */}
                  <button
                    onClick={() => onSpendPoint(statName)}
                    disabled={player.availablePoints <= 0 || points >= cap}
                    className={`h-7 w-7 rounded-md border-2 flex items-center justify-center font-black transition-all ${
                      player.availablePoints > 0 && points < cap
                        ? 'bg-[#00E16F] border-[#555555] hover:bg-[#2BE26B] hover:scale-105 hover:translate-y-[-1px] text-[#555555] cursor-pointer active:scale-90 shadow-diep'
                        : 'bg-[#555555]/20 text-[#555555]/40 border-[#555555]/25 cursor-not-allowed'
                    }`}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM CENTER: XP & LEVEL PROGRESS */}
        <div id="progression_bar_panel" className="flex flex-col items-center gap-1 px-8 flex-grow max-w-sm">
          <div className="font-diep text-[16px] text-white text-shadow-diep-lg uppercase tracking-tight text-center">
            LEVEL {player.level} {player.currentClass.name}
          </div>
          {/* Level up meter - styled exactly match design body specs */}
          <div className="w-[320px] max-w-full h-5 bg-black/30 border-diep rounded-full p-0 relative flex items-center justify-center overflow-hidden shadow-diep">
            <div
              className="h-full bg-[#F9E45B] border-r border-[#555555] transition-all duration-300 absolute left-0 top-0"
              style={{ width: `${xpProgressRatio * 100}%` }}
            />
            <span className="text-[10px] font-black font-diep text-white select-none relative uppercase tracking-wider text-shadow-diep">
              {player.level >= 45 ? 'MAX LEVEL' : `XP Progress: ${Math.round(xpProgressRatio * 100)}%`}
            </span>
          </div>
          <div className="font-diep text-[12px] text-white text-shadow-diep mt-0.5 tracking-tight text-center">
            Score: {Math.round(player.score).toLocaleString()}
          </div>
        </div>

        {/* BOTTOM RIGHT: MINIMAP & MAP MODE */}
        <div id="minimap_outer" className="flex flex-col gap-2 items-end pointer-events-auto">
          {/* Cheat sandbox button */}
          <button
            onClick={() => setShowSandbox(!showSandbox)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#999999] border-2 border-[#555555] rounded-lg text-white hover:bg-slate-400 active:scale-95 transition-all w-fit shadow-diep font-black text-xs uppercase"
          >
            <Settings size={12} className="text-[#FFE869]" />
            <span>Sandbox Menu</span>
          </button>

          {/* Minimap Box representation */}
          <div className="bg-black/10 border-diep-thick rounded-lg p-1 shadow-diep-lg h-28 w-28 relative overflow-hidden flex items-center justify-center">
            {/* Center Nest region */}
            <div className="absolute h-9 w-9 bg-black/5 border border-dashed border-[#555555]/30 rounded-full" />
            
            {/* Miniature Player */}
            <div
              className="absolute h-1.5 w-1.5 rounded-full bg-[#00B2E1] border border-white pulse-glow animate-ping"
              style={{
                left: `${(player.x / mapSize) * 100}%`,
                top: `${(player.y / mapSize) * 100}%`,
              }}
            />
            <div
              className="absolute h-1.5 w-1.5 rounded-full bg-[#00B2E1] border border-white shadow shadow-white"
              style={{
                left: `${(player.x / mapSize) * 100}%`,
                top: `${(player.y / mapSize) * 100}%`,
              }}
            />

            {/* Teammates and Enemy pings */}
            {gameState.tanks.map((t) => {
              if (t.id === player.id) return null;
              const isFriend = gameMode === 'TDM' && t.team === player.team;
              const color = isFriend ? '#00E16F' : '#F14E54';
              return (
                <div
                  key={t.id}
                  className="absolute h-1 w-1 rounded-full shadow"
                  style={{
                    left: `${(t.x / mapSize) * 100}%`,
                    top: `${(t.y / mapSize) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              );
            })}

            {/* Dominators flags */}
            {gameState.dominators.map((dom) => {
              const color = dom.team === 'blue' ? COLORS.player : (dom.team === 'red' ? COLORS.enemy : COLORS.neutralGrey);
              return (
                <div
                  key={dom.id}
                  className="absolute h-1.5 w-1.5 transform rotate-45 border border-black/35"
                  style={{
                    left: `${(dom.x / mapSize) * 100}%`,
                    top: `${(dom.y / mapSize) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ===================== OVERLAYS: START MENU / GAME OVER (SANDBOX PANEL) ===================== */}
      
      {/* 1. Sandbox Panel Cheat modal overlay */}
      {showSandbox && (
        <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center pointer-events-auto z-40 animate-fade-in font-diep">
          <div className="bg-[#999999] border-diep-thick rounded-xl max-w-sm w-full p-5 flex flex-col gap-4 shadow-diep-lg relative text-white text-shadow-diep">
            <div className="flex justify-between items-center border-b-2 border-[#555555] pb-2.5">
              <div className="flex items-center gap-1.5 font-black text-[#FFE869] text-sm uppercase tracking-wide">
                <Settings size={16} />
                <span>Sandbox Tools</span>
              </div>
              <button
                onClick={() => setShowSandbox(false)}
                className="text-white hover:text-red-400 font-bold text-sm border-2 border-[#555555] bg-[#555555] px-2.5 py-0.5 rounded-lg shadow-diep cursor-pointer"
              >
                X
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { onApplyCheat('XP'); }}
                className="flex items-center justify-between p-2.5 bg-[#555555] hover:bg-[#00B2E1]/90 text-white rounded-lg text-xs font-bold border-2 border-[#555555] hover:scale-102 active:scale-95 transition-all text-left shadow-diep cursor-pointer"
              >
                <span>➕ Gain +5,000 XP</span>
                <span className="text-[10px] text-amber-300 font-mono">XP_BOOST</span>
              </button>
              
              <button
                onClick={() => { onApplyCheat('LVL'); }}
                className="flex items-center justify-between p-2.5 bg-[#555555] hover:bg-[#00B2E1]/90 text-white rounded-lg text-xs font-bold border-2 border-[#555555] hover:scale-102 active:scale-95 transition-all text-left shadow-diep cursor-pointer"
              >
                <span>🚀 Instant Max Level (45)</span>
                <span className="text-[10px] text-amber-300 font-mono">LEVEL_45</span>
              </button>

              <button
                onClick={() => { onApplyCheat('STATS'); }}
                className="flex items-center justify-between p-2.5 bg-[#555555] hover:bg-[#2BE26B] hover:text-[#555555] text-white rounded-lg text-xs font-bold border-2 border-[#555555] hover:scale-102 active:scale-95 transition-all text-left shadow-diep cursor-pointer"
              >
                <span>💪 Max Out Stat Multipliers</span>
                <span className="text-[10px] font-mono">MAX_STATS</span>
              </button>

              <button
                onClick={onGodModeToggle}
                className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-bold border-2 active:scale-95 hover:scale-102 transition-all text-left cursor-pointer shadow-diep ${
                  godModeActive 
                    ? 'bg-[#EF5F5F] border-[#555555] text-white hover:bg-red-600' 
                    : 'bg-[#555555] border-[#555555] text-white'
                }`}
              >
                <span>🛡️ Toggle God Mode (Invulnerable)</span>
                <span className="text-[9.5px] bg-[#555555]/60 text-white px-2 py-0.5 rounded font-bold uppercase border border-[#555555]/85">
                  {godModeActive ? 'ACTIVE' : 'OFF'}
                </span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-100 italic text-center pb-1 leading-relaxed border-t-2 border-[#555555] pt-2.5">
              💡 Use cheats to quickly evolve into Overlord, Annihilator, Booster or Necromancer!
            </p>
          </div>
        </div>
      )}

      {/* 2. Startup Menu / Restart Overlay Panel */}
      {!gameActive && (
        <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center gap-6 pointer-events-auto z-50 animate-fade-in text-white text-center font-diep">
          
          {gameState.victoryStatus && showResultsReport ? (
            /* Custom highly immersive and polished VICTORY / DEFEAT panel reports */
            <div className="flex flex-col items-center max-w-md w-full mx-auto p-8 border-diep-thick bg-[#999999] rounded-2xl shadow-diep-lg text-shadow-diep animate-scale-up">
              
              {gameState.victoryStatus === 'victory' ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#00E16F]/20 text-[#00E16F] flex items-center justify-center rounded-full border-4 border-[#00E16F] mb-4 shadow-diep animate-pulse">
                    <Award size={36} className="stroke-[3]" />
                  </div>
                  <h1 className="text-4xl font-black text-[#00E16F] text-shadow-diep-lg tracking-wider uppercase mb-1">
                    VICTORY!
                  </h1>
                  <p className="text-xs text-white font-bold uppercase tracking-widest opacity-80 mb-4 bg-black/20 px-3 py-1 rounded-full border border-white/10">
                    Battle Achieved
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#EF5F5F]/20 text-[#EF5F5F] flex items-center justify-center rounded-full border-4 border-[#EF5F5F] mb-4 shadow-diep animate-bounce">
                    <Swords size={32} className="stroke-[2.5]" />
                  </div>
                  <h1 className="text-4xl font-black text-[#EF5F5F] text-shadow-diep-lg tracking-wider uppercase mb-1">
                    DEFEATED
                  </h1>
                  <p className="text-xs text-white font-bold uppercase tracking-widest opacity-80 mb-4 bg-black/20 px-3 py-1 rounded-full border border-white/10">
                    Arena Overcome
                  </p>
                </div>
              )}

              {/* Verdict text reason */}
              <div className="bg-black/35 border-2 border-[#555555] rounded-xl px-5 py-4 w-full mb-6 font-medium text-xs text-stone-100 max-w-sm leading-relaxed text-center shadow-inner">
                {gameState.defeatReason || (gameState.victoryStatus === 'victory' ? 'Absolute dominance! You claimed the supreme victory.' : 'You fell in battle! Better luck in the next arena.')}
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3 w-full mb-6">
                <div className="bg-[#555555]/50 border-2 border-[#222222]/25 rounded-md p-3 flex flex-col justify-center shadow-inner">
                  <span className="text-[9.5px] text-zinc-300 font-bold uppercase tracking-wider">Final Class</span>
                  <span className="text-base font-black text-white truncate">{player.currentClass.name}</span>
                </div>
                
                <div className="bg-[#555555]/50 border-2 border-[#222222]/25 rounded-md p-3 flex flex-col justify-center shadow-inner">
                  <span className="text-[9.5px] text-zinc-300 font-bold uppercase tracking-wider">High Score</span>
                  <span className="text-lg font-black text-[#FFE869] font-mono">{(gameState.peakScore || player.score || 0).toLocaleString()}</span>
                </div>

                <div className="bg-[#555555]/50 border-2 border-[#222222]/25 rounded-md p-3 flex flex-col justify-center shadow-inner">
                  <span className="text-[9.5px] text-zinc-300 font-bold uppercase tracking-wider">Total Kills</span>
                  <span className="text-lg font-black text-[#00E16F]">{gameState.totalKills || 0}</span>
                </div>

                <div className="bg-[#555555]/50 border-2 border-[#222222]/25 rounded-md p-3 flex flex-col justify-center shadow-inner">
                  <span className="text-[9.5px] text-zinc-300 font-bold uppercase tracking-wider">Survival Time</span>
                  <span className="text-lg font-black text-[#00B2E1] font-mono">
                    {Math.floor((gameState.gameTimeElapsed || 0) / 60)}m {(gameState.gameTimeElapsed || 0) % 60}s
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => onRestart(selectedMode, spawnName, botCount)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#00E16F] hover:bg-[#2BE26B] hover:scale-[1.02] active:scale-98 transition-all text-[#555555] border-diep-thick font-black tracking-wide text-sm rounded-lg cursor-pointer shadow-diep"
                >
                  <RefreshCw size={14} className="animate-spin-slow animate-pulse" />
                  <span>RESPAWN INTO ARENA</span>
                </button>

                <button
                  onClick={() => setShowResultsReport(false)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#00B2E1] hover:bg-[#34C5ED] hover:scale-[1.02] active:scale-98 transition-all text-white border-diep-thick font-black tracking-wide text-xs rounded-lg cursor-pointer shadow-diep"
                >
                  <Settings size={13} />
                  <span>CHANGE GAME OPTIONS</span>
                </button>
              </div>

            </div>
          ) : (
            /* Traditional Spawning Menu Selection */
            <div className="flex flex-col items-center max-w-lg p-8 border-diep-thick bg-[#999999] rounded-2xl shadow-diep-lg text-shadow-diep">
              {/* Title banner */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-black/25 text-[#FFE869] rounded-full text-[11px] font-bold border-2 border-[#555555] tracking-wide uppercase mb-3 shadow-diep">
                <Swords size={12} />
                <span>Diep.io Offline Arena Simulation</span>
              </div>
              
              <h1 className="text-5xl font-black text-white text-shadow-diep-lg tracking-normal uppercase mb-2">
                DIEP.<span className="text-[#00B2E1]">IO</span>
              </h1>
              <p className="text-xs text-stone-100 font-sans font-medium max-w-sm leading-relaxed mb-6">
                An offline singleplayer battle arena with smooth steering controls, retro flat shapes, bullet pen mechanics and fully customizable branches.
              </p>

              {/* Nickname Input */}
              <div className="flex flex-col gap-1 w-full mb-4 font-diep">
                <label className="text-left text-xs text-white font-bold uppercase tracking-wider pl-1">
                  Tank Nickname:
                </label>
                <input
                  type="text"
                  value={spawnName}
                  onChange={(e) => setSpawnName(e.target.value.slice(0, 16))}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-[#555555] bg-slate-100 text-[#555555] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#00B2E1] transition-all text-center shadow-inner"
                  placeholder="Enter nickname..."
                />
              </div>

              {/* Game Mode Selector buttons with retro alignment */}
              <div className="flex flex-col gap-1 w-full mb-6 font-diep">
                <label className="text-left text-xs text-white font-black uppercase tracking-wider pl-1">
                  Select Game Mode:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['FFA', 'TDM', 'MAZE', 'DOMINATION'] as GameMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className={`py-2 px-1 rounded-md text-[11px] font-black border-2 transition-all shadow-diep cursor-pointer ${
                        selectedMode === mode
                          ? 'bg-[#00B2E1] border-[#555555] text-white scale-103'
                          : 'bg-[#555555] border-[#555555]/80 text-slate-100 hover:bg-slate-600'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot Count Selector setting */}
              <div className="flex flex-col gap-1.5 w-full mb-5 font-diep">
                <div className="flex justify-between items-center pl-1 pr-1">
                  <label className="text-left text-xs text-white font-bold uppercase tracking-wider">
                    Bot Count:
                  </label>
                  <span className="text-xs text-[#00E16F] font-black">{botCount} Bots</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBotCount(prev => Math.max(0, prev - 5))}
                    className="px-2.5 py-1.5 rounded bg-[#555555] border-2 border-[#666666] text-white hover:bg-slate-600 font-bold text-xs select-none shadow"
                  >
                    -5
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={botCount}
                    onChange={(e) => setBotCount(parseInt(e.target.value) || 0)}
                    className="flex-grow accent-[#00B2E1] h-1.5 bg-slate-300 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setBotCount(prev => Math.min(100, prev + 5))}
                    className="px-2.5 py-1.5 rounded bg-[#555555] border-2 border-[#666666] text-white hover:bg-slate-600 font-bold text-xs select-none shadow"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* Launch CTA */}
              <button
                onClick={() => onRestart(selectedMode, spawnName, botCount)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#00E16F] hover:bg-[#2BE26B] hover:scale-[1.02] active:scale-98 transition-all text-[#555555] border-diep-thick font-black tracking-wide text-sm rounded-lg cursor-pointer shadow-diep"
              >
                <Play fill="currentColor" size={14} />
                <span>SPAWN INTO THE ARENA</span>
              </button>
            </div>
          )}

          <div className="flex select-none gap-5 text-[10px] text-zinc-100 font-sans max-w-md bg-black/40 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#555555] inline-flex flex-wrap items-center justify-center text-shadow-diep shadow-diep animate-pulse">
            <span className="flex items-center gap-1"><b>WASD</b> Navigation</span>
            <span className="flex items-center gap-1"><b>Mouse</b> Point / Aim</span>
            <span className="flex items-center gap-1"><b>LClick</b> Fire / Drone focus</span>
            <span className="flex items-center gap-1"><b>RClick</b> Drone repel</span>
            <span className="flex items-center gap-1"><b>1-8</b> Stat allocates</span>
          </div>
        </div>
      )}

    </div>
  );
};
