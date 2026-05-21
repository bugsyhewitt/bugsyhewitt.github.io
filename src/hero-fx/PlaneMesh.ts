import * as THREE from 'three';
import vertexShader from './shaders/plane.vert.glsl';
import fragmentShader from './shaders/plane.frag.glsl';

export class PlaneMesh {
  private scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    texture: THREE.Texture,
    imageWidth: number,
    imageHeight: number,
    canvasWidth: number,
    canvasHeight: number
  ) {
    this.scene = scene;

    /* Orthographic camera with (-0.5,0.5) bounds — a PlaneGeometry(1,1) at z=0
       exactly fills the view when camera is at z=1. */
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.001, 10);
    this.camera.position.z = 1;

    /* Plane is 88% of camera width — matches CSS background-size start (88%).
       The 6% strips on each side show the renderer clear colour (paper),
       giving wing tips breathing room and making WebGL → CSS handoff seamless. */
    this.geometry = new THREE.PlaneGeometry(0.88, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: new THREE.Uniform(texture),
        uGrid: new THREE.Uniform(null as unknown as THREE.Texture),
        uContainerResolution: new THREE.Uniform(new THREE.Vector2(canvasWidth * 0.88, canvasHeight)),
        uImageResolution: new THREE.Uniform(new THREE.Vector2(imageWidth, imageHeight)),
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  setGridTexture(texture: THREE.Texture): void {
    this.material.uniforms['uGrid'].value = texture;
  }

  onResize(canvasWidth: number, canvasHeight: number): void {
    this.material.uniforms['uContainerResolution'].value.set(canvasWidth * 0.88, canvasHeight);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
