// Main entry point - DOM setup only, NO game logic or Three.js code here

import { SceneManager } from '../../src/core/SceneManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { PhysicsManager } from '../../src/core/PhysicsManager.js';
import { Player } from '../../src/game/Player.js';
import { World } from '../../src/game/World.js';

// Get canvas
const canvas = document.getElementById('gameCanvas');

// Create managers
const eventBus = new EventBus();
const physicsManager = new PhysicsManager();
const sceneManager = new SceneManager(canvas, eventBus);

// Create game subjects - pass all dependencies
const world = new World(sceneManager.scene, sceneManager.camera, eventBus, physicsManager);
const player = new Player(sceneManager.scene, sceneManager.camera, eventBus, physicsManager);

// Register subjects with SceneManager
sceneManager.addSubject(world);
sceneManager.addSubject(player);
sceneManager.addSubject(physicsManager);

// Handle window resize
window.addEventListener('resize', () => {
    sceneManager.onWindowResize();
});

// Pointer lock handling
const startOverlay = document.getElementById('start-overlay');
let isPointerLocked = false;

canvas.addEventListener('click', () => {
    if (!isPointerLocked) {
        canvas.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
    
    if (isPointerLocked) {
        startOverlay.classList.add('hidden');
    } else {
        startOverlay.classList.remove('hidden');
    }
});

// Keyboard input for hotbar selection
document.addEventListener('keydown', (event) => {
    const slotNumber = parseInt(event.key);
    if (slotNumber >= 1 && slotNumber <= 6) {
        // Update UI
        document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
            if (index + 1 === slotNumber) {
                slot.classList.add('selected');
            } else {
                slot.classList.remove('selected');
            }
        });
        
        // Emit event for player to update selected block type
        eventBus.emit('hotbar:changed', { slot: slotNumber });
    }
});

// Start animation loop
sceneManager.start();

console.log('Voxel Sandbox initialized successfully');
