import { Tank, Bullet, Drone, Shape, Wall, Dominator, AlertMessage, ControlState, UpgradeClass, GameMode, StatName, BarrelConfig } from './types';
import { CLASS_TREE, COLORS, getStatValue, getXpForLevel, MAP_SIZES, getStatPointsForLevel } from './constants';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Distance helper
export function getDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Helper to check collision between a circle and a rectangle
function checkCircleRectCollision(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const distance = getDist(cx, cy, closestX, closestY);
  return {
    collides: distance < r,
    closestX,
    closestY,
    dist: distance
  };
}

// Initialize clean game state
export interface GameState {
  player: Tank;
  tanks: Tank[]; // Player + Bots
  bullets: Bullet[];
  drones: Drone[];
  shapes: Shape[];
  walls: Wall[];
  dominators: Dominator[];
  alerts: AlertMessage[];
  scoreLeaderboard: { id: string; name: string; score: number; color: string; isPlayer: boolean }[];
  mapSize: number;
  gameMode: GameMode;
  lastUpdate: number;
  gameActive: boolean;
  camX: number;
  camY: number;
  camZoom: number;
  blueBaseZone: { x1: number; y1: number; x2: number; y2: number };
  redBaseZone: { x1: number; y1: number; x2: number; y2: number };
  
  // End game results
  victoryStatus?: 'victory' | 'defeat' | null;
  defeatReason?: string;
  gameTimeElapsed?: number;
  totalKills?: number;
  peakScore?: number;
  botCountSetting?: number;
  startTime?: number; // game start epoch
}

export function initGame(mode: GameMode, playerName: string = 'Tank', chosenBotCount?: number): GameState {
  const mapSize = MAP_SIZES[mode];
  const finalBotCount = chosenBotCount !== undefined ? chosenBotCount : (mode === 'MAZE' ? 18 : (mode === 'DOMINATION' ? 15 : 25));
  
  // Safe zones for TDM teams
  const baseSize = 400;
  const blueBaseZone = { x1: 0, y1: 0, x2: baseSize, y2: baseSize };
  const redBaseZone = { x1: mapSize - baseSize, y1: mapSize - baseSize, x2: mapSize, y2: mapSize };

  // Generate Maze Walls
  const walls: Wall[] = [];
  if (mode === 'MAZE') {
    const cellSize = 500;
    const wallThickness = 45;
    for (let x = cellSize; x < mapSize; x += cellSize) {
      for (let y = cellSize; y < mapSize; y += cellSize) {
        // Create symmetric maze layout
        if ((x + y) % 3 === 0) {
          // Horizontal block
          walls.push({ x: x - 150, y: y, width: 300, height: wallThickness });
        } else if ((x + y) % 5 === 2) {
          // Vertical block
          walls.push({ x: x, y: y - 150, width: wallThickness, height: 300 });
        }
      }
    }
  }

  // Generate Dominators
  const dominators: Dominator[] = [];
  if (mode === 'DOMINATION') {
    const coordDeltas = [0.3, 0.7];
    const types: ('gunner' | 'destroyer' | 'trapper')[] = ['gunner', 'destroyer', 'trapper', 'gunner'];
    let typeIdx = 0;
    for (const hFraction of coordDeltas) {
      for (const vFraction of coordDeltas) {
        dominators.push({
          id: `dom_${typeIdx}`,
          x: mapSize * hFraction,
          y: mapSize * vFraction,
          vx: 0,
          vy: 0,
          radius: 80,
          color: COLORS.neutralGrey,
          hp: 2000,
          maxHp: 2000,
          damage: 50,
          createdTime: Date.now(),
          team: 'neutral',
          dominatorType: types[typeIdx++ % 3],
          angle: 0,
          lastShotTime: 0
        });
      }
    }
  }

  // Determine safe spawn for player avoiding the high-level high-density Center Nest or walls
  let spawnX = mode === 'TDM' ? 200 : mapSize / 2;
  let spawnY = mode === 'TDM' ? 200 : mapSize / 2;
  if (mode !== 'TDM') {
    let px = 0;
    let py = 0;
    let attempts = 0;
    let valid = false;
    const nestRadius = 600; // Pentagon Nest is 400px, keep player 600px away from center at spawn!
    const center = mapSize / 2;
    while (!valid && attempts < 100) {
      attempts++;
      px = 250 + Math.random() * (mapSize - 500);
      py = 250 + Math.random() * (mapSize - 500);
      
      const distToCenter = getDist(px, py, center, center);
      if (distToCenter < nestRadius) continue;
      
      let hitsWall = false;
      for (const w of walls) {
        const col = checkCircleRectCollision(px, py, 35, w.x, w.y, w.width, w.height);
        if (col.collides) {
          hitsWall = true;
          break;
        }
      }
      if (!hitsWall) valid = true;
    }
    if (valid) {
      spawnX = px;
      spawnY = py;
    } else {
      spawnX = 350;
      spawnY = 350;
    }
  } else {
    // TDM: spawn safe in blue base corner
    spawnX = 100 + Math.random() * 200;
    spawnY = 100 + Math.random() * 200;
  }

  const baseHp = getStatValue('maxHealth', 0);

  // Starting tank
  const player: Tank = {
    id: 'player',
    name: playerName || 'Tank',
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    radius: 20,
    color: COLORS.player,
    hp: baseHp,
    maxHp: baseHp,
    damage: 15,
    createdTime: Date.now(),
    isBot: false,
    team: mode === 'TDM' ? 'blue' : 'neutral',
    level: 1,
    xp: 0,
    score: 0,
    kills: 0,
    currentClass: CLASS_TREE[0], // base normal tank
    stats: {
      healthRegen: getStatValue('healthRegen', 0),
      maxHealth: baseHp,
      bodyDamage: getStatValue('bodyDamage', 0),
      bulletSpeed: getStatValue('bulletSpeed', 0),
      bulletPenetration: getStatValue('bulletPenetration', 0),
      bulletDamage: getStatValue('bulletDamage', 0),
      reload: getStatValue('reload', 0),
      movementSpeed: getStatValue('movementSpeed', 0),
    },
    statPointsSpent: {
      healthRegen: 0,
      maxHealth: 0,
      bodyDamage: 0,
      bulletSpeed: 0,
      bulletPenetration: 0,
      bulletDamage: 0,
      reload: 0,
      movementSpeed: 0,
    },
    availablePoints: 0,
    angle: 0,
    lastShotTime: [0],
    recoilProgress: [0],
    skillPointsMax: 7,
    invisibility: 0,
    lastMoveOrShootTime: Date.now(),
  };

  const initialTanks = [player];
  
  const BOT_PERSONALITY_TYPES: ('AGGRESSIVE' | 'COWARD' | 'FARMER' | 'CAMPER' | 'DODGER' | 'RAMMER' | 'SNIPER' | 'CHAOTIC' | 'DEFENDER' | 'AVENGER')[] = [
    'AGGRESSIVE', 'COWARD', 'FARMER', 'CAMPER', 'DODGER', 'RAMMER', 'SNIPER', 'CHAOTIC', 'DEFENDER', 'AVENGER'
  ];

  // Add some initial bots
  for (let i = 0; i < finalBotCount; i++) {
    const isBlue = mode === 'TDM' ? (i % 2 === 0) : false;
    const botTeam = mode === 'TDM' ? (isBlue ? 'blue' : 'red') : 'neutral';
    
    let rx = Math.random() * mapSize;
    let ry = Math.random() * mapSize;

    if (mode === 'TDM') {
      if (isBlue) {
        rx = Math.random() * 300;
        ry = Math.random() * 300;
      } else {
        rx = mapSize - Math.random() * 300;
        ry = mapSize - Math.random() * 300;
      }
    } else {
      // Don't spawn bots right on player
      while (getDist(rx, ry, player.x, player.y) < 600) {
        rx = Math.random() * mapSize;
        ry = Math.random() * mapSize;
      }
    }

    const botLevel = 1; // Fair start: start at level 1 with 0 score!
    const botClass = CLASS_TREE[0]; // Start as standard Tank!
    
    const bot: Tank = {
      id: `bot_${generateId()}`,
      name: `Bot ${Math.floor(Math.random() * 900) + 100}`,
      x: rx,
      y: ry,
      vx: 0,
      vy: 0,
      radius: 20,
      color: botTeam === 'blue' ? COLORS.player : COLORS.enemy,
      hp: 100,
      maxHp: 100,
      damage: 15,
      createdTime: Date.now(),
      isBot: true,
      team: botTeam,
      level: botLevel,
      xp: 0,
      score: 0,
      kills: 0,
      currentClass: botClass,
      stats: {
        healthRegen: 0, maxHealth: 0, bodyDamage: 0, bulletSpeed: 0,
        bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0
      },
      statPointsSpent: {
        healthRegen: 0, maxHealth: 0, bodyDamage: 0, bulletSpeed: 0,
        bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0
      },
      availablePoints: 0,
      angle: Math.random() * Math.PI * 2,
      lastShotTime: Array(botClass.barrels.length).fill(0),
      recoilProgress: Array(botClass.barrels.length).fill(0),
      skillPointsMax: botClass.id.includes('smasher') ? 10 : 7,
      invisibility: 0,
      lastMoveOrShootTime: Date.now(),
      botPersonality: BOT_PERSONALITY_TYPES[Math.floor(Math.random() * BOT_PERSONALITY_TYPES.length)],
      aiState: 'FARM',
      aiTargetId: null,
      aiTargetTimer: 0,
    };
    
    // Allocate stats for and update stats values
    allocateStatsAutomatically(bot);
    initialTanks.push(bot);
  }

  // Populate shapes immediately
  const initialShapes: Shape[] = [];
  const maxShapes = mode === 'MAZE' ? 120 : (mode === 'DOMINATION' ? 150 : 250);
  for (let i = 0; i < maxShapes; i++) {
    initialShapes.push(spawnShape(mapSize, walls, initialTanks));
  }

  return {
    player,
    tanks: initialTanks,
    bullets: [],
    drones: [],
    shapes: initialShapes,
    walls,
    dominators,
    alerts: [{ id: 'init', text: `Welcome to Diep.io Offline! Mode: ${mode}`, color: '#00E16F', timestamp: Date.now() }],
    scoreLeaderboard: [],
    mapSize,
    gameMode: mode,
    lastUpdate: Date.now(),
    gameActive: true,
    camX: player.x,
    camY: player.y,
    camZoom: 1.0,
    blueBaseZone,
    redBaseZone,
    victoryStatus: null,
    defeatReason: '',
    totalKills: 0,
    peakScore: 0,
    botCountSetting: finalBotCount,
    startTime: Date.now()
  };
}

function getRandomClass(level: number): UpgradeClass {
  const eligible = CLASS_TREE.filter(c => level >= c.level);
  return eligible[Math.floor(Math.random() * eligible.length)] || CLASS_TREE[0];
}

// Automatically distribute stats for bot based on category template
function allocateStatsAutomatically(bot: Tank) {
  const totalPoints = getStatPointsForLevel(bot.level);
  const spends = totalPoints;
  const traits = bot.currentClass.visualType;
  
  // Decide archetype
  let keys: StatName[] = [];
  if (traits === 'smasher') {
    keys = ['maxHealth', 'bodyDamage', 'movementSpeed', 'healthRegen'];
  } else if (traits === 'sniper') {
    keys = ['bulletSpeed', 'bulletDamage', 'bulletPenetration', 'reload', 'movementSpeed', 'maxHealth'];
  } else {
    keys = ['reload', 'bulletDamage', 'bulletPenetration', 'bulletSpeed', 'movementSpeed', 'maxHealth', 'healthRegen', 'bodyDamage'];
  }

  const limitCap = bot.currentClass.id.includes('smasher') ? 10 : 7;
  for (let i = 0; i < spends; i++) {
    const preferredStat = keys[i % keys.length];
    if (bot.statPointsSpent[preferredStat] < limitCap) {
      bot.statPointsSpent[preferredStat]++;
    } else {
      // Find any other non-capped stat
      const remainingKeys = (Object.keys(bot.statPointsSpent) as StatName[]).filter(k => bot.statPointsSpent[k] < (k === 'healthRegen' || k === 'maxHealth' || k === 'bodyDamage' || k === 'movementSpeed' ? limitCap : 7));
      if (remainingKeys.length > 0) {
        bot.statPointsSpent[remainingKeys[0]]++;
      }
    }
  }

  // Recalculate stats values
  const isSm = bot.currentClass.id.includes('smasher');
  (Object.keys(bot.stats) as StatName[]).forEach(s => {
    bot.stats[s] = getStatValue(s, bot.statPointsSpent[s], isSm);
  });
  bot.maxHp = bot.stats.maxHealth;
  bot.hp = bot.maxHp;
}

function spawnShape(mapSize: number, walls: Wall[], avoidTanks: Tank[] = []): Shape {
  const roll = Math.random();
  const shinyRoll = Math.random() < 0.00035; // 1 in 3000 chance green shiny!
  
  let type: Shape['type'] = 'square';
  let radius = 12;
  let hp = 30;
  let damage = 12;
  let xp = 10;
  let color = COLORS.yellowShape;

  // Decide center vs outer map density
  const inCenter = Math.random() < 0.45; // high density pentagon nest at center
  const centerRadius = mapSize * 0.15;
  const nestCX = mapSize / 2;
  const nestCY = mapSize / 2;

  let spawnX = 0;
  let spawnY = 0;
  let keepSpawning = true;
  let attempts = 0;

  while (keepSpawning && attempts < 40) {
    attempts++;
    if (inCenter) {
      // Spawn near center Nest
      const angle = Math.random() * Math.PI * 2;
      const rDist = Math.random() * centerRadius;
      spawnX = nestCX + Math.cos(angle) * rDist;
      spawnY = nestCY + Math.sin(angle) * rDist;
    } else {
      // Randomly outer map
      spawnX = Math.random() * mapSize;
      spawnY = Math.random() * mapSize;
    }

    // Check collision with walls
    let intersects = false;
    for (const w of walls) {
      const coll = checkCircleRectCollision(spawnX, spawnY, radius * 2, w.x, w.y, w.width, w.height);
      if (coll.collides) {
        intersects = true;
        break;
      }
    }

    // Check proximity to tanks to avoid spawning shapes directly on players or bots
    if (!intersects && avoidTanks.length > 0) {
      for (const t of avoidTanks) {
        const minDist = t.id === 'player' ? 350 : 150;
        if (getDist(spawnX, spawnY, t.x, t.y) < minDist) {
          intersects = true;
          break;
        }
      }
    }

    if (!intersects) {
      keepSpawning = false;
    }
  }

  // Shape categories selection:
  if (inCenter) {
    // Highly pentagons
    if (roll < 0.1) {
      type = 'square';
      color = COLORS.yellowShape;
    } else if (roll < 0.25) {
      type = 'triangle';
      radius = 14;
      hp = 45;
      damage = 16;
      xp = 25;
      color = COLORS.pinkShape;
    } else if (roll < 0.96) {
      type = 'pentagon';
      radius = 20;
      hp = 250;
      damage = 25;
      xp = 130;
      color = COLORS.blueShape;
    } else {
      // Alpha Pentagon boss shape!
      type = 'alpha-pentagon';
      radius = 90;
      hp = 3000;
      damage = 80;
      xp = 3000;
      color = COLORS.blueShape;
    }
  } else {
    // Standard shapes
    if (roll < 0.6) {
      type = 'square';
    } else if (roll < 0.88) {
      type = 'triangle';
      radius = 14;
      hp = 45;
      damage = 16;
      xp = 25;
      color = COLORS.pinkShape;
    } else {
      type = 'pentagon';
      radius = 20;
      hp = 250;
      damage = 25;
      xp = 130;
      color = COLORS.blueShape;
    }
  }

  // Overwrite if shiny
  if (shinyRoll) {
    if (type === 'alpha-pentagon') {
      // Cap size is sufficient
    } else {
      type = type === 'square' ? 'shiny-square' : (type === 'triangle' ? 'shiny-triangle' : 'shiny-pentagon');
      hp *= 10;
      damage *= 3;
      xp *= 10;
      color = COLORS.shinyGreen;
    }
  }

  return {
    id: `shp_${generateId()}`,
    x: spawnX,
    y: spawnY,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    radius,
    color,
    hp,
    maxHp: hp,
    damage,
    type,
    xpValue: xp,
    spinSpeed: (Math.random() - 0.5) * 0.03,
    spinAngle: Math.random() * Math.PI,
    createdTime: Date.now(),
  };
}

// Custom shoot action
export function fireWeapon(tank: Tank, barrelIdx: number, barrel: BarrelConfig, timeNow: number, bullets: Bullet[], drones: Drone[], gameMode: GameMode) {
  const isSm = tank.currentClass.id.includes('smasher');
  const fireAngle = tank.angle + barrel.angle;
  const lengthScaled = barrel.length * 1.5; // Barrel visuals offset
  const recoilMult = barrel.recoil;
  
  // Pivot spawn point relative to body center
  const spawnX = tank.x + Math.cos(tank.angle + barrel.angle) * lengthScaled - Math.sin(tank.angle + barrel.angle) * barrel.offsetY;
  const spawnY = tank.y + Math.sin(tank.angle + barrel.angle) * lengthScaled + Math.cos(tank.angle + barrel.angle) * barrel.offsetY;

  // Track if we are firing drones vs traps vs normal shooters
  if (barrel.isCustomDrone) {
    // Limit total drones owned
    const maxDrones = tank.currentClass.dronesMax || 8;
    const myDrones = drones.filter(d => d.ownerId === tank.id);
    if (myDrones.length < maxDrones) {
      const droneType = tank.currentClass.dronesType || 'normal';
      
      const drone: Drone = {
        id: `drn_${generateId()}`,
        ownerId: tank.id,
        ownerTeam: tank.team,
        x: spawnX,
        y: spawnY,
        vx: Math.cos(fireAngle) * 3,
        vy: Math.sin(fireAngle) * 3,
        radius: droneType === 'necro' ? 11 : 9,
        color: tank.color,
        hp: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm) * 0.9,
        maxHp: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm) * 0.9,
        damage: getStatValue('bulletDamage', tank.statPointsSpent.bulletDamage, isSm) * 0.35,
        createdTime: Date.now(),
        droneType,
        targetAngle: fireAngle,
      };
      drones.push(drone);
    }
  } else if (barrel.isTrapper) {
    // Spawns traps!
    const size = 16 * (barrel.bulletSizeMultiplier || 1);
    const speed = getStatValue('bulletSpeed', tank.statPointsSpent.bulletSpeed, isSm) * 0.65;
    
    // Low velocity hexagon that slows down quickly
    const trap: Bullet = {
      id: `trp_${generateId()}`,
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(fireAngle) * speed,
      vy: Math.sin(fireAngle) * speed,
      radius: size,
      color: tank.color,
      hp: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm) * 1.6,
      maxHp: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm) * 1.6,
      damage: getStatValue('bulletDamage', tank.statPointsSpent.bulletDamage, isSm) * 0.75,
      createdTime: Date.now(),
      lifeTime: 12, // Long duration
      penetration: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm) * 1.6,
      maxPenetration: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm) * 1.6,
      recoilApplied: false,
      isTrap: true,
      size,
    };
    bullets.push(trap);
  } else {
    // Spawns normal bullet
    const bSpeed = getStatValue('bulletSpeed', tank.statPointsSpent.bulletSpeed, isSm) * (barrel.speedMultiplier || 1.0);
    const bDamage = getStatValue('bulletDamage', tank.statPointsSpent.bulletDamage, isSm);
    const bPenetration = getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration, isSm);
    const bSizeMultiplier = barrel.bulletSizeMultiplier || 1.0;
    const bSize = (10 + tank.level * 0.08) * bSizeMultiplier;

    // Trigger gun knock-back vector immediately
    const forceVec = recoilMult * (bSize / 10) * 0.6;
    tank.vx -= Math.cos(fireAngle) * forceVec;
    tank.vy -= Math.sin(fireAngle) * forceVec;

    const bullet: Bullet = {
      id: `blt_${generateId()}`,
      ownerId: tank.id,
      ownerTeam: tank.team,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(fireAngle) * bSpeed + tank.vx * 0.25,
      vy: Math.sin(fireAngle) * bSpeed + tank.vy * 0.25,
      radius: bSize,
      color: tank.color,
      hp: bPenetration,
      maxHp: bPenetration,
      damage: bDamage,
      createdTime: Date.now(),
      lifeTime: tank.currentClass.fovMultiplier > 1.2 ? 4.5 : 3.0, // Snipers shoot further before dissolving
      penetration: bPenetration,
      maxPenetration: bPenetration,
      recoilApplied: false,
      isTrap: false,
      size: bSize
    };
    bullets.push(bullet);
  }

  tank.lastShotTime[barrelIdx] = timeNow;
  tank.recoilProgress[barrelIdx] = 1.0; // fully compressed
  tank.lastMoveOrShootTime = timeNow;
}

// Change tank level or XP
export function awardXp(tank: Tank, amount: number, state: GameState) {
  if (tank.level >= 45) {
    tank.score += amount;
    return;
  }
  
  tank.xp += amount;
  tank.score += amount;

  // Evaluate Level Up trigger
  let currentNeeded = getXpForLevel(tank.level + 1);
  while (tank.level < 45 && tank.xp >= currentNeeded) {
    tank.level++;
    tank.radius = 20 + tank.level * 0.25;
    
    // Add skill point
    const oldSp = getStatPointsForLevel(tank.level - 1);
    const newSp = getStatPointsForLevel(tank.level);
    tank.availablePoints += (newSp - oldSp);

    // Announce if player leveled up
    if (!tank.isBot) {
      state.alerts.push({
        id: `lvl_${generateId()}`,
        text: `LEVELED UP to Level ${tank.level}!`,
        color: '#00B2E1',
        timestamp: Date.now()
      });
    }

    currentNeeded = getXpForLevel(tank.level + 1);
  }
}

// Spend player points manually
export function spendPoint(player: Tank, stat: StatName) {
  const cap = player.currentClass.id.includes('smasher') ? 10 : 7;
  if (player.availablePoints > 0 && player.statPointsSpent[stat] < cap) {
    player.statPointsSpent[stat]++;
    player.availablePoints--;

    const isSm = player.currentClass.id.includes('smasher');
    player.stats[stat] = getStatValue(stat, player.statPointsSpent[stat], isSm);

    if (stat === 'maxHealth') {
      const oldMax = player.maxHp;
      player.maxHp = player.stats.maxHealth;
      player.hp += (player.maxHp - oldMax); // heal by the added maximum health amount
    }
  }
}

// Trigger Class evolution
export function evolveClass(tank: Tank, targetClassId: string, state: GameState) {
  const target = CLASS_TREE.find(c => c.id === targetClassId);
  if (!target) return;

  const oldMaxHp = tank.maxHp;

  tank.currentClass = target;
  tank.lastShotTime = Array(target.barrels.length).fill(0);
  tank.recoilProgress = Array(target.barrels.length).fill(0);

  // Redraw size cap adjustments
  if (target.id.includes('smasher')) {
    // Cap normal stats to 7, smashers get 10 spent cap rules.
  }

  // Recalculate stats with the new class limits
  const isSm = tank.currentClass.id.includes('smasher');
  (Object.keys(tank.stats) as StatName[]).forEach(s => {
    // If we evolved to non-smasher but stats were somehow > 7, clamp them
    if (!isSm && tank.statPointsSpent[s] > 7) {
      const excess = tank.statPointsSpent[s] - 7;
      tank.statPointsSpent[s] = 7;
      tank.availablePoints += excess;
    }
    tank.stats[s] = getStatValue(s, tank.statPointsSpent[s], isSm);
  });

  // Keep maxHp and current hp cleanly synchronized and scaled
  tank.maxHp = tank.stats.maxHealth;
  if (tank.maxHp !== oldMaxHp) {
    const ratio = Math.max(0, Math.min(1, tank.hp / oldMaxHp));
    tank.hp = tank.maxHp * ratio;
  }

  if (!tank.isBot) {
    state.alerts.push({
      id: `evo_${generateId()}`,
      text: `Evolved into a ${target.name}!`,
      color: '#BF7FF5',
      timestamp: Date.now()
    });
  }
}

// Handle Bot AI actions
function processBotAI(bot: Tank, state: GameState, timeNow: number) {
  // Let bots auto evolve!
  if (bot.level >= 15 && bot.currentClass.id === 'tank') {
    const branches = CLASS_TREE.filter(c => c.level === 15 && c.parentClassId === 'tank');
    if (branches.length > 0) {
      const pick = branches[Math.floor(Math.random() * branches.length)];
      evolveClass(bot, pick.id, state);
    }
  } else if (bot.level >= 30 && bot.currentClass.level === 15) {
    const branches = CLASS_TREE.filter(c => c.level === 30 && c.parentClassId === bot.currentClass.id);
    if (branches.length > 0) {
      const pick = branches[Math.floor(Math.random() * branches.length)];
      evolveClass(bot, pick.id, state);
    }
  } else if (bot.level >= 45 && bot.currentClass.level === 30) {
    const branches = CLASS_TREE.filter(c => c.level === 45 && c.parentClassId === bot.currentClass.id);
    if (branches.length > 0) {
      const pick = branches[Math.floor(Math.random() * branches.length)];
      evolveClass(bot, pick.id, state);
    }
  }

  // Auto assign stats
  if (bot.availablePoints > 0) {
    allocateStatsAutomatically(bot);
  }

  // Evaluate AI states
  if (!bot.aiTargetTimer || bot.aiTargetTimer < timeNow) {
    const durationFactor = bot.botPersonality === 'CHAOTIC' ? 0.35 : 1.0;
    bot.aiTargetTimer = timeNow + (800 + Math.random() * 800) * durationFactor;
    
    // Find closest enemies vs shapes
    let nearestEnemy: Tank | null = null;
    let minEnemyD = Infinity;
    for (const t of state.tanks) {
      if (t.id === bot.id) continue;
      // Friendly check in TDM
      if (state.gameMode === 'TDM' && t.team === bot.team) continue;
      
      const d = getDist(bot.x, bot.y, t.x, t.y);
      if (d < minEnemyD && t.invisibility < 0.85) { // Can't select heavily hidden targets easily
        minEnemyD = d;
        nearestEnemy = t;
      }
    }

    // Domination target turret check
    let nearestDominator: Dominator | null = null;
    let minDomD = Infinity;
    if (state.gameMode === 'DOMINATION') {
      for (const dom of state.dominators) {
        if (dom.team === bot.team) continue;
        const d = getDist(bot.x, bot.y, dom.x, dom.y);
        if (d < minDomD) {
          minDomD = d;
          nearestDominator = dom;
        }
      }
    }

    // Shape search
    let nearestShape: Shape | null = null;
    let minShapeD = Infinity;
    for (const s of state.shapes) {
      const d = getDist(bot.x, bot.y, s.x, s.y);
      if (d < minShapeD) {
        minShapeD = d;
        nearestShape = s;
      }
    }

    // Decide state based on bot personality!
    const personality = bot.botPersonality || 'AGGRESSIVE';
    const hpRatio = bot.hp / bot.maxHp;

    // Retreat threshold varies based on personality (Cowards run early, Aggressive/Rammers/Campers rarely or never)
    let retreatThreshold = 0.4;
    if (personality === 'COWARD') retreatThreshold = 0.70;
    else if (personality === 'AGGRESSIVE' || personality === 'AVENGER') retreatThreshold = 0.15;
    else if (personality === 'RAMMER') retreatThreshold = 0.05;
    else if (personality === 'CAMPER') retreatThreshold = 0.0; // Campers hold ground and fight!

    if (hpRatio < retreatThreshold) {
      bot.aiState = 'RETREAT';
      bot.aiTargetId = nearestEnemy ? nearestEnemy.id : (nearestDominator ? nearestDominator.id : null);
    } else {
      if (personality === 'FARMER') {
        // Only fight if the enemy is very close, otherwise farm shapes
        if (nearestEnemy && minEnemyD < 250) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestShape && minShapeD < 1200) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else if (personality === 'COWARD') {
        // Flee from nearby players, otherwise harvest passively
        if (nearestEnemy && minEnemyD < 450) {
          bot.aiState = 'RETREAT';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestShape && minShapeD < 1200) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else if (personality === 'SNIPER') {
        // Seek enemies at long distances, otherwise farm shapes
        if (nearestEnemy && minEnemyD < 1100) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestShape && minShapeD < 1000) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else if (personality === 'CAMPER') {
        // Stay around the immediate location and shoot enemies up to 600px, shapes up to 500px
        if (nearestEnemy && minEnemyD < 600) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestShape && minShapeD < 500) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else if (personality === 'DEFENDER') {
        // Protect their current patrol post. Attack local entities, otherwise rest
        if (nearestEnemy && minEnemyD < 550) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestShape && minShapeD < 450) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else if (personality === 'AVENGER' && bot.lastDamageTakenTime && (timeNow - bot.lastDamageTakenTime < 8000)) {
        // Chase whoever hit them with focus up to 1300px
        if (nearestEnemy && minEnemyD < 1300) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestShape && minShapeD < 1000) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else if (personality === 'CHAOTIC') {
        // Highly erratic and randomized target selection
        const r = Math.random();
        if (r < 0.4 && nearestEnemy && minEnemyD < 850) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (r < 0.85 && nearestShape && minShapeD < 1100) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      } else {
        // Basic Aggressive/Rammer/Dodger general search behaviors
        if (nearestEnemy && minEnemyD < 950) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestEnemy.id;
        } else if (nearestDominator && minDomD < 1000) {
          bot.aiState = 'CHASE';
          bot.aiTargetId = nearestDominator.id;
        } else if (nearestShape && minShapeD < 1000) {
          bot.aiState = 'FARM';
          bot.aiTargetId = nearestShape.id;
        } else {
          bot.aiState = 'WANDER';
          bot.aiTargetId = null;
        }
      }
    }
  }

  // Direct bot moves based on State
  let moveAngle = bot.angle;
  let forceX = 0;
  let forceY = 0;
  let aimX = bot.x + Math.cos(bot.angle) * 300;
  let aimY = bot.y + Math.sin(bot.angle) * 300;
  let shouldShoot = false;

  const targetId = bot.aiTargetId;
  const personality = bot.botPersonality || 'AGGRESSIVE';

  if (bot.aiState === 'CHASE' && targetId) {
    // Aim at tank or dominator
    const isDom = targetId.startsWith('dom_');
    const target = isDom 
      ? state.dominators.find(d => d.id === targetId) 
      : state.tanks.find(t => t.id === targetId);

    if (target) {
      aimX = target.x;
      aimY = target.y;

      // Predictive Aim for sniper/snipers classes
      if (bot.currentClass.visualType === 'sniper') {
        const dist = getDist(bot.x, bot.y, target.x, target.y);
        const bulletSpeedVal = getStatValue('bulletSpeed', bot.statPointsSpent.bulletSpeed) * 1.5;
        const timeToHit = dist / bulletSpeedVal;
        
        // Target intercept point:
        aimX = target.x + target.vx * timeToHit;
        aimY = target.y + target.vy * timeToHit;
      }

      const dist = getDist(bot.x, bot.y, target.x, target.y);
      shouldShoot = true;

      // Handle maneuvering or backing up based on Class and Personalities:
      if (bot.currentClass.id.includes('smasher') || personality === 'RAMMER') {
        // Just ram headfirst
        forceX = Math.cos(Math.atan2(aimY - bot.y, aimX - bot.x));
        forceY = Math.sin(Math.atan2(aimY - bot.y, aimX - bot.x));
      } else if (bot.currentClass.visualType === 'sniper' || personality === 'SNIPER') {
        // Keep maximum comfortable distance (Assassin / Ranger back pedal!)
        const comfortDist = (personality === 'SNIPER') ? 740 : 640;
        if (dist < comfortDist) {
          // Move backward
          forceX = -Math.cos(Math.atan2(aimY - bot.y, aimX - bot.x));
          forceY = -Math.sin(Math.atan2(aimY - bot.y, aimX - bot.x));
        } else if (dist > comfortDist + 150) {
          // Move forward
          forceX = Math.cos(Math.atan2(aimY - bot.y, aimX - bot.x));
          forceY = Math.sin(Math.atan2(aimY - bot.y, aimX - bot.x));
        }
        
        // Dodging incoming projectiles
        const dodgingStrength = (personality === 'DODGER') ? 22 : 12;
        addDodgingForces(bot, state, ref => {
          forceX += ref.x * dodgingStrength;
          forceY += ref.y * dodgingStrength;
        });
      } else if (personality === 'AGGRESSIVE') {
        // Directly attack and push pressure towards their targets
        const combatAngle = Math.atan2(aimY - bot.y, aimX - bot.x) + (dist < 250 ? Math.PI / 4 : 0);
        forceX = Math.cos(combatAngle);
        forceY = Math.sin(combatAngle);

        addDodgingForces(bot, state, ref => {
          forceX += ref.x * 5;
          forceY += ref.y * 5;
        });
      } else {
        // Normal attacker - circle or maneuver around target
        const offsetAngle = Math.atan2(aimY - bot.y, aimX - bot.x) + (dist < 320 ? Math.PI / 2 : Math.PI / 4);
        forceX = Math.cos(offsetAngle);
        forceY = Math.sin(offsetAngle);

        const dodgingStrength = (personality === 'DODGER') ? 18 : 8;
        addDodgingForces(bot, state, ref => {
          forceX += ref.x * dodgingStrength;
          forceY += ref.y * dodgingStrength;
        });
      }

      // Campers prefer to remain stationary when sniping at long distance
      if (personality === 'CAMPER') {
        if (dist > 355) {
          forceX *= 0.12;
          forceY *= 0.12;
        }
      }

      // Chaotic added jitter
      if (personality === 'CHAOTIC') {
        forceX += (Math.random() - 0.5) * 0.7;
        forceY += (Math.random() - 0.5) * 0.7;
      }
    } else {
      bot.aiState = 'WANDER';
    }
  } else if (bot.aiState === 'FARM' && targetId) {
    const target = state.shapes.find(s => s.id === targetId);
    if (target) {
      aimX = target.x;
      aimY = target.y;
      shouldShoot = !bot.currentClass.id.includes('smasher');

      // SMASHERS & Rammers ram squares directly, other shooters stay back
      const isRamFarm = bot.currentClass.id.includes('smasher') || personality === 'RAMMER';
      const limitDist = isRamFarm ? 0 : 220;
      const d = getDist(bot.x, bot.y, target.x, target.y);
      if (d > limitDist) {
        forceX = Math.cos(Math.atan2(aimY - bot.y, aimX - bot.x));
        forceY = Math.sin(Math.atan2(aimY - bot.y, aimX - bot.x));
      }
    } else {
      bot.aiState = 'WANDER';
    }
  } else if (bot.aiState === 'RETREAT' && targetId) {
    const isDom = targetId.startsWith('dom_');
    const target = isDom 
      ? state.dominators.find(d => d.id === targetId) 
      : state.tanks.find(t => t.id === targetId);

    if (target) {
      aimX = target.x;
      aimY = target.y;
      
      // RUN the opposite direction!
      const runAngle = Math.atan2(bot.y - target.y, bot.x - target.x);
      forceX = Math.cos(runAngle);
      forceY = Math.sin(runAngle);

      // SHOOT behind us to use our weapon's massive recoil as rocket boosters!
      shouldShoot = true;
      aimX = bot.x - Math.cos(runAngle) * 300;
      aimY = bot.y - Math.sin(runAngle) * 300;
      
      // Dodging is vital during retreat
      addDodgingForces(bot, state, ref => {
        forceX += ref.x * 15;
        forceY += ref.y * 15;
      });
    } else {
      bot.aiState = 'WANDER';
    }
  } else {
    // WANDER mode
    if (Math.random() < 0.02) {
      bot.angle = Math.random() * Math.PI * 2;
    }
    forceX = Math.cos(bot.angle) * 0.45;
    forceY = Math.sin(bot.angle) * 0.45;
    shouldShoot = false;
  }

  // Clamp force
  const len = Math.hypot(forceX, forceY);
  if (len > 1.0) {
    forceX /= len;
    forceY /= len;
  }

  // Steer bot alignment
  bot.angle = Math.atan2(aimY - bot.y, aimX - bot.x);

  // Apply acceleration forces
  const baseMovementFactor = bot.stats.movementSpeed;
  bot.vx += forceX * baseMovementFactor * 0.12;
  bot.vy += forceY * baseMovementFactor * 0.12;

  // Perform firing
  if (shouldShoot && bot.currentClass.barrels.length > 0) {
    triggerTankFiring(bot, state, timeNow);
  }
}

// Algorythm "Мансы": Calculate avoidance vectors for nearest incoming heavy bullets
function addDodgingForces(bot: Tank, state: GameState, applyCallback: (vec: { x: number; y: number }) => void) {
  const detectRadius = 350;
  let dodgeVx = 0;
  let dodgeVy = 0;

  for (const b of state.bullets) {
    if (b.ownerId === bot.id) continue;
    if (state.gameMode === 'TDM' && b.ownerTeam === bot.team) continue;
    
    const d = getDist(bot.x, bot.y, b.x, b.y);
    if (d < detectRadius) {
      // Is this bullet moving toward me?
      const toTankX = bot.x - b.x;
      const toTankY = bot.y - b.y;
      const bulletSpeedSq = b.vx * b.vx + b.vy * b.vy;
      if (bulletSpeedSq > 0.1) {
        // Projection ratio
        const dot = (toTankX * b.vx + toTankY * b.vy) / bulletSpeedSq;
        if (dot > 0) { // Bullet is moving in our general direction
          // Target perpendicular vector
          const perpX = -b.vy;
          const perpY = b.vx;
          
          // Steer towards the side away from the bullet core
          const sideFactor = (toTankX * perpX + toTankY * perpY) >= 0 ? 1 : -1;
          
          dodgeVx += (perpX * sideFactor) / d;
          dodgeVy += (perpY * sideFactor) / d;
        }
      }
    }
  }

  const dLength = Math.hypot(dodgeVx, dodgeVy);
  if (dLength > 0.05) {
    applyCallback({ x: dodgeVx / dLength, y: dodgeVy / dLength });
  }
}

function triggerTankFiring(tank: Tank, state: GameState, timeNow: number) {
  const barrels = tank.currentClass.barrels;
  const isSm = tank.currentClass.id.includes('smasher');
  const baseReload = tank.stats.reload;

  barrels.forEach((b, index) => {
    // Double-check custom reload multiplier per barrel scale
    const finalReloadPeriod = baseReload * (b.reloadMultiplier || 1.0);
    const delayOffset = b.delay * finalReloadPeriod;
    const lastTime = tank.lastShotTime[index] || 0;

    if (timeNow - lastTime >= finalReloadPeriod) {
      // Respect delay timing cycle offset
      if (lastTime === 0 || timeNow - lastTime >= finalReloadPeriod + delayOffset) {
        fireWeapon(tank, index, b, timeNow, state.bullets, state.drones, state.gameMode);
      }
    }
  });
}

// Global update tick
export function tickGame(state: GameState, controls: ControlState, dt: number): GameState {
  if (!state.gameActive) return state;

  const timeNow = Date.now();
  const mapSize = state.mapSize;
  const friction = 0.91; // Linear damping

  // Maze walls reference
  const walls = state.walls;

  // 1. Player movement and aiming constraints
  let isMoving = false;
  let moveX = 0;
  let moveY = 0;
  if (controls.w) { moveY -= 1; isMoving = true; }
  if (controls.s) { moveY += 1; isMoving = true; }
  if (controls.a) { moveX -= 1; isMoving = true; }
  if (controls.d) { moveX += 1; isMoving = true; }

  if (isMoving) {
    // Normalise
    const len = Math.hypot(moveX, moveY);
    moveX /= len;
    moveY /= len;
    
    // Booster visual checks
    const targetBoosterFactor = state.player.stats.movementSpeed;
    state.player.vx += moveX * targetBoosterFactor * 0.16;
    state.player.vy += moveY * targetBoosterFactor * 0.16;
    state.player.lastMoveOrShootTime = timeNow;
  }

  // Rotate player aiming angle
  state.player.angle = Math.atan2(controls.mouseY - state.player.y, controls.mouseX - state.player.x);

  // Player trigger shooting
  if (controls.mouseLeft && state.player.currentClass.barrels.length > 0) {
    triggerTankFiring(state.player, state, timeNow);
    state.player.lastMoveOrShootTime = timeNow;
  }

  // 2. Active Tanks physics (Player + Bots)
  state.tanks.forEach(tank => {
    // Run AI if it's bot
    if (tank.isBot) {
      processBotAI(tank, state, timeNow);
    }

    // Apply linear damping/friction
    tank.vx *= friction;
    tank.vy *= friction;

    // Position integration
    tank.x += tank.vx;
    tank.y += tank.vy;

    // Scale animation recoil recovery
    for (let i = 0; i < tank.recoilProgress.length; i++) {
      if (tank.recoilProgress[i] > 0) {
        tank.recoilProgress[i] -= 0.08; // smooth cooling back out
        if (tank.recoilProgress[i] < 0) tank.recoilProgress[i] = 0;
      }
    }

    // Passive regeneration mechanics (Exponential if no damage in 20 seconds!)
    const regenSecsLimit = 15000; // 15s instead of 30 for arcade fun
    const lastHit = tank.lastDamageTakenTime || 0;
    if (timeNow - lastHit > regenSecsLimit) {
      const regenRateBase = tank.stats.healthRegen || 0.1;
      // Exponential rise ratio after limit is passed
      const ratio = 1 + (timeNow - lastHit - regenSecsLimit) * 0.00018; 
      tank.hp = Math.min(tank.maxHp, tank.hp + regenRateBase * ratio * dt);
    } else {
      // Standard slower linear recovery
      const regenRateBase = (tank.stats.healthRegen || 0.04) * 0.12;
      tank.hp = Math.min(tank.maxHp, tank.hp + regenRateBase * dt);
    }

    // Handle Stealth / Passive invisibility
    // Landmine, Stalker, Manager get stealth
    const isStealthClass = tank.currentClass.stealth || tank.currentClass.id === 'spike' || tank.currentClass.id === 'smasher';
    if (isStealthClass) {
      const msSilent = timeNow - tank.lastMoveOrShootTime;
      const decayTime = tank.currentClass.id === 'stalker' ? 1500 : 3000; // Stalker fades in 1.5s, others in 3s
      if (msSilent > decayTime && Math.hypot(tank.vx, tank.vy) < 0.25) {
        // Fade to fully invisible slowly
        tank.invisibility = Math.min(1.0, tank.invisibility + 0.02 * dt);
      } else {
        // Instantly reappear if moving/firing
        tank.invisibility = Math.max(0.0, tank.invisibility - 0.25 * dt);
      }
    } else {
      tank.invisibility = 0;
    }

    // Base boundary clamps
    if (tank.x < tank.radius) { tank.x = tank.radius; tank.vx *= -0.5; }
    if (tank.y < tank.radius) { tank.y = tank.radius; tank.vy *= -0.5; }
    if (tank.x > mapSize - tank.radius) { tank.x = mapSize - tank.radius; tank.vx *= -0.5; }
    if (tank.y > mapSize - tank.radius) { tank.y = mapSize - tank.radius; tank.vy *= -0.5; }

    // Maze walls collision resolutions (Push structures)
    for (const w of walls) {
      const col = checkCircleRectCollision(tank.x, tank.y, tank.radius, w.x, w.y, w.width, w.height);
      if (col.collides) {
        // Resolve push away
        const diffX = tank.x - col.closestX;
        const diffY = tank.y - col.closestY;
        const d = Math.hypot(diffX, diffY);
        if (d > 0.01) {
          const pushDistance = (tank.radius - d) + 1;
          tank.x += (diffX / d) * pushDistance;
          tank.y += (diffY / d) * pushDistance;
          // bounce slide
          tank.vx *= -0.3;
          tank.vy *= -0.3;
        } else {
          // Absolute fallback
          tank.y -= 2;
        }
      }
    }
  });

  // TDM friendly base safety triggers (Base Protect Drones)
  if (state.gameMode === 'TDM') {
    state.tanks.forEach(tank => {
      // If RED player enters BLUE base or BLUE player enters RED base, melt them
      const inBlueBase = tank.x < state.blueBaseZone.x2 && tank.y < state.blueBaseZone.y2;
      const inRedBase = tank.x > state.redBaseZone.x1 && tank.y > state.redBaseZone.y1;

      if (inBlueBase && tank.team === 'red') {
        tank.hp -= 8 * dt; // Instant major base protection lasers
        tank.lastDamageTakenTime = timeNow;
      }
      if (inRedBase && tank.team === 'blue') {
        tank.hp -= 8 * dt;
        tank.lastDamageTakenTime = timeNow;
      }
    });
  }

  // 3. Bullets updates (Standard + Traps)
  state.bullets = state.bullets.filter(bullet => {
    // Integrate moves
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    // Traps have higher friction, they slide then rest
    if (bullet.isTrap) {
      bullet.vx *= 0.86;
      bullet.vy *= 0.86;
    } else {
      // Natural bullet velocity drop
      bullet.vx *= 0.99;
      bullet.vy *= 0.99;
    }

    // Life-span decay
    const elapsed = (timeNow - bullet.createdTime) / 1000;
    
    // Bounds check
    const outBounds = bullet.x < 0 || bullet.y < 0 || bullet.x > mapSize || bullet.y > mapSize;

    // Walls checking in Maze
    if (state.gameMode === 'MAZE') {
      for (const w of walls) {
        const col = checkCircleRectCollision(bullet.x, bullet.y, bullet.radius, w.x, w.y, w.width, w.height);
        if (col.collides) {
          // Traps stick around, normal bullets dissolve
          if (bullet.isTrap) {
            // Repel slightly
            const dx = bullet.x - col.closestX;
            const dy = bullet.y - col.closestY;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              bullet.x += (dx / len);
              bullet.y += (dy / len);
              bullet.vx = 0;
              bullet.vy = 0;
            }
          } else {
            // Absorb penalty or vanish
            bullet.hp = 0;
          }
        }
      }
    }

    // Check hit against map dominators
    if (state.gameMode === 'DOMINATION') {
      for (const dom of state.dominators) {
        if (dom.team === bullet.ownerTeam) continue; // Ignore friendly fire
        const dDist = getDist(bullet.x, bullet.y, dom.x, dom.y);
        if (dDist < bullet.radius + dom.radius) {
          // Ticks exchange!
          const dmgToDom = bullet.damage * 0.15;
          const dmgToB = dom.damage * 0.15;
          
          dom.hp -= dmgToDom;
          bullet.hp -= dmgToB;

          // Domination capture trigger
          if (dom.hp <= 0) {
            dom.hp = dom.maxHp;
            dom.team = bullet.ownerTeam;
            state.alerts.push({
              id: `cap_${generateId()}`,
              text: `Dominator captured by team ${bullet.ownerTeam.toUpperCase()}!`,
              color: bullet.ownerTeam === 'blue' ? COLORS.player : COLORS.enemy,
              timestamp: Date.now()
            });

            // Gained team coordinates scores boosts
            const capturer = state.tanks.find(t => t.id === bullet.ownerId);
            if (capturer) {
              awardXp(capturer, 1000, state);
            }
          }
        }
      }
    }

    return elapsed < bullet.lifeTime && bullet.hp > 0 && !outBounds;
  });

  // 4. Drones logic and moves
  state.drones = state.drones.filter(drone => {
    const owner = state.tanks.find(t => t.id === drone.ownerId);
    if (!owner) return false; // owner died

    // Target tracking mechanics
    let targetX = owner.x;
    let targetY = owner.y;

    if (owner.id === 'player') {
      if (controls.mouseLeft) {
        // Chases direct cursor
        targetX = controls.mouseX;
        targetY = controls.mouseY;
      } else if (controls.mouseRight) {
        // Repelled outwards from cursor
        const dx = owner.x - controls.mouseX;
        const dy = owner.y - controls.mouseY;
        const dLen = Math.hypot(dx, dy) || 1.0;
        targetX = owner.x + (dx / dLen) * 500;
        targetY = owner.y + (dy / dLen) * 500;
      } else {
        // Orbit/idle hovering around owner
        const indexOffset = state.drones.filter(d => d.ownerId === owner.id).indexOf(drone);
        const orbitAngle = (timeNow * 0.0012) + (indexOffset * ((Math.PI * 2) / 8));
        targetX = owner.x + Math.cos(orbitAngle) * (70 + owner.level * 0.3);
        targetY = owner.y + Math.sin(orbitAngle) * (70 + owner.level * 0.3);
      }
    } else {
      // Bot drones logic
      const botTargetId = owner.aiTargetId;
      const targetEntity = botTargetId 
        ? (state.tanks.find(t => t.id === botTargetId) || state.shapes.find(s => s.id === botTargetId) || state.dominators.find(d => d.id === botTargetId))
        : null;

      if (targetEntity) {
        targetX = targetEntity.x;
        targetY = targetEntity.y;
      } else {
        // Hover
        const indexOffset = state.drones.filter(d => d.ownerId === owner.id).indexOf(drone);
        const orbitAngle = (timeNow * 0.001) + (indexOffset * ((Math.PI * 2) / 8));
        targetX = owner.x + Math.cos(orbitAngle) * (65 + owner.level * 0.25);
        targetY = owner.y + Math.sin(orbitAngle) * (65 + owner.level * 0.25);
      }
    }

    // Accelerate toward target coords
    const angleToTarget = Math.atan2(targetY - drone.y, targetX - drone.x);
    drone.targetAngle = angleToTarget;

    const drag = 0.94;
    const droneAcceleration = 0.38;
    
    drone.vx = drone.vx * drag + Math.cos(angleToTarget) * droneAcceleration;
    drone.vy = drone.vy * drag + Math.sin(angleToTarget) * droneAcceleration;

    drone.x += drone.vx;
    drone.y += drone.vy;

    // Walls check in Maze
    if (state.gameMode === 'MAZE') {
      for (const w of walls) {
        const col = checkCircleRectCollision(drone.x, drone.y, drone.radius, w.x, w.y, w.width, w.height);
        if (col.collides) {
          const dx = drone.x - col.closestX;
          const dy = drone.y - col.closestY;
          const len = Math.hypot(dx, dy) || 1;
          drone.x += (dx / len) * 3;
          drone.y += (dy / len) * 3;
          // Soften speed
          drone.vx *= -0.4;
          drone.vy *= -0.4;
        }
      }
    }

    return drone.hp > 0;
  });

  // Necromancer yellow squares capture override:
  state.tanks.forEach(tank => {
    if (tank.currentClass.id === 'necromancer') {
      const myDrones = state.drones.filter(d => d.ownerId === tank.id);
      const capLimit = tank.currentClass.dronesMax || 34;
      
      if (myDrones.length < capLimit) {
        state.shapes.forEach(shape => {
          if (shape.type === 'square' && shape.hp > 0) {
            const dist = getDist(tank.x, tank.y, shape.x, shape.y);
            if (dist < tank.radius + shape.radius) {
              // Capture square! Convert it to a necro drone
              shape.hp = -1; // Despawn standard shape
              
              const necroDrone: Drone = {
                id: `drn_necro_${generateId()}`,
                ownerId: tank.id,
                ownerTeam: tank.team,
                x: shape.x,
                y: shape.y,
                vx: 0,
                vy: 0,
                radius: 11,
                color: tank.color,
                hp: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration) * 1.3,
                maxHp: getStatValue('bulletPenetration', tank.statPointsSpent.bulletPenetration) * 1.3,
                damage: getStatValue('bulletDamage', tank.statPointsSpent.bulletDamage) * 0.6,
                createdTime: Date.now(),
                droneType: 'necro',
                targetAngle: 0,
              };
              
              state.drones.push(necroDrone);
              awardXp(tank, 4, state); // Gained tiny XP
            }
          }
        });
      }
    }
  });

  // 5. Shapes spawning & update
  state.shapes.forEach(sh => {
    sh.x += sh.vx;
    sh.y += sh.vy;
    sh.spinAngle += sh.spinSpeed;

    // Outer walls check
    if (sh.x < sh.radius) { sh.x = sh.radius; sh.vx *= -1; }
    if (sh.y < sh.radius) { sh.y = sh.radius; sh.vy *= -1; }
    if (sh.x > mapSize - sh.radius) { sh.x = mapSize - sh.radius; sh.vx *= -1; }
    if (sh.y > mapSize - sh.radius) { sh.y = mapSize - sh.radius; sh.vy *= -1; }

    // Crashers: seek nearest tank in center area
    if (sh.type === 'crasher') {
      let closestT: Tank | null = null;
      let minD = 550; // Sight limit
      
      state.tanks.forEach(t => {
        const d = getDist(sh.x, sh.y, t.x, t.y);
        // Can crashers chase invisible tanks? No, soft sight detection cut:
        if (d < minD && t.invisibility < 0.6) {
          minD = d;
          closestT = t;
        }
      });

      if (closestT) {
        const angle = Math.atan2((closestT as Tank).y - sh.y, (closestT as Tank).x - sh.x);
        sh.vx = sh.vx * 0.88 + Math.cos(angle) * 0.95;
        sh.vy = sh.vy * 0.88 + Math.sin(angle) * 0.95;
      } else {
        // drift back to Nest
        const centerDistX = (mapSize / 2) - sh.x;
        const centerDistY = (mapSize / 2) - sh.y;
        const targetAng = Math.atan2(centerDistY, centerDistX);
        sh.vx = sh.vx * 0.95 + Math.cos(targetAng) * 0.15;
        sh.vy = sh.vy * 0.95 + Math.sin(targetAng) * 0.15;
      }
    }
  });

  // Spawn periodic center Crashers at the Nest if countdown allows
  // Keep Crashers cap at ~25
  const crasherCount = state.shapes.filter(s => s.type === 'crasher').length;
  if (crasherCount < 25 && Math.random() < 0.05) {
    // Spawn a Crasher inside the Center Nest
    const nestCX = mapSize / 2;
    const nestCY = mapSize / 2;
    const nestRadius = mapSize * 0.08;
    const ang = Math.random() * Math.PI * 2;
    const spawnR = Math.random() * nestRadius;

    state.shapes.push({
      id: `crs_${generateId()}`,
      x: nestCX + Math.cos(ang) * spawnR,
      y: nestCY + Math.sin(ang) * spawnR,
      vx: 0,
      vy: 0,
      radius: 9,
      color: COLORS.pinkShape,
      hp: 40,
      maxHp: 40,
      damage: 10,
      createdTime: Date.now(),
      type: 'crasher',
      xpValue: 18,
      spinAngle: Math.random() * Math.PI,
      spinSpeed: 0.1,
    });
  }

  // 6. COLLISION RESOLUTIONS & TICK-DAMAGE (Bullet Penetration)
  // We compute overlap. If overlapping, exchange tick-based damages!
  
  // A. BULLET vs SHAPE
  state.bullets.forEach(bullet => {
    state.shapes.forEach(shape => {
      if (bullet.hp <= 0 || shape.hp <= 0) return;
      const d = getDist(bullet.x, bullet.y, shape.x, shape.y);
      if (d < bullet.radius + shape.radius) {
        // Real classic Diep.io penetration trade:
        // We deplete their hp each frame based on their mutual damage values!
        const bDmg = bullet.damage;
        const sDmg = shape.damage;

        shape.hp -= bDmg;
        bullet.hp -= sDmg; // depletion is proportional to shape's body damage

        if (shape.hp <= 0) {
          // Gained XP to bullet owner!
          const owner = state.tanks.find(t => t.id === bullet.ownerId);
          if (owner) {
            awardXp(owner, shape.xpValue, state);
          }
        }
      }
    });

    // B. BULLET vs BULLET (Enemies only)
    state.bullets.forEach(otherB => {
      if (bullet.id === otherB.id || bullet.hp <= 0 || otherB.hp <= 0) return;
      if (bullet.ownerTeam !== 'neutral' && bullet.ownerTeam === otherB.ownerTeam) return;
      if (bullet.ownerId === otherB.ownerId) return;

      const d = getDist(bullet.x, bullet.y, otherB.x, otherB.y);
      if (d < bullet.radius + otherB.radius) {
        const b1Dmg = bullet.damage;
        const b2Dmg = otherB.damage;
        
        bullet.hp -= b2Dmg * 0.55; // relative tick weight
        otherB.hp -= b1Dmg * 0.55;
      }
    });
  });

  // C. DRONE vs SHAPE
  state.drones.forEach(drone => {
    state.shapes.forEach(shape => {
      if (drone.hp <= 0 || shape.hp <= 0) return;
      const d = getDist(drone.x, drone.y, shape.x, shape.y);
      if (d < drone.radius + shape.radius) {
        shape.hp -= drone.damage;
        drone.hp -= shape.damage * 0.35; // drones take slightly lower contact damage from shapes

        if (shape.hp <= 0) {
          const owner = state.tanks.find(t => t.id === drone.ownerId);
          if (owner) {
            awardXp(owner, shape.xpValue, state);
          }
        }
      }
    });
  });

  // D. TANK RAMMING SHAPE (Body Damage interactions!)
  state.tanks.forEach(tank => {
    state.shapes.forEach(shape => {
      if (shape.hp <= 0 || tank.hp <= 0) return;
      const d = getDist(tank.x, tank.y, shape.x, shape.y);
      if (d < tank.radius + shape.radius) {
        // Resolve physically: push apart
        const angle = Math.atan2(tank.y - shape.y, tank.x - shape.x);
        const overlap = (tank.radius + shape.radius) - d;
        tank.x += Math.cos(angle) * overlap * 0.4;
        tank.y += Math.sin(angle) * overlap * 0.4;
        tank.vx += Math.cos(angle) * overlap * 0.1;
        tank.vy += Math.sin(angle) * overlap * 0.1;

        // Apply trade damage:
        // Body damage acts as shield: by killing the shape faster, you take fewer frames of damage!
        const bodyDmg = tank.stats.bodyDamage || 15;
        const shDmg = shape.damage;

        shape.hp -= bodyDmg;
        tank.hp -= shDmg * 0.5; // lower ram scale
        tank.lastDamageTakenTime = timeNow;

        if (shape.hp <= 0) {
          awardXp(tank, shape.xpValue, state);
        }
      }
    });
  });

  // E. TANK vs DRONE (Attacking drones)
  state.drones.forEach(drone => {
    state.tanks.forEach(tank => {
      if (drone.hp <= 0 || tank.hp <= 0) return;
      if (drone.ownerId === tank.id) return; // friendly
      if (state.gameMode === 'TDM' && drone.ownerTeam === tank.team) return;

      const d = getDist(drone.x, drone.y, tank.x, tank.y);
      if (d < drone.radius + tank.radius) {
        const bodyDmg = tank.stats.bodyDamage || 15;
        const droneDmg = drone.damage;

        tank.hp -= droneDmg;
        drone.hp -= bodyDmg * 0.3;
        tank.lastDamageTakenTime = timeNow;

        if (tank.hp <= 0) {
          // Drone owner gets the kill!
          const killer = state.tanks.find(t => t.id === drone.ownerId);
          handleKill(killer, tank, state);
        }
      }
    });
  });

  // F. TANK vs BULLET
  state.bullets.forEach(bullet => {
    state.tanks.forEach(tank => {
      if (bullet.hp <= 0 || tank.hp <= 0) return;
      if (bullet.ownerId === tank.id) return; // friendly
      if (state.gameMode === 'TDM' && bullet.ownerTeam === tank.team) return;

      const d = getDist(bullet.x, bullet.y, tank.x, tank.y);
      if (d < bullet.radius + tank.radius) {
        const bDmg = bullet.damage;
        const tBodyDmg = tank.stats.bodyDamage || 15;

        tank.hp -= bDmg;
        bullet.hp -= tBodyDmg * 0.35; // bullets wear out against dense body defenses!
        tank.lastDamageTakenTime = timeNow;

        if (tank.hp <= 0) {
          const killer = state.tanks.find(t => t.id === bullet.ownerId);
          handleKill(killer, tank, state);
        }
      }
    });
  });

  // G. TANK vs TANK (Ramming other tanks!)
  state.tanks.forEach(tankA => {
    state.tanks.forEach(tankB => {
      if (tankA.id === tankB.id || tankA.hp <= 0 || tankB.hp <= 0) return;
      if (state.gameMode === 'TDM' && tankA.team === tankB.team) return;

      const d = getDist(tankA.x, tankA.y, tankB.x, tankB.y);
      if (d < tankA.radius + tankB.radius) {
        // Push apart
        const angle = Math.atan2(tankA.y - tankB.y, tankA.x - tankB.x);
        const overlap = (tankA.radius + tankB.radius) - d;
        
        tankA.x += Math.cos(angle) * overlap * 0.5;
        tankA.y += Math.sin(angle) * overlap * 0.5;
        tankB.x -= Math.cos(angle) * overlap * 0.5;
        tankB.y -= Math.sin(angle) * overlap * 0.5;

        // trade damages
        const dmgA = tankA.stats.bodyDamage || 15;
        const dmgB = tankB.stats.bodyDamage || 15;

        tankB.hp -= dmgA * 0.25;
        tankA.hp -= dmgB * 0.25;

        tankA.lastDamageTakenTime = timeNow;
        tankB.lastDamageTakenTime = timeNow;

        if (tankA.hp <= 0) {
          handleKill(tankB, tankA, state);
        }
        if (tankB.hp <= 0) {
          handleKill(tankA, tankB, state);
        }
      }
    });
  });

  // Filter dead shapes & replace
  const shapeCountBefore = state.shapes.length;
  state.shapes = state.shapes.filter(s => s.hp > 0);
  
  // Respawn shapes to keep map rich!
  const maxShapes = state.gameMode === 'MAZE' ? 120 : (state.gameMode === 'DOMINATION' ? 150 : 250);
  const shapesDiff = maxShapes - state.shapes.length;
  if (shapesDiff > 0) {
    for (let i = 0; i < Math.min(shapesDiff, 4); i++) {
       state.shapes.push(spawnShape(mapSize, walls, state.tanks));
    }
  }

  // 7. Check Player death & respawn bots
  const playerAlive = state.player.hp > 0;
  
  // Keep statistics fresh for UI rendering
  state.gameTimeElapsed = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  state.totalKills = state.player.kills || 0;
  state.peakScore = Math.max(state.peakScore || 0, state.player.score || 0);

  if (!playerAlive && state.gameActive) {
    // End active game run or set flag to let player trigger respawn
    state.gameActive = false;
    state.victoryStatus = 'defeat';
    state.defeatReason = state.defeatReason || 'You succumbed to the hazards of the arena!';
    state.alerts.push({
      id: `ded_${generateId()}`,
      text: 'GAME OVER! Press Space or click Respawn.',
      color: '#F14E54',
      timestamp: Date.now()
    });
  }

  // Evaluate victory conditions for active battles
  if (state.gameActive && !state.victoryStatus) {
    if (state.gameMode === 'DOMINATION') {
      const blueDoms = state.dominators.filter(d => d.team === 'blue').length;
      const redDoms = state.dominators.filter(d => d.team === 'red').length;
      if (blueDoms === 4) {
        state.victoryStatus = 'victory';
        state.gameActive = false;
        state.defeatReason = 'Absolute Domination! Your team has successfully captured all four Dominators!';
      } else if (redDoms === 4) {
        state.victoryStatus = 'defeat';
        state.gameActive = false;
        state.defeatReason = 'Mission Failed. All four Dominators were taken by the enemy team.';
      }
    } else if (state.gameMode === 'TDM') {
      // TDM: First team to reach 50 combined score kills
      const blueTeamKills = state.tanks.filter(t => t.team === 'blue').reduce((sum, t) => sum + (t.kills || 0), 0) + (state.player.kills || 0);
      const redTeamKills = state.tanks.filter(t => t.team === 'red').reduce((sum, t) => sum + (t.kills || 0), 0);
      
      if (blueTeamKills >= 50) {
        state.victoryStatus = 'victory';
        state.gameActive = false;
        state.defeatReason = `Victory! Blue team hit the target score with ${blueTeamKills} total kills!`;
      } else if (redTeamKills >= 50) {
        state.victoryStatus = 'defeat';
        state.gameActive = false;
        state.defeatReason = `Defeat! Red team seized victory with ${redTeamKills} total kills first.`;
      }
    } else {
      // FFA or MAZE mode: Player reaches Rank 1 and gets 25,000 score
      const isLeader = state.scoreLeaderboard[0]?.isPlayer;
      const playerScore = state.player.score || 0;
      if (isLeader && playerScore >= 25000) {
        state.victoryStatus = 'victory';
        state.gameActive = false;
        state.defeatReason = 'Untouchable! You conquered the arena and reached #1 rank with 25k+ score!';
      }
    }
  }

  // Replenish bots to keep count up to limit
  const bLimit = state.botCountSetting !== undefined ? state.botCountSetting : (state.gameMode === 'MAZE' ? 18 : (state.gameMode === 'DOMINATION' ? 15 : 25));
  const activeBots = state.tanks.filter(t => t.isBot && t.hp > 0);
  if (activeBots.length < bLimit) {
    const isBlue = state.gameMode === 'TDM' ? (Math.random() < 0.5) : false;
    const botTeam = state.gameMode === 'TDM' ? (isBlue ? 'blue' : 'red') : 'neutral';
    
    let rx = Math.random() * mapSize;
    let ry = Math.random() * mapSize;

    if (state.gameMode === 'TDM') {
      if (isBlue) {
        rx = Math.random() * 300;
        ry = Math.random() * 300;
      } else {
        rx = mapSize - Math.random() * 300;
        ry = mapSize - Math.random() * 300;
      }
    } else {
      while (getDist(rx, ry, state.player.x, state.player.y) < 700) {
        rx = Math.random() * mapSize;
        ry = Math.random() * mapSize;
      }
    }

    const botLevel = 1; // Replenish at level 1 for complete fairness!
    const botClass = CLASS_TREE[0]; // Standard tank
    const BOT_PERSONALITY_TYPES: ('AGGRESSIVE' | 'COWARD' | 'FARMER' | 'CAMPER' | 'DODGER' | 'RAMMER' | 'SNIPER' | 'CHAOTIC' | 'DEFENDER' | 'AVENGER')[] = [
      'AGGRESSIVE', 'COWARD', 'FARMER', 'CAMPER', 'DODGER', 'RAMMER', 'SNIPER', 'CHAOTIC', 'DEFENDER', 'AVENGER'
    ];
    
    const newBot: Tank = {
      id: `bot_${generateId()}`,
      name: `Bot ${Math.floor(Math.random() * 900) + 100}`,
      x: rx,
      y: ry,
      vx: 0,
      vy: 0,
      radius: 20,
      color: botTeam === 'blue' ? COLORS.player : COLORS.enemy,
      hp: 100,
      maxHp: 100,
      damage: 15,
      createdTime: Date.now(),
      isBot: true,
      team: botTeam,
      level: botLevel,
      xp: 0,
      score: 0,
      kills: 0,
      currentClass: botClass,
      stats: {
        healthRegen: 0, maxHealth: 0, bodyDamage: 0, bulletSpeed: 0,
        bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0
      },
      statPointsSpent: {
        healthRegen: 0, maxHealth: 0, bodyDamage: 0, bulletSpeed: 0,
        bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0
      },
      availablePoints: 0,
      angle: Math.random() * Math.PI * 2,
      lastShotTime: Array(botClass.barrels.length).fill(0),
      recoilProgress: Array(botClass.barrels.length).fill(0),
      skillPointsMax: botClass.id.includes('smasher') ? 10 : 7,
      invisibility: 0,
      lastMoveOrShootTime: Date.now(),
      botPersonality: BOT_PERSONALITY_TYPES[Math.floor(Math.random() * BOT_PERSONALITY_TYPES.length)],
      aiState: 'FARM',
      aiTargetId: null,
      aiTargetTimer: 0,
    };
    allocateStatsAutomatically(newBot);
    state.tanks.push(newBot);
  }

  // Clear deceased tanks
  state.tanks = state.tanks.filter(t => t.hp > 0);

  // 8. Capture Leaderboard scoring
  const allTanksAndScore = [...state.tanks];
  if (!playerAlive && !state.tanks.some(t => t.id === 'player')) {
    allTanksAndScore.push(state.player); // Include dead player score
  }

  const sorted = allTanksAndScore
    .map(t => ({
      id: t.id,
      name: t.name,
      score: Math.round(t.score),
      color: t.id === 'player' ? COLORS.player : (t.team === 'blue' ? COLORS.player : COLORS.enemy),
      isPlayer: t.id === 'player',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  state.scoreLeaderboard = sorted;

  // Camera damping tracker
  state.camX = state.camX * 0.88 + state.player.x * 0.12;
  state.camY = state.camY * 0.88 + state.player.y * 0.12;
  
  // Custom camera zoom based on class fovMultiplier
  const baseZoom = 1.0;
  const classZoomFactor = 1.0 / (state.player.currentClass.fovMultiplier || 1.0);
  // smooth adjust camera zoom size
  state.camZoom = state.camZoom * 0.95 + (baseZoom * classZoomFactor) * 0.05;

  // Clear stale alerts
  state.alerts = state.alerts.filter(a => timeNow - a.timestamp < 6000);

  state.lastUpdate = timeNow;
  return state;
}

function handleKill(killer: Tank | undefined, victim: Tank, state: GameState) {
  if (victim.id === 'player') {
    state.victoryStatus = 'defeat';
    state.defeatReason = killer 
      ? `Destroyed by ${killer.name} using a Level ${killer.level} ${killer.currentClass.name}!`
      : `Destroyed by collision with a stray projectile or shape!`;
  }

  if (!killer) return;

  // Track kills for statistics
  killer.kills = (killer.kills || 0) + 1;
  if (killer.id === 'player') {
    state.totalKills = (state.totalKills || 0) + 1;
  }

  // Bullets/drones etc award XP to owner
  const bonusXp = Math.round(victim.score * 0.35 + 200); // 35% of victims score!
  awardXp(killer, bonusXp, state);

  // Announce the kill
  state.alerts.push({
    id: `kill_${generateId()}`,
    text: `${killer.name} DESTROYED ${victim.name}! (+${bonusXp} XP)`,
    color: killer.id === 'player' ? '#00E16F' : '#F14E54',
    timestamp: Date.now()
  });
}
