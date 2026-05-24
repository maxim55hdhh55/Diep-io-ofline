export type GameMode = 'FFA' | 'TDM' | 'MAZE' | 'DOMINATION';

export interface TankStats {
  healthRegen: number; // 0 to 7 (or 10 for smashers)
  maxHealth: number;
  bodyDamage: number;
  bulletSpeed: number;
  bulletPenetration: number;
  bulletDamage: number;
  reload: number;
  movementSpeed: number;
}

export type StatName = keyof TankStats;

export interface UpgradeClass {
  id: string;
  name: string;
  level: number;
  parentClassId?: string;
  description: string;
  visualType: 'normal' | 'sniper' | 'spammer' | 'drone' | 'necromancer' | 'destroyer' | 'trapper' | 'smasher' | 'booster';
  barrels: BarrelConfig[];
  fovMultiplier: number; // For snipers
  stealth?: boolean; // Invisibility when stationary
  shapeOutline?: 'star' | 'circle' | 'spikes';
  dronesMax?: number;
  dronesType?: 'normal' | 'necro' | 'factory';
}

export interface BarrelConfig {
  angle: number; // angle offset in radians relative to body facing direction
  width: number; // diameter of barrel scaling
  length: number; // depth/length of barrel
  offsetY: number; // side offset (for parallel guns)
  offsetX: number; // front-back offset
  delay: number; // relative fire delay (0 to 1) for alternating fire
  recoil: number;
  isCustomDrone?: boolean; // spawns drones instead of bullets
  isTrapper?: boolean; // spawns traps instead of bullets
  bulletSizeMultiplier?: number;
  reloadMultiplier?: number;
  speedMultiplier?: number;
}

export interface ControlState {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  mouseLeft: boolean;
  mouseRight: boolean;
  mouseX: number; // map coordinates, NOT screen
  mouseY: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  hp: number;
  maxHp: number;
  damage: number; // Body damage or bullet contact damage
  createdTime: number;
}

export type BotPersonality = 'AGGRESSIVE' | 'COWARD' | 'FARMER' | 'CAMPER' | 'DODGER' | 'RAMMER' | 'SNIPER' | 'CHAOTIC' | 'DEFENDER' | 'AVENGER';

export interface Tank extends Entity {
  name: string;
  isBot: boolean;
  team: 'blue' | 'red' | 'green' | 'purple' | 'neutral';
  level: number;
  xp: number;
  score: number;
  kills: number;
  currentClass: UpgradeClass;
  stats: TankStats;
  statPointsSpent: Record<StatName, number>;
  availablePoints: number;
  angle: number; // current looking direction
  lastShotTime: number[]; // track cooldown per barrel
  recoilProgress: number[]; // animation progress for each barrel (0 to 1)
  skillPointsMax: number; // 7, or 10 for smasher
  invisibility: number; // 0 (visible) to 1 (fully invisible)
  lastMoveOrShootTime: number; // for invisibility counting
  // AI Bot state
  botPersonality?: BotPersonality;
  aiState?: 'FARM' | 'CHASE' | 'RETREAT' | 'WANDER';
  aiTargetId?: string | null;
  aiTargetTimer?: number;
  lastDamageTakenTime?: number;
}

export interface Bullet extends Entity {
  ownerId: string;
  ownerTeam: Tank['team'];
  damage: number;
  penetration: number; // current bullet hp
  maxPenetration: number;
  lifeTime: number; // seconds
  recoilApplied: boolean;
  isTrap: boolean;
  size: number;
}

export interface Drone extends Entity {
  ownerId: string;
  ownerTeam: Tank['team'];
  targetX?: number;
  targetY?: number;
  droneType: 'normal' | 'necro' | 'factory';
  targetAngle: number;
}

export interface Shape extends Entity {
  type: 'square' | 'triangle' | 'pentagon' | 'alpha-pentagon' | 'crasher' | 'shiny-square' | 'shiny-triangle' | 'shiny-pentagon';
  xpValue: number;
  spinSpeed: number;
  spinAngle: number;
}

export interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Domination target/control point
export interface Dominator extends Entity {
  team: Tank['team'];
  dominatorType: 'gunner' | 'destroyer' | 'trapper';
  angle: number;
  lastShotTime: number;
  radius: number;
}

export interface AlertMessage {
  id: string;
  text: string;
  color: string;
  timestamp: number;
}
