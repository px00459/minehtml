# Voxel Sandbox Game - Project Plan

## Project Overview

This is a production-ready voxel sandbox game built with Three.js and Cannon.js, following a decoupled component-based architecture. The game features infinite terrain generation, physics-based player movement, block placement/breaking, and chunk streaming.

## Architecture Explanation

### Core Pattern: Decoupled Component-Based System

The architecture uses three key components to maintain loose coupling:

1. **SceneManager** - Central orchestrator that manages the Three.js scene, camera, renderer, and maintains a list of SceneSubjects. It calls `update(deltaTime)` on each subject every frame, then renders the scene.

2. **SceneSubject** - Self-contained game entities (Player, World, Chunk, etc.). Each has a constructor and an `update(deltaTime)` method. Subjects know NOTHING about other subjects or the SceneManager, ensuring loose coupling.

3. **EventBus** - Pub/sub system for communication between subjects. Subjects emit events, and other subjects subscribe to them. This eliminates direct coupling between components.

```
┌─────────────────┐
│   SceneManager  │
│  (Orchestrator) │
└────────┬────────┘
         │ update()
         ▼
┌─────────────────────────────────────────┐
│              EventBus                   │
│  ┌──────────────┐    ┌──────────────┐   │
│  │ emit(event)  │    │ on(event,cb) │   │
│  └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────┘
         ▲                    ▲
         │                    │
    ┌────┴────┐          ┌────┴────┐
    │ Player  │          │  World  │
    │ Subject │          │ Subject │
    └─────────┘          └─────────┘
```

## File Structure

```
/project-root
├── /public
│   ├── index.html          # Main HTML with canvas and UI
│   ├── /css
│   │   └── style.css       # UI styling
│   └── /js
│       └── main.js         # Entry point (DOM only)
├── /src
│   ├── /core
│   │   ├── SceneManager.js # Scene orchestration
│   │   ├── EventBus.js     # Pub/sub system
│   │   └── PhysicsManager.js # Cannon.js wrapper
│   ├── /game
│   │   ├── Player.js       # Player controller
│   │   ├── World.js        # Chunk management
│   │   └── Chunk.js        # Single chunk logic
│   └── /utils
│       └── noise.js        # Terrain noise generation
├── /server
│   └── server.js           # Express static server
├── package.json            # Dependencies and scripts
├── plan.md                 # This file
└── .gitignore              # Git ignore rules
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:8000`

4. **Controls:**
   - Click canvas to lock pointer
   - WASD: Move
   - Space: Jump
   - Mouse: Look around
   - Left click: Break block
   - Right click: Place block
   - Keys 1-6: Select block type from hotbar
   - ESC: Release pointer

## How to Add New Features

### Adding a New SceneSubject

1. Create a new file in `/src/game/`:
```javascript
// src/game/NewFeature.js
import { EventBus } from '../core/EventBus.js';

export class NewFeature {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.eventBus = EventBus.getInstance();
        
        // Subscribe to events
        this.eventBus.on('player:moved', this.onPlayerMoved.bind(this));
        
        // Initialize Three.js objects
        // this.mesh = new THREE.Mesh(...);
        // this.scene.add(this.mesh);
    }
    
    update(deltaTime) {
        // Update logic here
    }
    
    onPlayerMoved(data) {
        // Handle event
    }
    
    dispose() {
        // Cleanup Three.js objects
        // this.scene.remove(this.mesh);
        // this.mesh.geometry.dispose();
    }
}
```

2. Register with SceneManager in `main.js`:
```javascript
import { NewFeature } from './src/game/NewFeature.js';

// After creating SceneManager
const newFeature = new NewFeature(sceneManager.scene, sceneManager.camera);
sceneManager.addSubject(newFeature);
```

### Emitting Custom Events

```javascript
// In any SceneSubject
this.eventBus.emit('custom:event', { data: 'value' });

// In another SceneSubject
this.eventBus.on('custom:event', (data) => {
    console.log('Received:', data);
});
```

## Technology Choices and Rationale

| Technology | Choice | Rationale |
|------------|--------|-----------|
| **Three.js** | v0.160.0 (CDN) | Lightweight, no build step required, excellent WebGL abstraction |
| **Cannon.js** | CDN | Simple physics engine with capsule colliders, perfect for player movement |
| **Express.js** | npm | Minimal static file server, easy to configure |
| **Nodemon** | npm | Auto-restart on changes during development |
| **Import Maps** | Native browser feature | Clean module imports without bundlers |
| **BufferGeometry** | Three.js | Efficient merged geometry for chunks (one draw call per chunk) |
| **Capsule Collider** | Cannon.js | Smooth player collision with terrain (no snagging on edges) |
| **Fixed Timestep** | Physics | Deterministic physics simulation |

## Performance Targets

- **60 FPS** on mid-range hardware with render distance of 4 chunks
- **Chunk loading**: < 50ms per chunk
- **Memory**: < 500MB with 4-chunk render distance
- **Draw calls**: One per visible chunk (merged geometry)

## Key Systems

### World Generation
- 16x16x16 block chunks
- Simple heightmap using value noise
- Grass on top, 3 dirt layers, stone below, bedrock at y=0
- 20% chance for trees on grass blocks

### Chunk Streaming
- Load chunks within 4-chunk radius of player
- Unload chunks beyond 5-chunk radius
- Frustum culling handled by Three.js

### Physics Integration
- Player body: Capsule shape for smooth terrain collision
- Movement: Apply velocity to physics body based on input
- Synchronization: Copy body position/quaternion to Three.js mesh every frame

### Block Interaction
- Raycasting: THREE.Raycaster from camera forward direction
- Reach: 6 blocks maximum
- Chunk mesh rebuild on block change

## Future Extensions

Once the core is stable, consider adding:
1. Inventory system with crafting
2. Mobs with basic AI
3. Day/night cycle
4. Water physics
5. Different biomes
6. Save/load system
