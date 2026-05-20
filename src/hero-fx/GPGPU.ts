import * as THREE from 'three';
import { GPUComputationRenderer, Variable } from 'three/addons/misc/GPUComputationRenderer.js';
import gpgpuShader from './shaders/gpgpu.glsl';

const RELAXATION = 0.965;
const GRID_PARTICLE_COUNT = 700;
const DISTANCE = 0.6;
const STRENGTH = 0.8;

export class GPGPU {
  private gpgpuRenderer: GPUComputationRenderer;
  private variable: Variable;
  private size: number;
  private _delta = new THREE.Vector2();

  constructor(renderer: THREE.WebGLRenderer) {
    this.size = Math.ceil(Math.sqrt(GRID_PARTICLE_COUNT));

    this.gpgpuRenderer = new GPUComputationRenderer(this.size, this.size, renderer);
    const dataTexture = this.gpgpuRenderer.createTexture();

    this.variable = this.gpgpuRenderer.addVariable('uGrid', gpgpuShader, dataTexture);
    this.variable.material.uniforms['uTime'] = new THREE.Uniform(0);
    this.variable.material.uniforms['uRelaxation'] = new THREE.Uniform(RELAXATION);
    this.variable.material.uniforms['uGridSize'] = new THREE.Uniform(this.size);
    this.variable.material.uniforms['uMouse'] = new THREE.Uniform(new THREE.Vector2(0, 0));
    this.variable.material.uniforms['uDeltaMouse'] = new THREE.Uniform(new THREE.Vector2(0, 0));
    this.variable.material.uniforms['uMouseMove'] = new THREE.Uniform(0);
    this.variable.material.uniforms['uDistance'] = new THREE.Uniform(DISTANCE * 10);

    this.gpgpuRenderer.setVariableDependencies(this.variable, [this.variable]);
    this.gpgpuRenderer.init();
  }

  updateMouse(uv: THREE.Vector2): void {
    this.variable.material.uniforms['uMouseMove'].value = 1;
    const current = this.variable.material.uniforms['uMouse'].value as THREE.Vector2;
    this._delta.subVectors(uv, current).multiplyScalar(STRENGTH * 100);
    (this.variable.material.uniforms['uDeltaMouse'].value as THREE.Vector2).copy(this._delta);
    (this.variable.material.uniforms['uMouse'].value as THREE.Vector2).copy(uv);
  }

  render(time: number): void {
    this.variable.material.uniforms['uTime'].value = time;
    this.variable.material.uniforms['uMouseMove'].value *= 0.95;
    (this.variable.material.uniforms['uDeltaMouse'].value as THREE.Vector2).multiplyScalar(RELAXATION);
    this.gpgpuRenderer.compute();
  }

  getTexture(): THREE.Texture {
    const rt = this.gpgpuRenderer.getCurrentRenderTarget(this.variable) as THREE.WebGLRenderTarget & {
      textures?: THREE.Texture[];
    };
    return (rt.textures && rt.textures[0]) ?? rt.texture;
  }

  dispose(): void {
    const rt = this.gpgpuRenderer.getCurrentRenderTarget(this.variable);
    rt.dispose();
  }
}
