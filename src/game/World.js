import * as THREE from 'three';
import { Chunk, BLOCK_TYPES, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * World - SceneSubject that manages chunk loading/unloading
 * Handles terrain generation and block placement/removal
 */
class World {
    constructor(scene, camera, eventBus, physicsManager) {
        this.scene = scene;
        this.camera = camera;
        this.eventBus = eventBus;
        this.physicsManager = physicsManager;
        
        // Map of loaded chunks: key = "chunkX,chunkZ", value = Chunk
        this.chunks = new Map();
        
        // Render distance settings
        this.loadRadius = GameConfig.CHUNK.LOAD_RADIUS;
        this.unloadRadius = GameConfig.CHUNK.UNLOAD_RADIUS;
        
        // Player position tracking for chunk streaming
        this.lastPlayerChunkX = null;
        this.lastPlayerChunkZ = null;
        this.playerPosition = { x: 0, y: 0, z: 0 };
        
        // Raycaster for block interaction
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = GameConfig.PLAYER.REACH_DISTANCE;
        
        // Block type for placement (default: dirt)
        this.selectedBlockType = BLOCK_TYPES.DIRT;
        
        // Block highlight mesh
        this.highlightMesh = null;
        this.createHighlightMesh();
        
        // Store bound callbacks for cleanup
        this.boundOnPlayerMoved = this.onPlayerMoved.bind(this);
        this.boundOnBlockBreak = this.onBlockBreak.bind(this);
        this.boundOnBlockPlace = this.onBlockPlace.bind(this);
        this.boundOnBlockSelected = this.onBlockSelected.bind(this);
        this.boundOnBlockHighlight = this.onBlockHighlight.bind(this);
        
        // Subscribe to events
        this.eventBus.on('player:moved', this.boundOnPlayerMoved);
        this.eventBus.on('player:blockBreak', this.boundOnBlockBreak);
        this.eventBus.on('player:blockPlace', this.boundOnBlockPlace);
        this.eventBus.on('player:blockSelected', this.boundOnBlockSelected);
        this.eventBus.on('player:blockHighlight', this.boundOnBlockHighlight);
    }
    
    /**
     * Create highlight box mesh for block selection
     */
    createHighlightMesh() {
        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2
        });
        this.highlightMesh = new THREE.LineSegments(edges, material);
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);
    }
    
    /**
     * Update highlight mesh position
     */
    updateHighlight(position) {
        if (!position || !this.highlightMesh) {
            if (this.highlightMesh) {
                this.highlightMesh.visible = false;
            }
            return;
        }
        
        this.highlightMesh.position.set(
            position.x + 0.5,
            position.y + 0.5,
            position.z + 0.5
        );
        this.highlightMesh.visible = true;
    }
    
    /**
     * Handle player moved event
     */
    onPlayerMoved(data) {
        this.playerPosition = data.position;
        this.updateChunks(data.position.x, data.position.z);
    }
    
    /**
     * Handle block break event
     */
    onBlockBreak(data) {
        if (!data || !data.camera) return;
        const hit = this.raycast(data.camera);
        if (hit) {
            this.breakBlock(hit.breakPosition);
            this.updateHighlight(null);
        }
    }
    
    /**
     * Handle block place event
     */
    onBlockPlace(data) {
        if (!data || !data.camera) return;
        const hit = this.raycast(data.camera);
        if (hit) {
            this.placeBlock(hit.placePosition);
            this.updateHighlight(null);
        }
    }
    
    /**
     * Handle block selection event
     */
    onBlockSelected(data) {
        this.setSelectedBlock(data.slot);
    }
    
    /**
     * Handle block highlight event (from mouse move)
     */
    onBlockHighlight(data) {
        if (!data || !data.camera) return;
        // Trigger raycast to update highlight
        this.raycast(data.camera);
    }
    
    /**
     * Get chunk key from coordinates
     */
    getChunkKey(chunkX, chunkZ) {
        return `${chunkX},${chunkZ}`;
    }
    
    /**
     * Get or create chunk at world coordinates
     */
    getChunkAtWorldPos(worldX, worldZ) {
        const chunkX = Math.floor(worldX / CHUNK_SIZE);
        const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
        return this.getOrCreateChunk(chunkX, chunkZ);
    }
    
    /**
     * Get or create chunk at chunk coordinates
     */
    getOrCreateChunk(chunkX, chunkZ) {
        const key = this.getChunkKey(chunkX, chunkZ);
        
        if (!this.chunks.has(key)) {
            const chunk = new Chunk(chunkX, chunkZ, this.scene);
            chunk.generate();
            chunk.buildMesh();
            this.chunks.set(key, chunk);
        }
        
        return this.chunks.get(key);
    }
    
    /**
     * Get block at world coordinates
     */
    getBlock(worldX, worldY, worldZ) {
        const chunkX = Math.floor(worldX / CHUNK_SIZE);
        const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
        const key = this.getChunkKey(chunkX, chunkZ);
        
        const chunk = this.chunks.get(key);
        if (!chunk) return BLOCK_TYPES.AIR;
        
        const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        
        return chunk.getBlock(localX, worldY, localZ);
    }
    
    /**
     * Set block at world coordinates
     */
    setBlock(worldX, worldY, worldZ, blockType) {
        const chunkX = Math.floor(worldX / CHUNK_SIZE);
        const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
        const key = this.getChunkKey(chunkX, chunkZ);
        
        const chunk = this.chunks.get(key);
        if (!chunk) return false;
        
        const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        
        chunk.setBlock(localX, worldY, localZ, blockType);
        chunk.buildMesh();
        
        return true;
    }
    
    /**
     * Update chunk streaming based on player position
     */
    updateChunks(playerX, playerZ) {
        const playerChunkX = Math.floor(playerX / CHUNK_SIZE);
        const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE);
        
        // Only update if player moved to a different chunk
        if (playerChunkX === this.lastPlayerChunkX && playerChunkZ === this.lastPlayerChunkZ) {
            return;
        }
        
        this.lastPlayerChunkX = playerChunkX;
        this.lastPlayerChunkZ = playerChunkZ;
        
        // Load chunks within load radius
        for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
            for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
                // Check circular radius
                if (dx * dx + dz * dz > this.loadRadius * this.loadRadius) continue;
                
                const chunkX = playerChunkX + dx;
                const chunkZ = playerChunkZ + dz;
                const key = this.getChunkKey(chunkX, chunkZ);
                
                if (!this.chunks.has(key)) {
                    const chunk = new Chunk(chunkX, chunkZ, this.scene);
                    chunk.generate();
                    chunk.buildMesh();
                    this.chunks.set(key, chunk);
                }
            }
        }
        
        // Unload chunks beyond unload radius
        const chunksToRemove = [];
        for (const [key, chunk] of this.chunks) {
            const dx = chunk.chunkX - playerChunkX;
            const dz = chunk.chunkZ - playerChunkZ;
            
            if (dx * dx + dz * dz > this.unloadRadius * this.unloadRadius) {
                chunksToRemove.push(key);
            }
        }
        
        for (const key of chunksToRemove) {
            const chunk = this.chunks.get(key);
            chunk.dispose();
            this.chunks.delete(key);
        }
    }
    
    /**
     * Raycast from camera to find block hit
     * @param {THREE.Camera} camera - Camera to raycast from
     * @returns {Object|null} Hit info or null
     */
    raycast(camera) {
        // Get all chunk meshes for raycasting
        const meshes = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                meshes.push(chunk.mesh);
            }
        }
        
        if (meshes.length === 0) return null;
        
        // Raycast from camera center
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        
        const intersects = this.raycaster.intersectObjects(meshes);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            
            // Calculate block position from hit point
            const hitPoint = hit.point.clone().add(hit.face.normal.multiplyScalar(0.1));
            const blockX = Math.floor(hitPoint.x);
            const blockY = Math.floor(hitPoint.y);
            const blockZ = Math.floor(hitPoint.z);
            
            // Calculate adjacent block for placement
            const normal = hit.face.normal;
            const placeX = Math.floor(hit.point.x + normal.x * 0.5);
            const placeY = Math.floor(hit.point.y + normal.y * 0.5);
            const placeZ = Math.floor(hit.point.z + normal.z * 0.5);
            
            const result = {
                breakPosition: { x: blockX, y: blockY, z: blockZ },
                placePosition: { x: placeX, y: placeY, z: placeZ },
                face: hit.face
            };
            
            // Update highlight mesh
            this.updateHighlight(result.breakPosition);
            
            return result;
        }
        
        // Hide highlight if no hit
        this.updateHighlight(null);
        return null;
    }
    
    /**
     * Break block at position
     */
    breakBlock(position) {
        const currentBlock = this.getBlock(position.x, position.y, position.z);
        
        // Don't break bedrock
        if (currentBlock === BLOCK_TYPES.BEDROCK) return false;
        
        return this.setBlock(position.x, position.y, position.z, BLOCK_TYPES.AIR);
    }
    
    /**
     * Place block at position
     */
    placeBlock(position) {
        const currentBlock = this.getBlock(position.x, position.y, position.z);
        
        // Only place in air
        if (currentBlock !== BLOCK_TYPES.AIR) return false;
        
        return this.setBlock(position.x, position.y, position.z, this.selectedBlockType);
    }
    
    /**
     * Set selected block type for placement
     */
    setSelectedBlock(slotNumber) {
        const blockTypes = [
            BLOCK_TYPES.GRASS,  // Slot 1
            BLOCK_TYPES.DIRT,   // Slot 2
            BLOCK_TYPES.STONE,  // Slot 3
            BLOCK_TYPES.WOOD,   // Slot 4
            BLOCK_TYPES.LEAVES, // Slot 5
            BLOCK_TYPES.SAND    // Slot 6
        ];
        
        if (slotNumber >= 1 && slotNumber <= 6) {
            this.selectedBlockType = blockTypes[slotNumber - 1];
        }
    }
    
    /**
     * Update method called by SceneManager each frame
     */
    update(deltaTime) {
        // Update will be called with player position from Player subject
        // For now, just ensure initial chunks are loaded
        if (this.lastPlayerChunkX === null) {
            this.updateChunks(0, 0);
        }
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        // Remove all event listeners
        this.eventBus.removeAllListeners(this.boundOnPlayerMoved);
        this.eventBus.removeAllListeners(this.boundOnBlockBreak);
        this.eventBus.removeAllListeners(this.boundOnBlockPlace);
        this.eventBus.removeAllListeners(this.boundOnBlockSelected);
        this.eventBus.removeAllListeners(this.boundOnBlockHighlight);
        
        // Dispose highlight mesh
        if (this.highlightMesh) {
            this.scene.remove(this.highlightMesh);
            this.highlightMesh.geometry.dispose();
            this.highlightMesh.material.dispose();
            this.highlightMesh = null;
        }
        
        // Dispose all chunks
        for (const chunk of this.chunks.values()) {
            chunk.dispose();
        }
        this.chunks.clear();
    }
}

export { World };
