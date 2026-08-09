import * as THREE from 'three';
import { Noise } from '../utils/noise.js';

// Block types with colors
const BLOCK_TYPES = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    SAND: 6,
    BEDROCK: 7
};

// Block colors (vertex colors)
const BLOCK_COLORS = {
    [BLOCK_TYPES.GRASS]: new THREE.Color(0x567d46),
    [BLOCK_TYPES.DIRT]: new THREE.Color(0x8b5a2b),
    [BLOCK_TYPES.STONE]: new THREE.Color(0x808080),
    [BLOCK_TYPES.WOOD]: new THREE.Color(0x654321),
    [BLOCK_TYPES.LEAVES]: new THREE.Color(0x228b22),
    [BLOCK_TYPES.SAND]: new THREE.Color(0xf4e4bc),
    [BLOCK_TYPES.BEDROCK]: new THREE.Color(0x3a3a3a)
};

// Chunk dimensions
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 16;

/**
 * Chunk - Represents a single 16x16x16 chunk of blocks
 * Handles block data storage and mesh generation
 */
class Chunk {
    constructor(chunkX, chunkZ, scene) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        
        // Block data: Uint8Array for memory efficiency
        // Index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        
        // Three.js objects
        this.mesh = null;
        this.geometry = null;
        this.material = null;
        
        // Generation state
        this.isGenerated = false;
        this.needsMeshUpdate = false;
        
        // Initialize noise for terrain generation
        this.noise = new Noise(12345); // Fixed seed for consistency
    }
    
    /**
     * Get block at local coordinates
     * @param {number} x - Local X (0-15)
     * @param {number} y - Local Y (0-15)
     * @param {number} z - Local Z (0-15)
     * @returns {number} Block type
     */
    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return BLOCK_TYPES.AIR;
        }
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT;
        return this.blocks[index];
    }
    
    /**
     * Set block at local coordinates
     * @param {number} x - Local X (0-15)
     * @param {number} y - Local Y (0-15)
     * @param {number} z - Local Z (0-15)
     * @param {number} type - Block type
     */
    setBlock(x, y, z, type) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return;
        }
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT;
        this.blocks[index] = type;
        this.needsMeshUpdate = true;
    }
    
    /**
     * Generate terrain for this chunk
     */
    generate() {
        if (this.isGenerated) return;
        
        const worldX = this.chunkX * CHUNK_SIZE;
        const worldZ = this.chunkZ * CHUNK_SIZE;
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                // Get world coordinates
                const wx = worldX + x;
                const wz = worldZ + z;
                
                // Generate height using noise
                const heightValue = this.noise.layeredNoise(wx, wz, 4, 0.5, 2, 0.02);
                const surfaceHeight = Math.floor(heightValue * 10) + 5; // Height 5-15
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let blockType = BLOCK_TYPES.AIR;
                    
                    if (y === 0) {
                        // Bedrock at bottom
                        blockType = BLOCK_TYPES.BEDROCK;
                    } else if (y < surfaceHeight - 3) {
                        // Stone below
                        blockType = BLOCK_TYPES.STONE;
                    } else if (y < surfaceHeight) {
                        // Dirt layer
                        blockType = BLOCK_TYPES.DIRT;
                    } else if (y === surfaceHeight) {
                        // Grass on top
                        blockType = BLOCK_TYPES.GRASS;
                    }
                    
                    this.setBlock(x, y, z, blockType);
                }
                
                // Tree generation (20% chance on grass)
                if (surfaceHeight < CHUNK_HEIGHT - 4 && Math.random() < 0.2) {
                    this.generateTree(x, surfaceHeight + 1, z);
                }
            }
        }
        
        this.isGenerated = true;
        this.needsMeshUpdate = true;
    }
    
    /**
     * Generate a simple tree at given position
     * @param {number} x - Local X
     * @param {number} y - Local Y
     * @param {number} z - Local Z
     */
    generateTree(x, y, z) {
        const trunkHeight = 3 + Math.floor(Math.random() * 2);
        
        // Trunk
        for (let i = 0; i < trunkHeight; i++) {
            if (y + i < CHUNK_HEIGHT) {
                this.setBlock(x, y + i, z, BLOCK_TYPES.WOOD);
            }
        }
        
        // Leaves
        const leafStart = y + trunkHeight - 1;
        for (let ly = leafStart; ly <= leafStart + 2; ly++) {
            for (let lx = x - 2; lx <= x + 2; lx++) {
                for (let lz = z - 2; lz <= z + 2; lz++) {
                    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
                        // Don't replace trunk
                        if (lx === x && lz === z && ly < y + trunkHeight) continue;
                        // Don't replace existing non-air blocks
                        if (this.getBlock(lx, ly, lz) === BLOCK_TYPES.AIR) {
                            this.setBlock(lx, ly, lz, BLOCK_TYPES.LEAVES);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Build the chunk mesh from block data
     * Merges all visible faces into single BufferGeometry
     */
    buildMesh() {
        if (!this.needsMeshUpdate && this.mesh) return;
        
        // Remove old mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.geometry.dispose();
            this.material.dispose();
            this.mesh = null;
            this.geometry = null;
            this.material = null;
        }
        
        const vertices = [];
        const colors = [];
        const normals = [];
        
        // Face directions: [dx, dy, dz, normalX, normalY, normalZ]
        const faces = [
            [0, 1, 0, 0, 1, 0],  // Top
            [0, -1, 0, 0, -1, 0], // Bottom
            [1, 0, 0, 1, 0, 0],   // Right
            [-1, 0, 0, -1, 0, 0], // Left
            [0, 0, 1, 0, 0, 1],   // Front
            [0, 0, -1, 0, 0, -1]  // Back
        ];
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType === BLOCK_TYPES.AIR) continue;
                    
                    const blockColor = BLOCK_COLORS[blockType];
                    
                    // Check each face
                    for (const [dx, dy, dz, nx, ny, nz] of faces) {
                        const neighborX = x + dx;
                        const neighborY = y + dy;
                        const neighborZ = z + dz;
                        
                        // Check if neighbor is air (or out of bounds = air for now)
                        let neighborBlock = BLOCK_TYPES.AIR;
                        if (neighborX >= 0 && neighborX < CHUNK_SIZE &&
                            neighborY >= 0 && neighborY < CHUNK_HEIGHT &&
                            neighborZ >= 0 && neighborZ < CHUNK_SIZE) {
                            neighborBlock = this.getBlock(neighborX, neighborY, neighborZ);
                        }
                        
                        // Only add face if neighbor is air
                        if (neighborBlock === BLOCK_TYPES.AIR) {
                            // Add quad vertices (2 triangles)
                            this.addFaceVertices(vertices, colors, normals, 
                                x, y, z, dx, dy, dz, nx, ny, nz, blockColor);
                        }
                    }
                }
            }
        }
        
        if (vertices.length === 0) return;
        
        // Create geometry
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        
        // Create material with vertex colors
        this.material = new THREE.MeshLambertMaterial({ 
            vertexColors: true,
            transparent: false
        });
        
        // Create mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(
            this.chunkX * CHUNK_SIZE,
            0,
            this.chunkZ * CHUNK_SIZE
        );
        
        this.scene.add(this.mesh);
        this.needsMeshUpdate = false;
    }
    
    /**
     * Add face vertices to arrays
     */
    addFaceVertices(vertices, colors, normals, x, y, z, dx, dy, dz, nx, ny, nz, color) {
        // Determine which face and create appropriate quad
        const faceVerts = [];
        
        if (dy === 1) { // Top face
            faceVerts.push(
                [x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
                [x, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]
            );
        } else if (dy === -1) { // Bottom face
            faceVerts.push(
                [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z],
                [x, y, z + 1], [x + 1, y, z], [x, y, z]
            );
        } else if (dx === 1) { // Right face
            faceVerts.push(
                [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
                [x + 1, y, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]
            );
        } else if (dx === -1) { // Left face
            faceVerts.push(
                [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z],
                [x, y, z + 1], [x, y + 1, z], [x, y, z]
            );
        } else if (dz === 1) { // Front face
            faceVerts.push(
                [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1],
                [x, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]
            );
        } else if (dz === -1) { // Back face
            faceVerts.push(
                [x + 1, y, z], [x, y, z], [x, y + 1, z],
                [x + 1, y, z], [x, y + 1, z], [x + 1, y + 1, z]
            );
        }
        
        const normal = [nx, ny, nz];
        
        for (const vert of faceVerts) {
            vertices.push(...vert);
            colors.push(color.r, color.g, color.b);
            normals.push(...normal);
        }
    }
    
    /**
     * Dispose chunk resources
     */
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.geometry.dispose();
            this.material.dispose();
            this.mesh = null;
            this.geometry = null;
            this.material = null;
        }
    }
}

export { Chunk, BLOCK_TYPES, BLOCK_COLORS, CHUNK_SIZE, CHUNK_HEIGHT };
