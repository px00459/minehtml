import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PhysicsManager } from '../core/PhysicsManager.js';

/**
 * Player - SceneSubject that handles player movement and interaction
 * Uses Cannon.js capsule collider for smooth physics
 */
class Player {
    constructor(scene, camera, eventBus) {
        this.scene = scene;
        this.camera = camera;
        this.eventBus = eventBus;
        
        // Input state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isSprinting = false;
        
        // Movement settings
        this.moveSpeed = 8;
        this.jumpForce = 7;
        this.sprintMultiplier = 1.6;
        
        // Physics body (capsule)
        this.physicsManager = new PhysicsManager();
        this.createPhysicsBody();
        
        // Three.js mesh for visualization
        this.createMesh();
        
        // Controls
        this.controls = new PointerLockControls(this.camera, document.body);
        this.scene.add(this.controls.getObject());
        
        // Sync initial position
        this.syncPosition();
        
        // Setup input listeners
        this.setupInputListeners();
        
        // Subscribe to events
        this.eventBus.on('hotbar:changed', this.onHotbarChanged.bind(this));
        
        // Mouse click handling for block interaction
        this.setupInteraction();
        
        // Grounded state
        this.grounded = false;
    }
    
    /**
     * Create Cannon.js capsule body for player
     */
    createPhysicsBody() {
        const radius = 0.4;
        const height = 1.8;
        
        // Create capsule shape
        const capsuleShape = new CANNON.Cylinder(radius, radius, height, 8);
        
        // Rotate capsule to stand upright (Cannon cylinders are Z-aligned by default)
        const quaternion = new CANNON.Quaternion();
        quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        capsuleShape.transform(quaternion, new CANNON.Vec3(0, 0, 0));
        
        // Create body
        this.body = new CANNON.Body({
            mass: 70, // kg
            material: this.physicsManager.defaultMaterial,
            linearDamping: 0.9,
            angularDamping: 1.0,
            fixedRotation: true
        });
        
        this.body.addShape(capsuleShape);
        this.body.position.set(0, 20, 0); // Start above terrain
        
        this.physicsManager.addBody(this.body);
    }
    
    /**
     * Create Three.js mesh for player visualization
     */
    createMesh() {
        // Simple capsule geometry for player body
        const geometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
        const material = new THREE.MeshLambertMaterial({ color: 0xff6347 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.visible = false; // Hide self model (first-person view)
        this.scene.add(this.mesh);
    }
    
    /**
     * Setup keyboard input listeners
     */
    setupInputListeners() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'KeyD':
                    this.moveRight = true;
                    break;
                case 'Space':
                    if (this.grounded && this.canJump) {
                        this.jump();
                    }
                    break;
                case 'ShiftLeft':
                    this.isSprinting = true;
                    break;
            }
        };
        
        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'KeyD':
                    this.moveRight = false;
                    break;
                case 'ShiftLeft':
                    this.isSprinting = false;
                    break;
            }
        };
        
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }
    
    /**
     * Setup mouse interaction for block placement/breaking
     */
    setupInteraction() {
        // Get world reference through event bus
        document.addEventListener('mousedown', (event) => {
            if (!this.controls.isLocked) return;
            
            // Emit event for world to handle block interaction
            if (event.button === 0) {
                // Left click - break block
                this.eventBus.emit('player:blockBreak', {
                    camera: this.camera
                });
            } else if (event.button === 2) {
                // Right click - place block
                this.eventBus.emit('player:blockPlace', {
                    camera: this.camera
                });
            }
        });
        
        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    
    /**
     * Handle hotbar change event
     */
    onHotbarChanged(data) {
        // Forward to world for block type selection
        this.eventBus.emit('player:blockSelected', { slot: data.slot });
    }
    
    /**
     * Jump action
     */
    jump() {
        this.body.velocity.y = this.jumpForce;
        this.grounded = false;
        this.canJump = false;
    }
    
    /**
     * Sync Three.js mesh position with physics body
     */
    syncPosition() {
        if (this.mesh && this.body) {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
        }
        
        // Sync camera position (attached to controls)
        if (this.controls && this.body) {
            const controlsObj = this.controls.getObject();
            controlsObj.position.set(
                this.body.position.x,
                this.body.position.y + 0.5, // Eye height
                this.body.position.z
            );
        }
    }
    
    /**
     * Check if player is grounded
     */
    checkGrounded() {
        // Raycast down from player position to check if grounded
        const rayFrom = new CANNON.Vec3(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
        const rayTo = new CANNON.Vec3(
            this.body.position.x,
            this.body.position.y - 1.0,
            this.body.position.z
        );
        
        const hit = this.physicsManager.raycast(rayFrom, rayTo);
        this.grounded = hit !== null && hit.distance < 0.1;
        this.canJump = this.grounded;
    }
    
    /**
     * Apply movement based on input
     */
    applyMovement(deltaTime) {
        if (!this.controls.isLocked) return;
        
        // Get camera direction (ignoring Y for horizontal movement)
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
        
        // Calculate movement direction
        const moveDir = new THREE.Vector3(0, 0, 0);
        
        if (this.moveForward) moveDir.add(direction);
        if (this.moveBackward) moveDir.sub(direction);
        if (this.moveLeft) moveDir.sub(right);
        if (this.moveRight) moveDir.add(right);
        
        if (moveDir.length() > 0) {
            moveDir.normalize();
            
            // Apply velocity
            const speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1);
            this.body.velocity.x = moveDir.x * speed;
            this.body.velocity.z = moveDir.z * speed;
        } else {
            // Slow down when not moving
            this.body.velocity.x *= 0.8;
            this.body.velocity.z *= 0.8;
        }
    }
    
    /**
     * Update method called by SceneManager each frame
     */
    update(deltaTime) {
        // Step physics
        this.physicsManager.step(deltaTime);
        
        // Apply movement
        this.applyMovement(deltaTime);
        
        // Check if grounded
        this.checkGrounded();
        
        // Sync position
        this.syncPosition();
        
        // Emit player moved event
        this.eventBus.emit('player:moved', {
            position: {
                x: this.body.position.x,
                y: this.body.position.y,
                z: this.body.position.z
            }
        });
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        this.physicsManager.clear();
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.controls.dispose();
    }
}

export { Player };
