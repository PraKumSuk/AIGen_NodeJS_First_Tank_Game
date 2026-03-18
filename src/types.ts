export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  health: number;
  maxHealth: number;
  speed: number;
  type: 'player' | 'enemy-tank' | 'soldier';
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  damage: number;
  type: 'player' | 'enemy';
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Insane';

export interface GameState {
  score: number;
  level: number;
  difficulty: Difficulty;
  isGameOver: boolean;
  isPaused: boolean;
}
