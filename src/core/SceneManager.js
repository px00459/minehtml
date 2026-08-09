import * as THREE from 'three';

/**
 * SceneManager - Central orchestrator for Three.js scene management
 * Manages scene, camera, renderer, and SceneSubjects
 */
class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 150); // Linear fog to hide chunk pop-in
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near plane
            1000 // Far plane
        );
        this.camera.position.set(0, 30, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
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
     * Remove a SceneSubject
     * @param {Object} subject - Subject to remove
     */
    removeSubject(subject) {
        const index = this.subjects.indexOf(subject);
        if (index > -1) {
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
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
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
