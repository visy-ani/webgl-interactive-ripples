import * as THREE from "three";
import { GUI } from "dat.gui";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";
import "./style.css";

interface RippleParams {
  color1: string;
  color2: string;
  backgroundColor: string;
  pixelSize: number;
  waveSpeed: number;
  waveThickness: number;
  timeDecay: number;
  distanceDecay: number;
  bloomStrength: number;
  animatedBackground: boolean;
  maxRipples: number;
}

class EnhancedInteractiveRipples {
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private material!: THREE.ShaderMaterial;
  private clock!: THREE.Clock;
  private canvas!: HTMLCanvasElement;
  private gui: GUI | null = null;

  // Performance tracking
  private frameCount = 0;
  private lastTime = 0;
  private fps = 60;

  // Ripple management
  private clickIndex = 0;
  private activeRipples = 0;
  private readonly MAX_CLICKS = 16;

  // Parameters
  private params: RippleParams = {
    color1: "#00aaff",
    color2: "#ffffff",
    backgroundColor: "#001122",
    pixelSize: 4.0,
    waveSpeed: 0.35,
    waveThickness: 0.12,
    timeDecay: 0.8,
    distanceDecay: 1.2,
    bloomStrength: 0.3,
    animatedBackground: true,
    maxRipples: 16,
  };

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
    uColor1: { value: new THREE.Color(this.params.color1) },
    uColor2: { value: new THREE.Color(this.params.color2) },
    uBackgroundColor: { value: new THREE.Color(this.params.backgroundColor) },
    uPixelSize: { value: this.params.pixelSize },
    uWaveSpeed: { value: this.params.waveSpeed },
    uWaveThickness: { value: this.params.waveThickness },
    uTimeDecay: { value: this.params.timeDecay },
    uDistanceDecay: { value: this.params.distanceDecay },
    uBloomStrength: { value: this.params.bloomStrength },
    uAnimatedBackground: { value: this.params.animatedBackground },
  };

  constructor(containerId: string) {
    this.initThreeJS(containerId);
    this.setupEventListeners();
    this.setupGUI();
    this.resize();
    this.animate();

    console.log("🌊 Enhanced Interactive Ripples initialized!");
  }

  private initThreeJS(containerId: string): void {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2");

    if (!gl) {
      throw new Error("WebGL2 not supported");
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: gl,
      antialias: true,
      alpha: true,
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

    // Enhanced material setup
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL3,
      transparent: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(quad);
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.handlePointerEvent(e);
    });

    // Touch support for mobile
    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        for (let touch of e.changedTouches) {
          this.handleTouch(touch);
        }
      },
      { passive: false }
    );

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "KeyC":
          this.toggleGUI();
          break;
        case "KeyR":
          this.clearAllRipples();
          break;
        case "Space":
          e.preventDefault();
          this.addRandomRipple();
          break;
      }
    });

    let resizeTimeout: number;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.resize(), 100);
    });
  }

  private handlePointerEvent(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * this.canvas.width) / rect.width;
    const y =
      ((rect.height - (e.clientY - rect.top)) * this.canvas.height) /
      rect.height;
    this.addRipple(x, y);
  }

  private handleTouch(touch: Touch): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) * this.canvas.width) / rect.width;
    const y =
      ((rect.height - (touch.clientY - rect.top)) * this.canvas.height) /
      rect.height;
    this.addRipple(x, y);
  }

  private setupGUI(): void {
    this.gui = new GUI({ width: 300 });
    this.gui.domElement.style.zIndex = "1000";

    // Colors folder
    const colorsFolder = this.gui.addFolder("Colors");
    colorsFolder.addColor(this.params, "color1").onChange((value) => {
      this.uniforms.uColor1.value.set(value);
    });
    colorsFolder.addColor(this.params, "color2").onChange((value) => {
      this.uniforms.uColor2.value.set(value);
    });
    colorsFolder.addColor(this.params, "backgroundColor").onChange((value) => {
      this.uniforms.uBackgroundColor.value.set(value);
    });
    colorsFolder.open();

    // Physics folder
    const physicsFolder = this.gui.addFolder("Wave Physics");
    physicsFolder
      .add(this.params, "waveSpeed", 0.1, 1.0, 0.01)
      .onChange((value) => {
        this.uniforms.uWaveSpeed.value = value;
      });
    physicsFolder
      .add(this.params, "waveThickness", 0.05, 0.5, 0.01)
      .onChange((value) => {
        this.uniforms.uWaveThickness.value = value;
      });
    physicsFolder
      .add(this.params, "timeDecay", 0.1, 3.0, 0.1)
      .onChange((value) => {
        this.uniforms.uTimeDecay.value = value;
      });
    physicsFolder
      .add(this.params, "distanceDecay", 0.1, 3.0, 0.1)
      .onChange((value) => {
        this.uniforms.uDistanceDecay.value = value;
      });

    // Visual effects folder
    const effectsFolder = this.gui.addFolder("Visual Effects");
    effectsFolder
      .add(this.params, "pixelSize", 1.0, 10.0, 0.5)
      .onChange((value) => {
        this.uniforms.uPixelSize.value = value;
      });
    effectsFolder
      .add(this.params, "bloomStrength", 0.0, 1.0, 0.01)
      .onChange((value) => {
        this.uniforms.uBloomStrength.value = value;
      });
    effectsFolder.add(this.params, "animatedBackground").onChange((value) => {
      this.uniforms.uAnimatedBackground.value = value;
    });

    // Controls folder
    const controlsFolder = this.gui.addFolder("Controls");
    controlsFolder.add(
      { "Clear Ripples": () => this.clearAllRipples() },
      "Clear Ripples"
    );
    controlsFolder.add(
      { "Random Ripple": () => this.addRandomRipple() },
      "Random Ripple"
    );
    controlsFolder.add(
      { "Export Settings": () => this.exportSettings() },
      "Export Settings"
    );

    this.gui.hide();
  }

  private addRipple(x: number, y: number): void {
    if (this.activeRipples >= this.params.maxRipples) {
      this.uniforms.uClickPos.value[this.clickIndex].set(-1, -1);
      this.activeRipples--;
    }

    this.uniforms.uClickPos.value[this.clickIndex].set(x, y);
    this.uniforms.uClickTimes.value[this.clickIndex] =
      this.uniforms.uTime.value;
    this.clickIndex = (this.clickIndex + 1) % this.MAX_CLICKS;
    this.activeRipples++;

    this.updateRippleCounter();
  }

  private addRandomRipple(): void {
    const x = Math.random() * this.canvas.width;
    const y = Math.random() * this.canvas.height;
    this.addRipple(x, y);
  }

  private clearAllRipples(): void {
    this.uniforms.uClickPos.value.forEach((pos) => pos.set(-1, -1));
    this.uniforms.uClickTimes.value.fill(0);
    this.activeRipples = 0;
    this.clickIndex = 0;
    this.updateRippleCounter();
  }

  private toggleGUI(): void {
    if (this.gui) {
      if (this.gui.domElement.style.display === "none") {
        this.gui.show();
      } else {
        this.gui.hide();
      }
    }
  }

  private exportSettings(): void {
    const settings = JSON.stringify(this.params, null, 2);
    console.log("Current settings:", settings);

    const blob = new Blob([settings], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ripple-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setSize(width, height, false);
    this.uniforms.uResolution.value.set(width, height);
  }

  private updatePerformanceStats(): void {
    this.frameCount++;
    const currentTime = performance.now();

    if (currentTime - this.lastTime >= 1000) {
      this.fps = Math.round(
        (this.frameCount * 1000) / (currentTime - this.lastTime)
      );
      this.frameCount = 0;
      this.lastTime = currentTime;

      const fpsElement = document.getElementById("fps-counter");
      if (fpsElement) {
        fpsElement.textContent = this.fps.toString();
        fpsElement.style.color = this.fps < 50 ? "#ff4444" : "#44ff44";
      }
    }
  }

  private updateRippleCounter(): void {
    const counterElement = document.getElementById("ripple-counter");
    if (counterElement) {
      counterElement.textContent = this.activeRipples.toString();
    }
  }

  private animate = (): void => {
    this.uniforms.uTime.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
    this.updatePerformanceStats();
    requestAnimationFrame(this.animate);
  };

  public destroy(): void {
    if (this.gui) {
      this.gui.destroy();
    }
    this.renderer.dispose();
    this.material.dispose();
  }

  public preset(name: "ocean" | "fire" | "electric" | "pastel"): void {
    const presets = {
      ocean: {
        color1: "#004080",
        color2: "#40a0ff",
        backgroundColor: "#001020",
        waveSpeed: 0.25,
        bloomStrength: 0.4,
      },
      fire: {
        color1: "#ff4000",
        color2: "#ffff00",
        backgroundColor: "#200000",
        waveSpeed: 0.5,
        bloomStrength: 0.6,
      },
      electric: {
        color1: "#8000ff",
        color2: "#00ffff",
        backgroundColor: "#000010",
        waveSpeed: 0.4,
        bloomStrength: 0.8,
      },
      pastel: {
        color1: "#ffb3d1",
        color2: "#b3d1ff",
        backgroundColor: "#f0f0f0",
        waveSpeed: 0.2,
        bloomStrength: 0.2,
      },
    };

    const preset = presets[name];
    Object.assign(this.params, preset);

    this.uniforms.uColor1.value.set(preset.color1);
    this.uniforms.uColor2.value.set(preset.color2);
    this.uniforms.uBackgroundColor.value.set(preset.backgroundColor);
    this.uniforms.uWaveSpeed.value = preset.waveSpeed;
    this.uniforms.uBloomStrength.value = preset.bloomStrength;

    if (this.gui) {
      this.gui.updateDisplay();
    }
  }
}

const app = new EnhancedInteractiveRipples("hero-bg");

(window as any).ripples = app;
