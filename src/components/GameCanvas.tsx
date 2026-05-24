import React, { useRef, useEffect, useState } from 'react';
import { GameState, getDist } from '../gameEngine';
import { ControlState, Tank, Bullet, Drone, Shape, Dominator, Wall } from '../types';
import { COLORS } from '../constants';
import { Shield, Target, Axe } from 'lucide-react';

interface GameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState>;
  onControlChange: (updates: Partial<ControlState>) => void;
  onSpawn: (name: string) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameStateRef,
  onControlChange,
  onSpawn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle container resizing smoothly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(300, width),
          height: Math.max(200, height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Set up canvas mouse movement tracking & listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const currentGameState = gameStateRef.current;
      if (!currentGameState) return;

      // Translate screen coordinate to world coordinate
      const mouseWorldX = currentGameState.camX + (screenX - dimensions.width / 2) / currentGameState.camZoom;
      const mouseWorldY = currentGameState.camY + (screenY - dimensions.height / 2) / currentGameState.camZoom;

      onControlChange({
        mouseX: mouseWorldX,
        mouseY: mouseWorldY,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Blur typing focus to return standard controls keyboard focus instantly
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      if (e.button === 0) {
        onControlChange({ mouseLeft: true });
      } else if (e.button === 2) {
        e.preventDefault();
        onControlChange({ mouseRight: true });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        onControlChange({ mouseLeft: false });
      } else if (e.button === 2) {
        e.preventDefault();
        onControlChange({ mouseRight: false });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Disable right-click menus inside game window
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [dimensions, gameStateRef, onControlChange]);

  // Main canvas renderer callback loop (Continuous Animation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;

    const render = () => {
      animId = requestAnimationFrame(render);

      const currentGameState = gameStateRef.current;
      if (!currentGameState) return;

      frameCount++;
      const time = performance.now();
      if (time >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (time - lastTime));
        frameCount = 0;
        lastTime = time;
      }

      const { width, height } = dimensions;
      const { camX, camY, camZoom, mapSize, gameMode, player } = currentGameState;

      // Clear background grid plane
      ctx.fillStyle = '#C6C6C6';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Centering & Zoom
      ctx.translate(width / 2, height / 2);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-camX, -camY);

      // SLOPE S0: Light chess-like infinite grids
      ctx.fillStyle = COLORS.backgroundGrid;
      ctx.fillRect(0, 0, mapSize, mapSize);

      // Draw dynamic grid lines
      ctx.strokeStyle = COLORS.linesGrid;
      ctx.lineWidth = 1.2;
      const gridSize = 45;
      ctx.beginPath();
      for (let x = 0; x <= mapSize; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapSize);
      }
      for (let y = 0; y <= mapSize; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapSize, y);
      }
      ctx.stroke();

      // Map boundaries border line
      ctx.strokeStyle = COLORS.borderDark;
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, mapSize, mapSize);

      // Spawn Area backgrounds in TDM
      if (gameMode === 'TDM') {
        // Blue base TDM
        ctx.fillStyle = 'rgba(0, 178, 225, 0.08)';
        ctx.fillRect(0, 0, currentGameState.blueBaseZone.x2, currentGameState.blueBaseZone.y2);
        ctx.strokeStyle = 'rgba(0, 178, 225, 0.2)';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, currentGameState.blueBaseZone.x2, currentGameState.blueBaseZone.y2);

        // Red base TDM
        ctx.fillStyle = 'rgba(241, 78, 84, 0.08)';
        ctx.fillRect(currentGameState.redBaseZone.x1, currentGameState.redBaseZone.y1, mapSize, mapSize);
        ctx.strokeStyle = 'rgba(241, 78, 84, 0.2)';
        ctx.lineWidth = 4;
        ctx.strokeRect(currentGameState.redBaseZone.x1, currentGameState.redBaseZone.y1, mapSize, mapSize);
      }

      // Domination Nest circles visual
      if (gameMode === 'DOMINATION' || true) {
        ctx.beginPath();
        ctx.arc(mapSize / 2, mapSize / 2, mapSize * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Maze walls or blocks rendering
      if (gameMode === 'MAZE') {
        currentGameState.walls.forEach((wall) => {
          drawWellBrick(ctx, wall);
        });
      }

      // SLOPE S1: Traps (Trappers shields)
      currentGameState.bullets.filter(b => b.isTrap).forEach(trap => {
        drawTrapperSpikes(ctx, trap);
      });

      // SLOPE S2: Shapes (Squres, Triangles, Pentagons)
      currentGameState.shapes.forEach((shape) => {
        drawGameShape(ctx, shape);
      });

      // SLOPE S3: Domination target turrets
      if (gameMode === 'DOMINATION') {
        currentGameState.dominators.forEach(dom => {
          drawDominatorTurret(ctx, dom);
        });
      }

      // SLOPE S3.5: Bullets & Drones
      currentGameState.bullets.filter(b => !b.isTrap).forEach((bullet) => {
        drawBulletCircle(ctx, bullet);
      });

      currentGameState.drones.forEach((drone) => {
        drawTriangleDrone(ctx, drone);
      });

      // SLOPE S4 & S5: Tanks (Guns first, then bodies)
      currentGameState.tanks.forEach((tank) => {
        drawTankGunsAndBody(ctx, tank);
      });

      // SLOPE S7: Overlays above (Healthbars)
      currentGameState.tanks.forEach((tank) => {
        drawTankHealthBar(ctx, tank, player.id);
      });

      // Draw healthbar above dominators
      if (gameMode === 'DOMINATION') {
        currentGameState.dominators.forEach(dom => {
          drawDominatorHealthBar(ctx, dom);
        });
      }

      ctx.restore();

      // Screen space draws: Draw FPS indicator in elegant typography in bottom right
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = 'bold 12px "JetBrains Mono", monospace, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${fps} FPS`, width - 15, height - 15);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dimensions]);

  // Visual component: Well brick
  const drawWellBrick = (ctx: CanvasRenderingContext2D, wall: Wall) => {
    ctx.fillStyle = '#8f8f8f';
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(wall.x, wall.y, wall.width, wall.height, 4) : ctx.rect(wall.x, wall.y, wall.width, wall.height);
    ctx.fill();
    ctx.stroke();

    // 3D inner shade look
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(wall.x + 3, wall.y + wall.height - 12, wall.width - 6, 8);
  };

  // Trapper hexagonal barrier
  const drawTrapperSpikes = (ctx: CanvasRenderingContext2D, trap: Bullet) => {
    ctx.save();
    ctx.translate(trap.x, trap.y);
    // Draw rotating trap
    const animRot = (Date.now() - trap.createdTime) * 0.0012;
    ctx.rotate(animRot);

    ctx.fillStyle = trap.color;
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 3.5;

    // Draw elegant 6-sided hexagon with spikes
    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides * 2; i++) {
      const angle = (i * Math.PI) / sides;
      // alternate index for inside/outside spine
      const r = i % 2 === 0 ? trap.radius : trap.radius * 0.6;
      const sx = Math.cos(angle) * r;
      const sy = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Shape drawings
  const drawGameShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.spinAngle);

    ctx.fillStyle = shape.color;
    ctx.strokeStyle = COLORS.borderDark;
    // thick border scaled to shape size
    ctx.lineWidth = shape.radius < 15 ? 3 : (shape.radius < 30 ? 4 : 8);

    const rad = shape.radius;

    if (shape.type === 'square' || shape.type === 'shiny-square') {
      // Draw rectangular brick
      ctx.beginPath();
      ctx.rect(-rad, -rad, rad * 2, rad * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'triangle' || shape.type === 'shiny-triangle' || shape.type === 'crasher') {
      // Draw 3-sided normal triangle
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const x = Math.cos((i * 2 * Math.PI) / 3 - Math.PI / 2) * rad;
        const y = Math.sin((i * 2 * Math.PI) / 3 - Math.PI / 2) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'pentagon' || shape.type === 'shiny-pentagon' || shape.type === 'alpha-pentagon') {
      // Draw 5-sided pentagon
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * rad;
        const y = Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // Healthbar inline if shape took damage
    if (shape.hp < shape.maxHp) {
      drawInlineHealthBar(ctx, shape.x, shape.y + shape.radius + 10, shape.radius * 1.5, shape.hp / shape.maxHp);
    }
  };

  // Draw Dominator
  const drawDominatorTurret = (ctx: CanvasRenderingContext2D, dom: Dominator) => {
    ctx.save();
    ctx.translate(dom.x, dom.y);

    // Draw base ring
    ctx.fillStyle = dom.team === 'blue' ? COLORS.player : (dom.team === 'red' ? COLORS.enemy : COLORS.neutralGrey);
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, dom.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw rotating launcher barrel
    ctx.rotate(dom.angle);
    ctx.fillStyle = '#858585';
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 6;

    const bWidth = dom.dominatorType === 'destroyer' ? 52 : (dom.dominatorType === 'trapper' ? 44 : 36);
    const bLength = dom.dominatorType === 'destroyer' ? 85 : 78;

    ctx.beginPath();
    ctx.rect(0, -bWidth / 2, bLength, bWidth);
    ctx.fill();
    ctx.stroke();

    // Inner dome core
    ctx.fillStyle = '#b5b5b5';
    ctx.beginPath();
    ctx.arc(0, 0, dom.radius * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  // Standard bullet circle
  const drawBulletCircle = (ctx: CanvasRenderingContext2D, bullet: Bullet) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = bullet.color;
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 3.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Triangle drone controller
  const drawTriangleDrone = (ctx: CanvasRenderingContext2D, drone: Drone) => {
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.rotate(drone.targetAngle);

    ctx.fillStyle = drone.color;
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 3;

    // Draw triangle facing right
    ctx.beginPath();
    const rad = drone.radius;
    
    if (drone.droneType === 'necro') {
      // Draw square drone
      ctx.rect(-rad, -rad, rad * 2, rad * 2);
    } else {
      ctx.moveTo(rad * 1.3, 0);
      ctx.lineTo(-rad, -rad * 1.0);
      ctx.lineTo(-rad, rad * 1.0);
      ctx.closePath();
    }
    
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Draw Tank guns & body circle
  const drawTankGunsAndBody = (ctx: CanvasRenderingContext2D, tank: Tank) => {
    // Apply transparency for stationary invisible tanks (Stalker / landmine)
    const showOpacity = 1.0 - (tank.invisibility * 0.94); // visible slightly to owner or bot outlines
    
    ctx.save();
    ctx.globalAlpha = showOpacity;
    ctx.translate(tank.x, tank.y);

    const barrels = tank.currentClass.barrels;
    const bodyRad = tank.radius;

    // DRAW BARRELS
    barrels.forEach((bar, idx) => {
      ctx.save();
      ctx.rotate(tank.angle + bar.angle);

      // Recoil retraction animation factor
      const rec = tank.recoilProgress[idx] || 0; // index from 0 to 1
      const animatedLength = bar.length * 1.3 - rec * 8; // move inwards when shot

      ctx.fillStyle = COLORS.neutralGrey;
      ctx.strokeStyle = COLORS.borderDark;
      ctx.lineWidth = 4;

      if (bar.isCustomDrone) {
        // Drone master spawner looks like a trapezoid point
        ctx.beginPath();
        ctx.moveTo(0, -bar.width / 2);
        ctx.lineTo(animatedLength, -bar.width * 0.9);
        ctx.lineTo(animatedLength, bar.width * 0.9);
        ctx.lineTo(0, bar.width / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Standard barrel rectangle
        ctx.beginPath();
        // offset parallel barrels
        ctx.rect(bar.offsetX, -bar.width / 2 + bar.offsetY, animatedLength, bar.width);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    });

    // DRAW BODY CORE (Z-INDEX 5)
    ctx.fillStyle = tank.color;
    ctx.strokeStyle = COLORS.borderDark;
    ctx.lineWidth = 4.5;

    const classId = tank.currentClass.id;
    const isSm = classId.includes('smasher') || classId === 'spike';

    if (isSm) {
      // Smashers/Spikes draw gear ring
      ctx.save();
      // slow spin
      const rot = (Date.now() * 0.0016) % (Math.PI * 2);
      ctx.rotate(rot);

      ctx.lineWidth = 4.5;
      ctx.fillStyle = '#7a7a7a'; // gray gear outline
      ctx.strokeStyle = COLORS.borderDark;

      if (tank.currentClass.shapeOutline === 'spikes') {
        // High density spikes (12 sharp spines)
        ctx.beginPath();
        const spikes = 12;
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i * Math.PI) / spikes;
          const r = i % 2 === 0 ? bodyRad * 1.48 : bodyRad * 0.88;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Six-sided clean hex ring
        ctx.beginPath();
        const hex = 6;
        for (let i = 0; i < hex * 2; i++) {
          const a = (i * Math.PI) / hex;
          const r = i % 2 === 0 ? bodyRad * 1.35 : bodyRad * 1.05;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // Central circular core
    ctx.beginPath();
    ctx.arc(0, 0, bodyRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  // Above tank alerts
  const drawTankHealthBar = (ctx: CanvasRenderingContext2D, tank: Tank, activePlayerId: string) => {
    const isStationarySecret = tank.invisibility > 0.9 && tank.id !== activePlayerId;
    if (isStationarySecret) return; // fully invisible to others

    ctx.save();
    ctx.translate(tank.x, tank.y);
    
    // Draw Name and Level above
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2.5;

    const label = `${tank.name} [Lvl ${tank.level}]`;
    ctx.strokeText(label, 0, -tank.radius - 22);
    ctx.fillText(label, 0, -tank.radius - 22);

    // Draw standard HP bar
    const hpRatio = tank.hp / tank.maxHp;
    // Diep.io shows health bar only when damaged or recently damaged
    const recentlyDamaged = tank.hp < tank.maxHp;
    if (recentlyDamaged) {
      drawInlineHealthBar(ctx, 0, -tank.radius - 12, tank.radius * 1.8, hpRatio);
    }
    ctx.restore();
  };

  const drawDominatorHealthBar = (ctx: CanvasRenderingContext2D, dom: Dominator) => {
    ctx.save();
    ctx.translate(dom.x, dom.y);
    // Draw Dominator label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3.5;

    const label = `Dominator (${dom.dominatorType.toUpperCase()})`;
    ctx.strokeText(label, 0, -dom.radius - 25);
    ctx.fillText(label, 0, -dom.radius - 25);
    
    drawInlineHealthBar(ctx, 0, -dom.radius - 14, dom.radius * 1.8, dom.hp / dom.maxHp);
    ctx.restore();
  };

  // Helper for actual Health rectangle line
  const drawInlineHealthBar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, barWidth: number, ratio: number) => {
    const barHeight = 6;
    const r = Math.max(0, Math.min(1, ratio));

    ctx.save();
    ctx.translate(cx - barWidth / 2, cy - barHeight / 2);

    // Gray background container
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, barWidth, barHeight);

    // HP filler - green for high, orange/red for low
    ctx.fillStyle = r > 0.45 ? '#00E16F' : '#F14E54';
    ctx.fillRect(1, 1, Math.max(0, (barWidth - 2) * r), barHeight - 2);

    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      id="game_container"
      className="relative w-full h-full bg-[#1c1c1c] overflow-hidden select-none touch-none rounded-xl border-4 border-[#707070] shadow-diep-lg"
    >
      <canvas
        ref={canvasRef}
        id="game_viewport"
        width={dimensions.width}
        height={dimensions.height}
        className="block cursor-crosshair w-full h-full"
      />
    </div>
  );
};
