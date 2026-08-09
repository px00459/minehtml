/**
 * Simple 2D value noise for terrain generation
 * Fast and deterministic - same seed always produces same terrain
 */
class Noise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.permutation = this.generatePermutation(seed);
    }
    
    /**
     * Generate permutation table for deterministic noise
     * @param {number} seed - Random seed
     * @returns {Uint8Array} Permutation table
     */
    generatePermutation(seed) {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Shuffle using seed
        let s = seed * 2147483647;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        // Duplicate for overflow handling
        const perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            perm[i] = p[i & 255];
        }
        
        return perm;
    }
    
    /**
     * Fade function for smooth interpolation
     * @param {number} t - Input value
     * @returns {number} Smoothed value
     */
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    /**
     * Linear interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    /**
     * Grad function for 2D noise
     * @param {number} hash - Hash value
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Gradient value
     */
    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    /**
     * Get 2D noise value at coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} scale - Scale factor (higher = more zoomed in)
     * @returns {number} Noise value (-1 to 1)
     */
    noise2D(x, y, scale = 1) {
        x *= scale;
        y *= scale;
        
        // Grid cell coordinates
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Relative position within cell
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Fade curves for x and y
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash the grid coordinates
        const A = this.permutation[X] + Y;
        const B = this.permutation[X + 1] + Y;
        
        // Calculate noise values at corners
        const gAA = this.grad(this.permutation[A], x, y);
        const gBA = this.grad(this.permutation[B], x - 1, y);
        const gAB = this.grad(this.permutation[A + 1], x, y - 1);
        const gBB = this.grad(this.permutation[B + 1], x - 1, y - 1);
        
        // Interpolate
        const x1 = this.lerp(gAA, gBA, u);
        const x2 = this.lerp(gAB, gBB, u);
        
        return this.lerp(x1, x2, v);
    }
    
    /**
     * Get layered noise (octaves) for more natural terrain
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} octaves - Number of noise layers
     * @param {number} persistence - Amplitude decrease per octave
     * @param {number} lacunarity - Frequency increase per octave
     * @param {number} baseScale - Base scale factor
     * @returns {number} Layered noise value (0 to 1)
     */
    layeredNoise(x, y, octaves = 4, persistence = 0.5, lacunarity = 2, baseScale = 0.02) {
        let total = 0;
        let frequency = baseScale;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x, y, frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        // Normalize to 0-1 range
        return (total / maxValue + 1) / 2;
    }
}

export { Noise };
