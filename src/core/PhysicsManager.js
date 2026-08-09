import * as CANNON from 'cannon-es';

/**
 * PhysicsManager - Wrapper for Cannon.js physics world
 * Manages physics bodies and handles fixed timestep updates
 */
class PhysicsManager {
    constructor() {
        // Create physics world with gravity
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        
        // Physics materials
        this.defaultMaterial = new CANNON.Material('default');
        
        // Contact behavior
        const defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.3,
                restitution: 0.1
            }
        );
        this.world.addContactMaterial(defaultContactMaterial);
        
        // Bodies list
        this.bodies = [];
        
        // Fixed timestep for deterministic physics
        this.fixedTimeStep = 1 / 60;
    }
    
    /**
     * Add a body to the physics world
     * @param {CANNON.Body} body - Physics body to add
     */
    addBody(body) {
        this.world.addBody(body);
        this.bodies.push(body);
    }
    
    /**
     * Remove a body from the physics world
     * @param {CANNON.Body} body - Physics body to remove
     */
    removeBody(body) {
        this.world.removeBody(body);
        const index = this.bodies.indexOf(body);
        if (index > -1) {
            this.bodies.splice(index, 1);
        }
    }
    
    /**
     * Step the physics simulation forward
     * Uses fixed timestep for deterministic behavior
     * @param {number} deltaTime - Time since last update in seconds
     */
    step(deltaTime) {
        this.world.step(this.fixedTimeStep, deltaTime, 3);
    }
    
    /**
     * Raycast against all bodies
     * @param {CANNON.Vec3} from - Start position
     * @param {CANNON.Vec3} to - End position
     * @returns {Object|null} Hit result or null
     */
    raycast(from, to) {
        const rayFrom = new CANNON.Vec3(...from);
        const rayTo = new CANNON.Vec3(...to);
        
        const result = new CANNON.RaycastResult();
        result.shouldSkipBackface = true;
        
        const hit = this.world.raycastClosest(rayFrom, rayTo, {}, result);
        
        if (hit) {
            return {
                point: result.hitPointWorld,
                normal: result.hitNormalWorld,
                body: result.body,
                distance: result.distance
            };
        }
        
        return null;
    }
    
    /**
     * Clear all bodies from the physics world
     */
    clear() {
        for (const body of [...this.bodies]) {
            this.removeBody(body);
        }
    }
}

export { PhysicsManager };
