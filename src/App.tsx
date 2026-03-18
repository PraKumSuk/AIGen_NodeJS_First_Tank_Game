/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Heart, Shield, Sword, Play, RotateCcw, Pause, Settings } from 'lucide-react';
import { Entity, Bullet, Particle, Difficulty, GameState, Point } from './types';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const DIFFICULTY_SETTINGS: Record<Difficulty, any> = {
  Easy: { enemySpeed: 1, spawnRate: 0.005, soldierRate: 0.01, enemyHealth: 50 },
  Medium: { enemySpeed: 1.5, spawnRate: 0.01, soldierRate: 0.02, enemyHealth: 100 },
  Hard: { enemySpeed: 2, spawnRate: 0.02, soldierRate: 0.03, enemyHealth: 150 },
  Insane: { enemySpeed: 3, spawnRate: 0.03, soldierRate: 0.05, enemyHealth: 200 },
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    level: 1,
    difficulty: 'Medium',
    isGameOver: false,
    isPaused: true,
  });

  const [gameStarted, setGameStarted] = useState(false);

  // Game Objects Refs to avoid re-renders
  const playerRef = useRef<Entity>({
    id: 'player',
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    width: 40,
    height: 40,
    angle: 0,
    health: 100,
    maxHealth: 100,
    speed: 3,
    type: 'player',
  });

  const enemiesRef = useRef<Entity[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastShotTimeRef = useRef(0);
  const requestRef = useRef<number>(null);

  const spawnEnemy = useCallback((difficulty: Difficulty) => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const isSoldier = Math.random() < settings.soldierRate;
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;

    if (side === 0) { x = Math.random() * CANVAS_WIDTH; y = -50; }
    else if (side === 1) { x = CANVAS_WIDTH + 50; y = Math.random() * CANVAS_HEIGHT; }
    else if (side === 2) { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 50; }
    else { x = -50; y = Math.random() * CANVAS_HEIGHT; }

    const newEnemy: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      width: isSoldier ? 20 : 40,
      height: isSoldier ? 20 : 40,
      angle: 0,
      health: isSoldier ? 30 : settings.enemyHealth,
      maxHealth: isSoldier ? 30 : settings.enemyHealth,
      speed: isSoldier ? settings.enemySpeed * 1.5 : settings.enemySpeed,
      type: isSoldier ? 'soldier' : 'enemy-tank',
    };
    enemiesRef.current.push(newEnemy);
  }, []);

  const createExplosion = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  };

  const update = useCallback(() => {
    if (gameState.isGameOver || gameState.isPaused) return;

    const player = playerRef.current;
    const settings = DIFFICULTY_SETTINGS[gameState.difficulty];

    // Player Movement
    if (keysRef.current['w'] || keysRef.current['ArrowUp']) player.y -= player.speed;
    if (keysRef.current['s'] || keysRef.current['ArrowDown']) player.y += player.speed;
    if (keysRef.current['a'] || keysRef.current['ArrowLeft']) player.x -= player.speed;
    if (keysRef.current['d'] || keysRef.current['ArrowRight']) player.x += player.speed;

    // Constrain player
    player.x = Math.max(player.width / 2, Math.min(CANVAS_WIDTH - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(CANVAS_HEIGHT - player.height / 2, player.y));

    // Player Shooting (Auto-aim or mouse aim could be added, for now let's use mouse position)
    // We'll calculate angle based on mouse later in the draw loop or mousemove

    // Spawn Enemies
    if (Math.random() < settings.spawnRate) {
      spawnEnemy(gameState.difficulty);
    }

    // Update Enemies
    enemiesRef.current.forEach(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      enemy.angle = Math.atan2(dy, dx);

      if (dist > 30) {
        enemy.x += Math.cos(enemy.angle) * enemy.speed;
        enemy.y += Math.sin(enemy.angle) * enemy.speed;
      }

      // Enemy shooting
      if (enemy.type === 'enemy-tank' && Math.random() < 0.01) {
        bulletsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(enemy.angle) * 5,
          vy: Math.sin(enemy.angle) * 5,
          ownerId: enemy.id,
          damage: 10,
          type: 'enemy',
        });
      }
    });

    // Update Bullets
    bulletsRef.current = bulletsRef.current.filter(bullet => {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;

      // Off screen
      if (bullet.x < 0 || bullet.x > CANVAS_WIDTH || bullet.y < 0 || bullet.y > CANVAS_HEIGHT) return false;

      // Collision with enemies
      if (bullet.type === 'player') {
        for (let i = 0; i < enemiesRef.current.length; i++) {
          const enemy = enemiesRef.current[i];
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < enemy.width / 2) {
            enemy.health -= bullet.damage;
            createExplosion(bullet.x, bullet.y, '#ffcc00', 5);
            if (enemy.health <= 0) {
              setGameState(prev => ({ ...prev, score: prev.score + (enemy.type === 'soldier' ? 50 : 100) }));
              createExplosion(enemy.x, enemy.y, enemy.type === 'soldier' ? '#ff4444' : '#555555', 20);
              enemiesRef.current.splice(i, 1);
            }
            return false;
          }
        }
      } else {
        // Collision with player
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.width / 2) {
          player.health -= bullet.damage;
          createExplosion(bullet.x, bullet.y, '#ff4444', 5);
          if (player.health <= 0) {
            setGameState(prev => ({ ...prev, isGameOver: true }));
          }
          return false;
        }
      }

      return true;
    });

    // Update Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      return p.life > 0;
    });

    // Level up logic
    if (gameState.score > gameState.level * 1000) {
      setGameState(prev => ({ ...prev, level: prev.level + 1 }));
    }

  }, [gameState.isGameOver, gameState.isPaused, gameState.difficulty, gameState.score, gameState.level, spawnEnemy]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid effect
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 50) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Player
    const player = playerRef.current;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    // Tank Body
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    // Tank Turret
    ctx.fillStyle = '#1e3d1a';
    ctx.fillRect(-5, -5, 25, 10);
    ctx.restore();

    // Player Health Bar
    ctx.fillStyle = '#333';
    ctx.fillRect(player.x - 20, player.y - 35, 40, 5);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(player.x - 20, player.y - 35, (player.health / player.maxHealth) * 40, 5);

    // Draw Enemies
    enemiesRef.current.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      if (enemy.type === 'enemy-tank') {
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-5, -5, 25, 10);
      } else {
        // Soldier
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Enemy Health Bar
      ctx.fillStyle = '#333';
      ctx.fillRect(enemy.x - 15, enemy.y - 25, 30, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(enemy.x - 15, enemy.y - 25, (enemy.health / enemy.maxHealth) * 30, 3);
    });

    // Draw Bullets
    bulletsRef.current.forEach(bullet => {
      ctx.fillStyle = bullet.type === 'player' ? '#fbbf24' : '#ef4444';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

  }, []);

  const gameLoop = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key] = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      playerRef.current.angle = Math.atan2(mouseY - playerRef.current.y, mouseX - playerRef.current.x);
    };
    const handleMouseDown = () => {
      if (gameState.isPaused || gameState.isGameOver) return;
      const now = Date.now();
      if (now - lastShotTimeRef.current > 250) {
        bulletsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: playerRef.current.x,
          y: playerRef.current.y,
          vx: Math.cos(playerRef.current.angle) * 8,
          vy: Math.sin(playerRef.current.angle) * 8,
          ownerId: 'player',
          damage: 25,
          type: 'player',
        });
        lastShotTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameState.isPaused, gameState.isGameOver]);

  const startGame = (diff: Difficulty) => {
    setGameState({
      score: 0,
      level: 1,
      difficulty: diff,
      isGameOver: false,
      isPaused: false,
    });
    playerRef.current.health = 100;
    playerRef.current.x = CANVAS_WIDTH / 2;
    playerRef.current.y = CANVAS_HEIGHT / 2;
    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    setGameStarted(true);
  };

  const togglePause = () => {
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="relative group">
        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl shadow-2xl border-4 border-[#222] cursor-crosshair"
          id="game-canvas"
        />

        {/* HUD Overlay */}
        {gameStarted && !gameState.isGameOver && (
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
            <div className="flex flex-col gap-2">
              <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 flex items-center gap-3">
                <Trophy className="text-yellow-500 w-5 h-5" />
                <span className="text-xl font-mono font-bold">{gameState.score.toLocaleString()}</span>
              </div>
              <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 flex items-center gap-3">
                <Sword className="text-blue-500 w-5 h-5" />
                <span className="text-sm uppercase tracking-wider font-bold">Level {gameState.level}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 flex items-center gap-3">
                <Heart className="text-red-500 w-5 h-5" />
                <div className="w-32 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: `${(playerRef.current.health / playerRef.current.maxHealth) * 100}%` }}
                    className="h-full bg-red-500"
                  />
                </div>
              </div>
              <button
                onClick={togglePause}
                className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 pointer-events-auto hover:bg-white/10 transition-colors"
              >
                {gameState.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {/* Start / Game Over Menu */}
        <AnimatePresence>
          {(!gameStarted || gameState.isGameOver || gameState.isPaused) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-center items-center justify-center rounded-xl"
            >
              <div className="text-center p-8 max-w-md w-full">
                {!gameStarted ? (
                  <>
                    <h1 className="text-6xl font-black mb-2 tracking-tighter italic text-emerald-500">TANK ASSAULT</h1>
                    <p className="text-gray-400 mb-8 text-sm uppercase tracking-[0.2em]">Defend the base. Destroy the invaders.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {(['Easy', 'Medium', 'Hard', 'Insane'] as Difficulty[]).map((diff) => (
                        <button
                          key={diff}
                          onClick={() => startGame(diff)}
                          className="group relative bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all hover:border-emerald-500/50"
                        >
                          <span className="block text-lg font-bold">{diff}</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Select Difficulty</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : gameState.isGameOver ? (
                  <>
                    <h2 className="text-5xl font-black mb-2 text-red-500 italic">MISSION FAILED</h2>
                    <p className="text-gray-400 mb-6 uppercase tracking-widest">Your tank was destroyed</p>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8">
                      <div className="text-sm text-gray-500 uppercase mb-1">Final Score</div>
                      <div className="text-4xl font-mono font-bold text-yellow-500">{gameState.score.toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => setGameStarted(false)}
                      className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold transition-all mx-auto"
                    >
                      <RotateCcw className="w-5 h-5" />
                      RETRY MISSION
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-5xl font-black mb-8 italic text-blue-400">PAUSED</h2>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={togglePause}
                        className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold transition-all"
                      >
                        <Play className="w-5 h-5" />
                        RESUME
                      </button>
                      <button
                        onClick={() => setGameStarted(false)}
                        className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold border border-white/10 transition-all"
                      >
                        <RotateCcw className="w-5 h-5" />
                        QUIT TO MENU
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Hint */}
      <div className="mt-8 flex gap-8 text-gray-500 text-xs uppercase tracking-widest font-bold">
        <div className="flex items-center gap-2">
          <kbd className="bg-white/10 px-2 py-1 rounded border border-white/20 text-white">WASD</kbd>
          <span>Move Tank</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="bg-white/10 px-2 py-1 rounded border border-white/20 text-white">MOUSE</kbd>
          <span>Aim & Shoot</span>
        </div>
      </div>
    </div>
  );
}
