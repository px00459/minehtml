import * as THREE from 'three';
import { GameConfig } from '../core/GameConfig.js';

/**
 * SceneManager - Central orchestrator for Three.js scene management
 * Manages scene, camera, renderer, and SceneSubjects
 */
class SceneManager {
    constructor(canvas, eventBus) {
        this.canvas = canvas;
        this.eventBus = eventBus;
        
        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(GameConfig.DISPLAY.SKY_COLOR);
        this.scene.fog = new THREE.Fog(
            GameConfig.DISPLAY.SKY_COLOR,
            GameConfig.DISPLAY.FOG_START,
            GameConfig.DISPLAY.FOG_END
        );
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            GameConfig.DISPLAY.FOV,
            window.innerWidth / window.innerHeight,
            GameConfig.DISPLAY.NEAR_PLANE,
            GameConfig.DISPLAY.FAR_PLANE
        );
        this.camera.position.set(0, 30, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, GameConfig.DISPLAY.PIXEL_RATIO_MAX));
        
        // Lighting
        this.setupLighting();
        
        // SceneSubjects list
        this.subjects = [];
        
        // Animation state
        this.isRunning = false;
        this.lastTime = 0;
        
        // Handle window resize
        this.onWindowResize = this.onWindowResize.bind(this);
    }
    
    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(
            0xffffff,
            GameConfig.LIGHTING.AMBIENT_INTENSITY
        );
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(
            0xffffff,
            GameConfig.LIGHTING.DIRECTIONAL_INTENSITY
        );
        directionalLight.position.set(
            GameConfig.LIGHTING.SUN_POSITION.x,
            GameConfig.LIGHTING.SUN_POSITION.y,
            GameConfig.LIGHTING.SUN_POSITION.z
        );
        this.scene.add(directionalLight);
    }
    
    /**
     * Add a SceneSubject to be updated each frame
     * @param {Object} subject - Object with update(deltaTime) method
     */
    addSubject(subject) {
        this.subjects.push(subject);
    }
    
    /**
     * Remove a SceneSubject and cleanup its resources
     * @param {Object} subject - Subject to remove
     */
    removeSubject(subject) {
        const index = this.subjects.indexOf(subject);
        if (index > -1) {
            // Cleanup subject resources if it has dispose method
            if (subject.dispose) {
                subject.dispose();
            }
            this.subjects.splice(index, 1);
        }
    }
    
    /**
     * Handle window resize
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Stop the animation loop and cleanup resources
     */
    dispose() {
        this.stop();
        
        // Remove all subjects
        for (const subject of [...this.subjects]) {
            if (subject.dispose) {
                subject.dispose();
            }
        }
        this.subjects = [];
        
        // Dispose renderer
        this.renderer.dispose();
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
    }

    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animate();
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        this.isRunning = false;
    }
    
    /**
     * Animation loop
     */
    animate() {
        if (!this.isRunning) return;
        
        requestAnimationFrame(() => this.animate());
        
        const currentTime = performance.now();
        const deltaTime = Math.min(
            (currentTime - this.lastTime) / 1000,
            GameConfig.PERFORMANCE.MAX_DELTA_TIME
        );
        this.lastTime = currentTime;
        
        // Update all subjects
        for (const subject of this.subjects) {
            if (subject.update) {
                try {
                    subject.update(deltaTime);
                } catch (error) {
                    console.error('Error updating subject:', error);
                }
            }
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

export { SceneManager };
