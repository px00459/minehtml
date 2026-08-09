import * as THREE from 'three';
import { Chunk, BLOCK_TYPES, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';

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
        this.loadRadius = 4;  // Load chunks within this radius
        this.unloadRadius = 5; // Unload chunks beyond this radius
        
        // Player position tracking for chunk streaming
        this.lastPlayerChunkX = null;
        this.lastPlayerChunkZ = null;
        this.playerPosition = { x: 0, y: 0, z: 0 };
        
        // Raycaster for block interaction
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 6; // 6 block reach
        
        // Block type for placement (default: dirt)
        this.selectedBlockType = BLOCK_TYPES.DIRT;
        
        // Subscribe to events
        this.eventBus.on('player:moved', this.onPlayerMoved.bind(this));
        this.eventBus.on('player:blockBreak', this.onBlockBreak.bind(this));
        this.eventBus.on('player:blockPlace', this.onBlockPlace.bind(this));
        this.eventBus.on('player:blockSelected', this.onBlockSelected.bind(this));
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
        }
    }
    
    /**
     * Handle block selection event
     */
    onBlockSelected(data) {
        this.setSelectedBlock(data.slot);
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
            
            return {
                breakPosition: { x: blockX, y: blockY, z: blockZ },
                placePosition: { x: placeX, y: placeY, z: placeZ },
                face: hit.face
            };
        }
        
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
}

export { World };
