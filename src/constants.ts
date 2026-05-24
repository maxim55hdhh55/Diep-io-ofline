import { GameMode, UpgradeClass } from './types';

export const COLORS = {
  backgroundGrid: '#CDCDCD',
  linesGrid: '#C3C3C3',
  player: '#00B2E1',
  enemy: '#F14E54', // red
  greenTeam: '#00E16F',
  purpleTeam: '#BF7FF5',
  yellowShape: '#FFE869', // Quad
  pinkShape: '#FC7677',   // Triangle / Crasher
  blueShape: '#768CFC',   // Pentagon
  shinyGreen: '#2BE26B',   // Shiny
  neutralGrey: '#999999',  // Barrels, neutral Dominators
  borderDark: '#555555',
  textBackground: 'rgba(0, 0, 0, 0.45)',
  darkBg: '#1e1e1e',
};

export const LEVEL_EXP_TABLE = [
  0, 4, 13, 28, 49, 78, 115, 161, 218, 286, // 1-10
  367, 461, 570, 694, 835, 995, 1174, 1374, 1596, 1841, // 11-20
  2111, 2407, 2730, 3082, 3464, 3878, 4325, 4807, 5326, 5883, // 21-30
  6481, 7121, 7805, 8535, 9313, 10141, 11021, 11955, 12945, 13993, // 31-40
  15101, 16271, 17505, 18805, 20173, 21611 // 41-45
];

export const MAP_SIZES: Record<GameMode, number> = {
  FFA: 4000,
  TDM: 4200,
  MAZE: 3000,
  DOMINATION: 3500,
};

// Return the maximum experience for a given level
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= 45) return LEVEL_EXP_TABLE[44];
  return LEVEL_EXP_TABLE[level - 1] || (level * level * 10);
}

export function getStatPointsForLevel(level: number): number {
  // Diep.io gives 1 point per level except certain gaps, totaling 33 points at Level 45.
  // We can simplify: 1 point per level up to level 28, then every 2 or 3 levels, till max 33 points.
  const pointLevels = [
    2,3,4,5,6,7,8,9,10,
    11,12,13,14,15,16,17,18,19,20,
    21,22,23,24,25,26,27,28,
    30,32,34,36,38,40,42,44
  ];
  return pointLevels.filter(lvl => lvl <= level).length;
}

// Stats Multipliers structure
export const STATS_BASE = {
  healthRegen: 0.2, // HP regen rate per sec
  maxHealth: 100,
  bodyDamage: 15,
  bulletSpeed: 5.5,
  bulletPenetration: 35, // bullet max health
  bulletDamage: 12,     // damage per tick (approx 60 Hz scale)
  reload: 800,          // base shot cooldown in milliseconds
  movementSpeed: 2.8,
};

// Stat increments (multipliers per stat point)
export function getStatValue(stat: keyof typeof STATS_BASE, points: number, isSmasher: boolean = false): number {
  const cap = isSmasher && ['maxHealth', 'bodyDamage', 'movementSpeed', 'healthRegen'].includes(stat) ? 10 : 7;
  const p = Math.min(points, cap);
  
  switch (stat) {
    case 'healthRegen':
      // Regen increases by +50% per point
      return STATS_BASE.healthRegen * (1 + p * 0.82);
    case 'maxHealth':
      // Max health: standard stats increase linearly +20 HP per point
      return STATS_BASE.maxHealth + p * 40;
    case 'bodyDamage':
      // Body damage: adds on top of baseline
      return STATS_BASE.bodyDamage + p * 15;
    case 'bulletSpeed':
      // Linear initial speed speed
      return STATS_BASE.bulletSpeed * (1 + p * 0.25);
    case 'bulletPenetration':
      // Bullet density/health
      return STATS_BASE.bulletPenetration * (1 + p * 0.4);
    case 'bulletDamage':
      // Bullet damage per contact frame
      return STATS_BASE.bulletDamage * (1 + p * 0.4);
    case 'reload':
      // Reload is cooldown, so we want reload to REDUCE cooldown. e.g. delay = BASE_DELAY / (1 + p * 0.28)
      return STATS_BASE.reload / (1 + p * 0.22);
    case 'movementSpeed':
      // Movement speed force
      return STATS_BASE.movementSpeed * (1 + p * 0.15);
    default:
      return STATS_BASE[stat];
  }
}

// Exhaustive Classes Tree definitions:
export const CLASS_TREE: UpgradeClass[] = [
  {
    id: 'tank',
    name: 'Tank',
    level: 1,
    description: 'The standard all-rounder tank starting class.',
    visualType: 'normal',
    barrels: [
      { angle: 0, width: 14, length: 22, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 }
    ],
    fovMultiplier: 1.0,
  },
  
  // LEVEL 15 UPGRADES:
  {
    id: 'twin',
    name: 'Twin',
    level: 15,
    parentClassId: 'tank',
    description: 'Double the barrels, double the threat. Alternating projectile lines.',
    visualType: 'normal',
    barrels: [
      { angle: 0, width: 11, length: 21, offsetY: -6, offsetX: 0, delay: 0, recoil: 1.0, damageMultiplier: 0.75, penetrationMultiplier: 0.9 } as any,
      { angle: 0, width: 11, length: 21, offsetY: 6, offsetX: 0, delay: 0.5, recoil: 1.0, damageMultiplier: 0.75, penetrationMultiplier: 0.9 } as any
    ],
    fovMultiplier: 1.0,
  },
  {
    id: 'sniper',
    name: 'Sniper',
    level: 15,
    parentClassId: 'tank',
    description: 'Longer range, high speed bullets, expanded view, but slower firing.',
    visualType: 'sniper',
    barrels: [
      { angle: 0, width: 14, length: 30, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.8, bulletSizeMultiplier: 0.9, speedMultiplier: 1.7, reloadMultiplier: 1.8 }
    ],
    fovMultiplier: 1.35,
  },
  {
    id: 'machine_gun',
    name: 'Machine Gun',
    level: 15,
    parentClassId: 'tank',
    description: 'High rate of fire but wide bullet spread.',
    visualType: 'spammer',
    barrels: [
      // Wide barrel, reduced bullet size, high reload rate
      { angle: 0, width: 19, length: 21, offsetY: 0, offsetX: 0, delay: 0, recoil: 0.8, reloadMultiplier: 0.5, speedMultiplier: 0.9, bulletSizeMultiplier: 0.8 }
    ],
    fovMultiplier: 1.0,
  },
  {
    id: 'flank_guard',
    name: 'Flank Guard',
    level: 15,
    parentClassId: 'tank',
    description: 'Shoots both forwards and backwards to protect your flank.',
    visualType: 'normal',
    barrels: [
      { angle: 0, width: 14, length: 22, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 },
      { angle: Math.PI, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0.5, recoil: 0.8 }
    ],
    fovMultiplier: 1.0,
  },

  // LEVEL 30 UPGRADES:
  {
    id: 'triple_shot',
    name: 'Triple Shot',
    level: 30,
    parentClassId: 'twin',
    description: 'Fires from 3 wide-oriented angles.',
    visualType: 'spammer',
    barrels: [
      { angle: -0.35, width: 13, length: 20, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 },
      { angle: 0, width: 13, length: 22, offsetY: 0, offsetX: 0, delay: 0.5, recoil: 1.0 },
      { angle: 0.35, width: 13, length: 20, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 }
    ],
    fovMultiplier: 1.05,
  },
  {
    id: 'quad_tank',
    name: 'Quad Tank',
    level: 30,
    parentClassId: 'flank_guard',
    description: 'Shoots in four cardinal directions.',
    visualType: 'spammer',
    barrels: [
      { angle: 0, width: 13, length: 20, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 },
      { angle: Math.PI/2, width: 13, length: 20, offsetY: 0, offsetX: 0, delay: 0.25, recoil: 1.0 },
      { angle: Math.PI, width: 13, length: 20, offsetY: 0, offsetX: 0, delay: 0.5, recoil: 1.0 },
      { angle: -Math.PI/2, width: 13, length: 20, offsetY: 0, offsetX: 0, delay: 0.75, recoil: 1.0 }
    ],
    fovMultiplier: 1.05,
  },
  {
    id: 'assassin',
    name: 'Assassin',
    level: 30,
    parentClassId: 'sniper',
    description: 'Upgrades extreme focus sniper fire and zooming view.',
    visualType: 'sniper',
    barrels: [
      { angle: 0, width: 14, length: 36, offsetY: 0, offsetX: 0, delay: 0, recoil: 2.2, bulletSizeMultiplier: 0.95, speedMultiplier: 2.1, reloadMultiplier: 2.4 }
    ],
    fovMultiplier: 1.6,
  },
  {
    id: 'overseer',
    name: 'Overseer',
    level: 30,
    parentClassId: 'sniper',
    description: 'Controls up to 8 powerful guided triangle drones.',
    visualType: 'drone',
    barrels: [
      { angle: Math.PI/2, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0, recoil: 0, isCustomDrone: true },
      { angle: -Math.PI/2, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0.5, recoil: 0, isCustomDrone: true }
    ],
    fovMultiplier: 1.15,
    dronesMax: 8,
    dronesType: 'normal',
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    level: 30,
    parentClassId: 'machine_gun',
    description: 'Fires massive, highly destructive spheres with incredible recoil.',
    visualType: 'destroyer',
    barrels: [
      { angle: 0, width: 28, length: 22, offsetY: 0, offsetX: 0, delay: 0, recoil: 14.0, bulletSizeMultiplier: 2.4, reloadMultiplier: 3.8, speedMultiplier: 0.7, damageMultiplier: 3.0, penetrationMultiplier: 3.0 } as any
    ],
    fovMultiplier: 1.1,
  },
  {
    id: 'trapper',
    name: 'Trapper',
    level: 30,
    parentClassId: 'flank_guard',
    description: 'Launches sturdy hexagonal spiked traps that form barriers.',
    visualType: 'trapper',
    barrels: [
      { angle: 0, width: 18, length: 18, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.5, isTrapper: true }
    ],
    fovMultiplier: 1.0,
  },
  {
    id: 'smasher',
    name: 'Smasher',
    level: 30,
    parentClassId: 'tank',
    description: 'Sacrifices barrels to become a heavy rolling star core. Upgrades stats to 10.',
    visualType: 'smasher',
    barrels: [],
    fovMultiplier: 1.0,
    shapeOutline: 'circle',
  },

  // LEVEL 45 FINAL ULTRA UPGRADES:
  {
    id: 'triplet',
    name: 'Triplet',
    level: 45,
    parentClassId: 'triple_shot',
    description: 'Overwhelming central firepower with 3 aligned barrels.',
    visualType: 'spammer',
    barrels: [
      { angle: 0, width: 11, length: 20, offsetY: -8, offsetX: -2, delay: 0.5, recoil: 0.8 },
      { angle: 0, width: 12, length: 24, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.2 },
      { angle: 0, width: 11, length: 20, offsetY: 8, offsetX: -2, delay: 0.5, recoil: 0.8 }
    ],
    fovMultiplier: 1.1,
  },
  {
    id: 'penta_shot',
    name: 'Penta Shot',
    level: 45,
    parentClassId: 'triple_shot',
    description: 'Devastating 5-barrel fan blast that sweeps the path ahead and flies with backwards recoil.',
    visualType: 'booster',
    barrels: [
      { angle: -0.52, width: 12, length: 18, offsetY: 0, offsetX: 0, delay: 0.4, recoil: 1.0 },
      { angle: -0.26, width: 12, length: 21, offsetY: 0, offsetX: 0, delay: 0.2, recoil: 1.0 },
      { angle: 0, width: 12, length: 24, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 },
      { angle: 0.26, width: 12, length: 21, offsetY: 0, offsetX: 0, delay: 0.2, recoil: 1.0 },
      { angle: 0.52, width: 12, length: 18, offsetY: 0, offsetX: 0, delay: 0.4, recoil: 1.0 }
    ],
    fovMultiplier: 1.1,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    level: 45,
    parentClassId: 'assassin',
    description: 'Ultimate long-distance sniper rifle with screen-wide visual scope.',
    visualType: 'sniper',
    barrels: [
      { angle: 0, width: 14, length: 44, offsetY: 0, offsetX: 0, delay: 0, recoil: 2.5, bulletSizeMultiplier: 1.0, speedMultiplier: 2.6, reloadMultiplier: 2.8 }
    ],
    fovMultiplier: 2.0,
  },
  {
    id: 'stalker',
    name: 'Stalker',
    level: 45,
    parentClassId: 'assassin',
    description: 'High caliber sniper that fades completely invisible if standing still.',
    visualType: 'sniper',
    barrels: [
      { angle: 0, width: 14, length: 36, offsetY: 0, offsetX: 0, delay: 0, recoil: 2.2, bulletSizeMultiplier: 0.95, speedMultiplier: 2.0, reloadMultiplier: 2.5 }
    ],
    fovMultiplier: 1.55,
    stealth: true,
  },
  {
    id: 'overlord',
    name: 'Overlord',
    level: 45,
    parentClassId: 'overseer',
    description: 'Unleashes drones instantly from 4 side chambers.',
    visualType: 'drone',
    barrels: [
      { angle: 0, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0, recoil: 0, isCustomDrone: true },
      { angle: Math.PI / 2, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0.25, recoil: 0, isCustomDrone: true },
      { angle: Math.PI, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0.5, recoil: 0, isCustomDrone: true },
      { angle: -Math.PI / 2, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0.75, recoil: 0, isCustomDrone: true }
    ],
    fovMultiplier: 1.2,
    dronesMax: 8,
    dronesType: 'normal',
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    level: 45,
    parentClassId: 'overseer',
    description: 'Infects neutral yellow squares on touch and turns them into box drones (up to 34!).',
    visualType: 'necromancer',
    barrels: [], // Doesn't fire normal. Touches squares.
    fovMultiplier: 1.25,
    dronesMax: 34,
    dronesType: 'necro',
  },
  {
    id: 'manager',
    name: 'Manager',
    level: 45,
    parentClassId: 'overseer',
    description: 'Fades invisible AND commands a small squad of 8 guided drones from a custom bay.',
    visualType: 'drone',
    barrels: [
      { angle: 0, width: 14, length: 18, offsetY: 0, offsetX: 0, delay: 0, recoil: 0, isCustomDrone: true }
    ],
    fovMultiplier: 1.25,
    dronesMax: 8,
    dronesType: 'normal',
    stealth: true,
  },
  {
    id: 'annihilator',
    name: 'Annihilator',
    level: 45,
    parentClassId: 'destroyer',
    description: 'Colossal engine-sized cannon. Rockets the tank backwards of the bullet trajectory.',
    visualType: 'destroyer',
    barrels: [
      { angle: 0, width: 38, length: 24, offsetY: 0, offsetX: 0, delay: 0, recoil: 32.0, bulletSizeMultiplier: 3.2, reloadMultiplier: 4.4, speedMultiplier: 0.62, damageMultiplier: 4.0, penetrationMultiplier: 4.0 } as any
    ],
    fovMultiplier: 1.15,
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    level: 45,
    parentClassId: 'destroyer',
    description: 'Fires massive Destroyer rounds and auto-deploys a pair of defensive AI protection drones.',
    visualType: 'destroyer',
    barrels: [
      { angle: 0, width: 28, length: 22, offsetY: 0, offsetX: 0, delay: 0, recoil: 14.0, bulletSizeMultiplier: 2.4, reloadMultiplier: 3.8, speedMultiplier: 0.7, damageMultiplier: 3.0, penetrationMultiplier: 3.0 } as any,
      { angle: Math.PI, width: 12, length: 14, offsetY: 0, offsetX: 0, delay: 0, recoil: 0, isCustomDrone: true } // Rear drone spawner
    ],
    fovMultiplier: 1.15,
    dronesMax: 2,
    dronesType: 'normal',
  },
  {
    id: 'booster',
    name: 'Booster',
    level: 45,
    parentClassId: 'flank_guard',
    description: 'Uses 4 back thrusters for unbeatable acceleration-assisted ramming speed.',
    visualType: 'booster',
    barrels: [
      { angle: 0, width: 14, length: 22, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.0 },
      { angle: 2.45, width: 11, length: 16, offsetY: 4, offsetX: 0, delay: 0.5, recoil: 1.2 },
      { angle: -2.45, width: 11, length: 16, offsetY: -4, offsetX: 0, delay: 0.5, recoil: 1.2 },
      { angle: 2.65, width: 10, length: 14, offsetY: 7, offsetX: 0, delay: 0, recoil: 1.2 },
      { angle: -2.65, width: 10, length: 14, offsetY: -7, offsetX: 0, delay: 0, recoil: 1.2 }
    ],
    fovMultiplier: 1.0,
  },
  {
    id: 'spike',
    name: 'Spike',
    level: 45,
    parentClassId: 'smasher',
    description: 'A deadly spiked metal frame of spikes. Offers 1.5x body damage scaling.',
    visualType: 'smasher',
    barrels: [],
    fovMultiplier: 1.0,
    shapeOutline: 'spikes',
  },
  {
    id: 'tri_trapper',
    name: 'Tri-Trapper',
    level: 45,
    parentClassId: 'trapper',
    description: 'Lays a reliable 3-direction triangular coverage of protective traps.',
    visualType: 'trapper',
    barrels: [
      { angle: 0, width: 16, length: 16, offsetY: 0, offsetX: 0, delay: 0, recoil: 1.5, isTrapper: true },
      { angle: (2*Math.PI)/3, width: 16, length: 16, offsetY: 0, offsetX: 0, delay: 0.33, recoil: 1.5, isTrapper: true },
      { angle: -(2*Math.PI)/3, width: 16, length: 16, offsetY: 0, offsetX: 0, delay: 0.66, recoil: 1.5, isTrapper: true }
    ],
    fovMultiplier: 1.0,
  }
];
