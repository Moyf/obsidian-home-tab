import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/utils/particleEngine.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
const sandbox = { module: { exports: {} }, window: {} };
vm.runInNewContext(code, sandbox);
const { ParticleWordmarkEngine } = sandbox.module.exports;

// Exercise the real sampler with a transparent background and an opaque glyph.
const width = 337;
const height = 181;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 36; y < 147; y++) {
    for (let x = 75; x < 264; x++) {
        if (x >= 114 && x < 225 && (y < 81 || y >= 102)) continue;
        data.set([35, 100, 220, 255], (y * width + x) * 4);
    }
}

let cases = 0;
for (const scale of [2, 2.1, 2.25, 2.5, 2.75, 3]) {
    for (const spacing of [2, 3.5, 4.5, 5, 7.5, 10]) {
        for (const monochrome of [false, true]) {
            const engine = new ParticleWordmarkEngine({}, {
                monochrome, color: '#31e0e3', zoom: 2, spacing,
                dotSize: 1.3, repulsionRadius: 84, repulsionStrength: 0.8,
            });
            engine.scale = scale;
            const canvas = { width, height };
            const sample = pixels => engine.sampleParticles(canvas, { getImageData: () => ({ data: pixels }) });
            assert.equal(sample(new Uint8ClampedArray(data.length)).length, 0,
                `Transparent canvas generated particles at scale=${scale}, spacing=${spacing}`);
            const particles = sample(data);
            assert.ok(particles.length > 0);
            for (const particle of particles) {
                // Compare against the nearest lattice position to avoid inverse-transform rounding.
                const step = spacing * scale;
                const start = Math.floor(step / 2);
                const lattice = value => start + Math.round((value * scale / 2 - start) / step) * step;
                const x = Math.floor(lattice(particle.hx) + 1e-9);
                const y = Math.floor(lattice(particle.hy) + 1e-9);
                assert.equal(data[(y * width + x) * 4 + 3], 255);
                assert.match(particle.fill, /^rgb\(\d+, \d+, \d+\)$/);
                if (!monochrome) assert.equal(particle.fill, 'rgb(35, 100, 220)');
            }
            cases++;
        }
    }
}
console.log(`Particle sampling passed: ${cases} scale/spacing/color combinations.`);
