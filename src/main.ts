import * as THREE from "three";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";
import "./style.css";

class InteractiveRipples {
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private material!: THREE.ShaderMaterial;
  private clock!: THREE.Clock;
  private canvas!: HTMLCanvasElement;
  private clickIndex = 0;

  private readonly MAX_CLICKS = 10;

  private uniforms = {
    uResolution: { value: new THREE.Vector2() },
    uClickPos: {
      value: Array.from(
        { length: this.MAX_CLICKS },
        () => new THREE.Vector2(-1, -1)
      ),
    },
    uClickTimes: { value: new Float32Array(this.MAX_CLICKS) },
    uTime: { value: 0 },
  };

  constructor(containerId: string) {
    this.initThreeJS(containerId);
    this.setupEventListeners();
    this.resize();
    this.animate();
  }

  private initThreeJS(containerId: string): void {
    // Create canvas and WebGL2 context
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2");

    if (!gl) {
      throw new Error("WebGL2 not supported");
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: gl,
      antialias: true,
    });

    // Append to container
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    container.appendChild(this.canvas);

    // Scene setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.clock = new THREE.Clock();

    // Material setup
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
    });

    // Full-screen quad
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(quad);
  }

  private setupEventListeners(): void {
    // Click/touch handler with Hi-DPI support
    this.canvas.addEventListener("pointerdown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Convert to framebuffer pixels
      const fragX = (cssX * this.canvas.width) / rect.width;
      const fragY = ((rect.height - cssY) * this.canvas.height) / rect.height;

      this.addRipple(fragX, fragY);
    });

    // Resize handler
    window.addEventListener("resize", () => this.resize());
  }

  private addRipple(x: number, y: number): void {
    this.uniforms.uClickPos.value[this.clickIndex].set(x, y);
    this.uniforms.uClickTimes.value[this.clickIndex] =
      this.uniforms.uTime.value;
    this.clickIndex = (this.clickIndex + 1) % this.MAX_CLICKS;
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setSize(width, height, false);
    this.uniforms.uResolution.value.set(width, height);
  }

  private animate = (): void => {
    this.uniforms.uTime.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  };

  // Public API for customization
  public setWaveSpeed(speed: number): void {
    // You can extend this to pass speed as a uniform
    console.log(`Setting wave speed to: ${speed}`);
  }

  public clearRipples(): void {
    this.uniforms.uClickPos.value.forEach((pos) => pos.set(-1, -1));
    this.uniforms.uClickTimes.value.fill(0);
  }
}

// Initialize the application
const app = new InteractiveRipples("hero-bg");

// Optional: expose to global scope for debugging
(window as any).ripples = app;
