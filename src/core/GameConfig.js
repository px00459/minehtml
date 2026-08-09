/**
 * GameConfig - Centralized configuration for game settings
 * All magic numbers and constants should be defined here
 */
const GameConfig = {
    // Display settings
    DISPLAY: {
        FOV: 75,
        NEAR_PLANE: 0.1,
        FAR_PLANE: 1000,
        SKY_COLOR: 0x87CEEB,
        FOG_START: 50,
        FOG_END: 150,
        PIXEL_RATIO_MAX: 2
    },
    
    // Physics settings
    PHYSICS: {
        GRAVITY: -9.82,
        FIXED_TIME_STEP: 1 / 60,
        MAX_SUB_STEPS: 3
    },
    
    // Player settings
    PLAYER: {
        MASS: 70,
        RADIUS: 0.4,
        HEIGHT: 1.8,
        EYE_HEIGHT: 0.5,
        MOVE_SPEED: 8,
        JUMP_FORCE: 7,
        SPRINT_MULTIPLIER: 1.6,
        REACH_DISTANCE: 6
    },
    
    // Chunk settings
    CHUNK: {
        SIZE: 16,
        HEIGHT: 16,
        LOAD_RADIUS: 4,
        UNLOAD_RADIUS: 5
    },
    
    // Block settings
    BLOCKS: {
        HOTBAR_SLOTS: 6,
        DEFAULT_SELECTION: 1 // Dirt
    },
    
    // Lighting settings
    LIGHTING: {
        AMBIENT_INTENSITY: 0.6,
        DIRECTIONAL_INTENSITY: 0.8,
        SUN_POSITION: { x: 100, y: 100, z: 50 }
    },
    
    // Performance settings
    PERFORMANCE: {
        MAX_DELTA_TIME: 0.1, // Cap delta time to prevent spiral of death
        RAYCAST_FACES: true // Whether to check face visibility when building meshes
    }
};

// Freeze the config to prevent accidental modifications
Object.freeze(GameConfig.DISPLAY);
Object.freeze(GameConfig.PHYSICS);
Object.freeze(GameConfig.PLAYER);
Object.freeze(GameConfig.CHUNK);
Object.freeze(GameConfig.BLOCKS);
Object.freeze(GameConfig.LIGHTING);
Object.freeze(GameConfig.PERFORMANCE);
Object.freeze(GameConfig);

export { GameConfig };
