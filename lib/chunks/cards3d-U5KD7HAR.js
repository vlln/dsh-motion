import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AgXToneMapping,
  BufferGeometry,
  CanvasTexture,
  CineonToneMapping,
  CircleGeometry,
  Color,
  ColorManagement,
  CustomToneMapping,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HalfFloatType,
  HemisphereLight,
  LinearToneMapping,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoBlending,
  OrthographicCamera,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RawShaderMaterial,
  ReinhardToneMapping,
  SRGBColorSpace,
  SRGBTransfer,
  Scene,
  ShaderMaterial,
  Shape,
  Timer,
  TorusGeometry,
  UniformsUtils,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer
} from "./chunk-TIKGRATT.js";
import "./chunk-WSFCRVEQ.js";

// node_modules/three/examples/jsm/shaders/CopyShader.js
var CopyShader = {
  name: "CopyShader",
  uniforms: {
    "tDiffuse": { value: null },
    "opacity": { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`
  )
};

// node_modules/three/examples/jsm/postprocessing/Pass.js
var Pass = class {
  /**
   * Constructs a new pass.
   */
  constructor() {
    this.isPass = true;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;
  }
  /**
   * Sets the size of the pass.
   *
   * @abstract
   * @param {number} width - The width to set.
   * @param {number} height - The height to set.
   */
  setSize() {
  }
  /**
   * This method holds the render logic of a pass. It must be implemented in all derived classes.
   *
   * @abstract
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render() {
    console.error("THREE.Pass: .render() must be implemented in derived pass.");
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   *
   * @abstract
   */
  dispose() {
  }
};
var _camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
var FullscreenTriangleGeometry = class extends BufferGeometry {
  constructor() {
    super();
    this.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    this.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  }
};
var _geometry = new FullscreenTriangleGeometry();
var FullScreenQuad = class {
  /**
   * Constructs a new full screen quad.
   *
   * @param {?Material} material - The material to render te full screen quad with.
   */
  constructor(material) {
    this._mesh = new Mesh(_geometry, material);
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the instance is no longer used in your app.
   */
  dispose() {
    this._mesh.geometry.dispose();
  }
  /**
   * Renders the full screen quad.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   */
  render(renderer2) {
    renderer2.render(this._mesh, _camera);
  }
  /**
   * The quad's material.
   *
   * @type {?Material}
   */
  get material() {
    return this._mesh.material;
  }
  set material(value) {
    this._mesh.material = value;
  }
};

// node_modules/three/examples/jsm/postprocessing/ShaderPass.js
var ShaderPass = class extends Pass {
  /**
   * Constructs a new shader pass.
   *
   * @param {Object|ShaderMaterial} [shader] - A shader object holding vertex and fragment shader as well as
   * defines and uniforms. It's also valid to pass a custom shader material.
   * @param {string} [textureID='tDiffuse'] - The name of the texture uniform that should sample
   * the read buffer.
   */
  constructor(shader, textureID = "tDiffuse") {
    super();
    this.textureID = textureID;
    this.uniforms = null;
    this.material = null;
    if (shader instanceof ShaderMaterial) {
      this.uniforms = shader.uniforms;
      this.material = shader;
    } else if (shader) {
      this.uniforms = UniformsUtils.clone(shader.uniforms);
      this.material = new ShaderMaterial({
        name: shader.name !== void 0 ? shader.name : "unspecified",
        defines: Object.assign({}, shader.defines),
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
      });
    }
    this._fsQuad = new FullScreenQuad(this.material);
  }
  /**
   * Performs the shader pass.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2, writeBuffer, readBuffer) {
    if (this.uniforms[this.textureID]) {
      this.uniforms[this.textureID].value = readBuffer.texture;
    }
    this._fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer2.setRenderTarget(null);
      this._fsQuad.render(renderer2);
    } else {
      renderer2.setRenderTarget(writeBuffer);
      if (this.clear) renderer2.clear(renderer2.autoClearColor, renderer2.autoClearDepth, renderer2.autoClearStencil);
      this._fsQuad.render(renderer2);
    }
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose() {
    this.material.dispose();
    this._fsQuad.dispose();
  }
};

// node_modules/three/examples/jsm/postprocessing/MaskPass.js
var MaskPass = class extends Pass {
  /**
   * Constructs a new mask pass.
   *
   * @param {Scene} scene - The 3D objects in this scene will define the mask.
   * @param {Camera} camera - The camera.
   */
  constructor(scene2, camera2) {
    super();
    this.scene = scene2;
    this.camera = camera2;
    this.clear = true;
    this.needsSwap = false;
    this.inverse = false;
  }
  /**
   * Performs a mask pass with the configured scene and camera.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2, writeBuffer, readBuffer) {
    const context = renderer2.getContext();
    const state = renderer2.state;
    state.buffers.color.setMask(false);
    state.buffers.depth.setMask(false);
    state.buffers.color.setLocked(true);
    state.buffers.depth.setLocked(true);
    let writeValue, clearValue;
    if (this.inverse) {
      writeValue = 0;
      clearValue = 1;
    } else {
      writeValue = 1;
      clearValue = 0;
    }
    state.buffers.stencil.setTest(true);
    state.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE);
    state.buffers.stencil.setFunc(context.ALWAYS, writeValue, 4294967295);
    state.buffers.stencil.setClear(clearValue);
    state.buffers.stencil.setLocked(true);
    renderer2.setRenderTarget(readBuffer);
    if (this.clear) renderer2.clear();
    renderer2.render(this.scene, this.camera);
    renderer2.setRenderTarget(writeBuffer);
    if (this.clear) renderer2.clear();
    renderer2.render(this.scene, this.camera);
    state.buffers.color.setLocked(false);
    state.buffers.depth.setLocked(false);
    state.buffers.color.setMask(true);
    state.buffers.depth.setMask(true);
    state.buffers.stencil.setLocked(false);
    state.buffers.stencil.setFunc(context.EQUAL, 1, 4294967295);
    state.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP);
    state.buffers.stencil.setLocked(true);
  }
};
var ClearMaskPass = class extends Pass {
  /**
   * Constructs a new clear mask pass.
   */
  constructor() {
    super();
    this.needsSwap = false;
  }
  /**
   * Performs the clear of the currently defined mask.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2) {
    renderer2.state.buffers.stencil.setLocked(false);
    renderer2.state.buffers.stencil.setTest(false);
  }
};

// node_modules/three/examples/jsm/postprocessing/EffectComposer.js
var EffectComposer = class {
  /**
   * Constructs a new effect composer.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} [renderTarget] - This render target and a clone will
   * be used as the internal read and write buffers. If not given, the composer creates
   * the buffers automatically.
   */
  constructor(renderer2, renderTarget) {
    this.renderer = renderer2;
    this._pixelRatio = renderer2.getPixelRatio();
    if (renderTarget === void 0) {
      const size = renderer2.getSize(new Vector2());
      this._width = size.width;
      this._height = size.height;
      renderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, { type: HalfFloatType });
      renderTarget.texture.name = "EffectComposer.rt1";
    } else {
      this._width = renderTarget.width;
      this._height = renderTarget.height;
    }
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = "EffectComposer.rt2";
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
    this.renderToScreen = true;
    this.passes = [];
    this.copyPass = new ShaderPass(CopyShader);
    this.copyPass.material.blending = NoBlending;
    this.timer = new Timer();
  }
  /**
   * Swaps the internal read/write buffers.
   */
  swapBuffers() {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }
  /**
   * Adds the given pass to the pass chain.
   *
   * @param {Pass} pass - The pass to add.
   */
  addPass(pass) {
    this.passes.push(pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  /**
   * Inserts the given pass at a given index.
   *
   * @param {Pass} pass - The pass to insert.
   * @param {number} index - The index into the pass chain.
   */
  insertPass(pass, index) {
    this.passes.splice(index, 0, pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  /**
   * Removes the given pass from the pass chain.
   *
   * @param {Pass} pass - The pass to remove.
   */
  removePass(pass) {
    const index = this.passes.indexOf(pass);
    if (index !== -1) {
      this.passes.splice(index, 1);
    }
  }
  /**
   * Returns `true` if the pass for the given index is the last enabled pass in the pass chain.
   *
   * @param {number} passIndex - The pass index.
   * @return {boolean} Whether the pass for the given index is the last pass in the pass chain.
   */
  isLastEnabledPass(passIndex) {
    for (let i = passIndex + 1; i < this.passes.length; i++) {
      if (this.passes[i].enabled) {
        return false;
      }
    }
    return true;
  }
  /**
   * Executes all enabled post-processing passes in order to produce the final frame.
   *
   * @param {number} deltaTime - The delta time in seconds. If not given, the composer computes
   * its own time delta value.
   */
  render(deltaTime) {
    this.timer.update();
    if (deltaTime === void 0) {
      deltaTime = this.timer.getDelta();
    }
    const currentRenderTarget = this.renderer.getRenderTarget();
    let maskActive = false;
    for (let i = 0, il = this.passes.length; i < il; i++) {
      const pass = this.passes[i];
      if (pass.enabled === false) continue;
      pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass(i);
      pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);
      if (pass.needsSwap) {
        if (maskActive) {
          const context = this.renderer.getContext();
          const stencil = this.renderer.state.buffers.stencil;
          stencil.setFunc(context.NOTEQUAL, 1, 4294967295);
          this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime);
          stencil.setFunc(context.EQUAL, 1, 4294967295);
        }
        this.swapBuffers();
      }
      if (MaskPass !== void 0) {
        if (pass instanceof MaskPass) {
          maskActive = true;
        } else if (pass instanceof ClearMaskPass) {
          maskActive = false;
        }
      }
    }
    this.renderer.setRenderTarget(currentRenderTarget);
  }
  /**
   * Resets the internal state of the EffectComposer.
   *
   * @param {WebGLRenderTarget} [renderTarget] - This render target has the same purpose like
   * the one from the constructor. If set, it is used to setup the read and write buffers.
   */
  reset(renderTarget) {
    if (renderTarget === void 0) {
      const size = this.renderer.getSize(new Vector2());
      this._pixelRatio = this.renderer.getPixelRatio();
      this._width = size.width;
      this._height = size.height;
      renderTarget = this.renderTarget1.clone();
      renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }
  /**
   * Resizes the internal read and write buffers as well as all passes. Similar to {@link WebGLRenderer#setSize},
   * this method honors the current pixel ration.
   *
   * @param {number} width - The width in logical pixels.
   * @param {number} height - The height in logical pixels.
   */
  setSize(width, height) {
    this._width = width;
    this._height = height;
    const effectiveWidth = this._width * this._pixelRatio;
    const effectiveHeight = this._height * this._pixelRatio;
    this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
    this.renderTarget2.setSize(effectiveWidth, effectiveHeight);
    for (let i = 0; i < this.passes.length; i++) {
      this.passes[i].setSize(effectiveWidth, effectiveHeight);
    }
  }
  /**
   * Sets device pixel ratio. This is usually used for HiDPI device to prevent blurring output.
   * Setting the pixel ratio will automatically resize the composer.
   *
   * @param {number} pixelRatio - The pixel ratio to set.
   */
  setPixelRatio(pixelRatio) {
    this._pixelRatio = pixelRatio;
    this.setSize(this._width, this._height);
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the composer is no longer used in your app.
   */
  dispose() {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.copyPass.dispose();
  }
};

// node_modules/three/examples/jsm/postprocessing/RenderPass.js
var RenderPass = class extends Pass {
  /**
   * Constructs a new render pass.
   *
   * @param {Scene} scene - The scene to render.
   * @param {Camera} camera - The camera.
   * @param {?Material} [overrideMaterial=null] - The override material. If set, this material is used
   * for all objects in the scene.
   * @param {?(number|Color|string)} [clearColor=null] - The clear color of the render pass.
   * @param {?number} [clearAlpha=null] - The clear alpha of the render pass.
   */
  constructor(scene2, camera2, overrideMaterial = null, clearColor = null, clearAlpha = null) {
    super();
    this.scene = scene2;
    this.camera = camera2;
    this.overrideMaterial = overrideMaterial;
    this.clearColor = clearColor;
    this.clearAlpha = clearAlpha;
    this.clear = true;
    this.clearDepth = false;
    this.needsSwap = false;
    this.isRenderPass = true;
    this._oldClearColor = new Color();
  }
  /**
   * Performs a beauty pass with the configured scene and camera.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2, writeBuffer, readBuffer) {
    const oldAutoClear = renderer2.autoClear;
    renderer2.autoClear = false;
    let oldClearAlpha, oldOverrideMaterial;
    if (this.overrideMaterial !== null) {
      oldOverrideMaterial = this.scene.overrideMaterial;
      this.scene.overrideMaterial = this.overrideMaterial;
    }
    if (this.clearColor !== null) {
      renderer2.getClearColor(this._oldClearColor);
      renderer2.setClearColor(this.clearColor, renderer2.getClearAlpha());
    }
    if (this.clearAlpha !== null) {
      oldClearAlpha = renderer2.getClearAlpha();
      renderer2.setClearAlpha(this.clearAlpha);
    }
    if (this.clearDepth == true) {
      renderer2.clearDepth();
    }
    renderer2.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear === true) {
      renderer2.clear(renderer2.autoClearColor, renderer2.autoClearDepth, renderer2.autoClearStencil);
    }
    renderer2.render(this.scene, this.camera);
    if (this.clearColor !== null) {
      renderer2.setClearColor(this._oldClearColor);
    }
    if (this.clearAlpha !== null) {
      renderer2.setClearAlpha(oldClearAlpha);
    }
    if (this.overrideMaterial !== null) {
      this.scene.overrideMaterial = oldOverrideMaterial;
    }
    renderer2.autoClear = oldAutoClear;
  }
};

// node_modules/three/examples/jsm/shaders/LuminosityHighPassShader.js
var LuminosityHighPassShader = {
  name: "LuminosityHighPassShader",
  uniforms: {
    "tDiffuse": { value: null },
    "luminosityThreshold": { value: 1 },
    "smoothWidth": { value: 1 },
    "defaultColor": { value: new Color(0) },
    "defaultOpacity": { value: 0 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
  )
};

// node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js
var UnrealBloomPass = class _UnrealBloomPass extends Pass {
  /**
   * Constructs a new Unreal Bloom pass.
   *
   * @param {Vector2} [resolution] - The effect's resolution.
   * @param {number} [strength=1] - The Bloom strength.
   * @param {number} radius - The Bloom radius.
   * @param {number} threshold - The luminance threshold limits which bright areas contribute to the Bloom effect.
   */
  constructor(resolution, strength = 1, radius, threshold) {
    super();
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    this.resolution = resolution !== void 0 ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);
    this.clearColor = new Color(0, 0, 0);
    this.needsSwap = false;
    this.renderTargetsHorizontal = [];
    this.renderTargetsVertical = [];
    this.nMips = 5;
    let resx = Math.round(this.resolution.x / 2);
    let resy = Math.round(this.resolution.y / 2);
    this.renderTargetBright = new WebGLRenderTarget(resx, resy, { type: HalfFloatType, depthBuffer: false });
    this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
    this.renderTargetBright.texture.generateMipmaps = false;
    for (let i = 0; i < this.nMips; i++) {
      const renderTargetHorizontal = new WebGLRenderTarget(resx, resy, { type: HalfFloatType, depthBuffer: false });
      renderTargetHorizontal.texture.name = "UnrealBloomPass.h" + i;
      renderTargetHorizontal.texture.generateMipmaps = false;
      this.renderTargetsHorizontal.push(renderTargetHorizontal);
      const renderTargetVertical = new WebGLRenderTarget(resx, resy, { type: HalfFloatType, depthBuffer: false });
      renderTargetVertical.texture.name = "UnrealBloomPass.v" + i;
      renderTargetVertical.texture.generateMipmaps = false;
      this.renderTargetsVertical.push(renderTargetVertical);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
    const highPassShader = LuminosityHighPassShader;
    this.highPassUniforms = UniformsUtils.clone(highPassShader.uniforms);
    this.highPassUniforms["luminosityThreshold"].value = threshold;
    this.highPassUniforms["smoothWidth"].value = 0.01;
    this.materialHighPassFilter = new ShaderMaterial({
      uniforms: this.highPassUniforms,
      vertexShader: highPassShader.vertexShader,
      fragmentShader: highPassShader.fragmentShader
    });
    this.separableBlurMaterials = [];
    const kernelSizeArray = [6, 10, 14, 18, 22];
    resx = Math.round(this.resolution.x / 2);
    resy = Math.round(this.resolution.y / 2);
    for (let i = 0; i < this.nMips; i++) {
      this.separableBlurMaterials.push(this._getSeparableBlurMaterial(kernelSizeArray[i]));
      this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
    this.compositeMaterial = this._getCompositeMaterial(this.nMips);
    this.compositeMaterial.uniforms["blurTexture1"].value = this.renderTargetsVertical[0].texture;
    this.compositeMaterial.uniforms["blurTexture2"].value = this.renderTargetsVertical[1].texture;
    this.compositeMaterial.uniforms["blurTexture3"].value = this.renderTargetsVertical[2].texture;
    this.compositeMaterial.uniforms["blurTexture4"].value = this.renderTargetsVertical[3].texture;
    this.compositeMaterial.uniforms["blurTexture5"].value = this.renderTargetsVertical[4].texture;
    this.compositeMaterial.uniforms["bloomStrength"].value = strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;
    const bloomFactors = [1, 0.8, 0.6, 0.4, 0.2];
    this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
    this.bloomTintColors = [new Vector3(1, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 1), new Vector3(1, 1, 1)];
    this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
    this.copyUniforms = UniformsUtils.clone(CopyShader.uniforms);
    this.blendMaterial = new ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      premultipliedAlpha: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true
    });
    this._oldClearColor = new Color();
    this._oldClearAlpha = 1;
    this._basic = new MeshBasicMaterial();
    this._fsQuad = new FullScreenQuad(null);
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose() {
    for (let i = 0; i < this.renderTargetsHorizontal.length; i++) {
      this.renderTargetsHorizontal[i].dispose();
    }
    for (let i = 0; i < this.renderTargetsVertical.length; i++) {
      this.renderTargetsVertical[i].dispose();
    }
    this.renderTargetBright.dispose();
    for (let i = 0; i < this.separableBlurMaterials.length; i++) {
      this.separableBlurMaterials[i].dispose();
    }
    this.compositeMaterial.dispose();
    this.blendMaterial.dispose();
    this._basic.dispose();
    this._fsQuad.dispose();
  }
  /**
   * Sets the size of the pass.
   *
   * @param {number} width - The width to set.
   * @param {number} height - The height to set.
   */
  setSize(width, height) {
    let resx = Math.round(width / 2);
    let resy = Math.round(height / 2);
    this.renderTargetBright.setSize(resx, resy);
    for (let i = 0; i < this.nMips; i++) {
      this.renderTargetsHorizontal[i].setSize(resx, resy);
      this.renderTargetsVertical[i].setSize(resx, resy);
      this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(1 / resx, 1 / resy);
      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
  }
  /**
   * Performs the Bloom pass.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2, writeBuffer, readBuffer, deltaTime, maskActive) {
    renderer2.getClearColor(this._oldClearColor);
    this._oldClearAlpha = renderer2.getClearAlpha();
    const oldAutoClear = renderer2.autoClear;
    renderer2.autoClear = false;
    renderer2.setClearColor(this.clearColor, 0);
    if (maskActive) renderer2.state.buffers.stencil.setTest(false);
    if (this.renderToScreen) {
      this._fsQuad.material = this._basic;
      this._basic.map = readBuffer.texture;
      renderer2.setRenderTarget(null);
      renderer2.clear();
      this._fsQuad.render(renderer2);
    }
    this.highPassUniforms["tDiffuse"].value = readBuffer.texture;
    this.highPassUniforms["luminosityThreshold"].value = this.threshold;
    this._fsQuad.material = this.materialHighPassFilter;
    renderer2.setRenderTarget(this.renderTargetBright);
    renderer2.clear();
    this._fsQuad.render(renderer2);
    let inputRenderTarget = this.renderTargetBright;
    for (let i = 0; i < this.nMips; i++) {
      this._fsQuad.material = this.separableBlurMaterials[i];
      this.separableBlurMaterials[i].uniforms["colorTexture"].value = inputRenderTarget.texture;
      this.separableBlurMaterials[i].uniforms["direction"].value = _UnrealBloomPass.BlurDirectionX;
      renderer2.setRenderTarget(this.renderTargetsHorizontal[i]);
      renderer2.clear();
      this._fsQuad.render(renderer2);
      this.separableBlurMaterials[i].uniforms["colorTexture"].value = this.renderTargetsHorizontal[i].texture;
      this.separableBlurMaterials[i].uniforms["direction"].value = _UnrealBloomPass.BlurDirectionY;
      renderer2.setRenderTarget(this.renderTargetsVertical[i]);
      renderer2.clear();
      this._fsQuad.render(renderer2);
      inputRenderTarget = this.renderTargetsVertical[i];
    }
    this._fsQuad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
    this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
    renderer2.setRenderTarget(this.renderTargetsHorizontal[0]);
    renderer2.clear();
    this._fsQuad.render(renderer2);
    this._fsQuad.material = this.blendMaterial;
    this.copyUniforms["tDiffuse"].value = this.renderTargetsHorizontal[0].texture;
    if (maskActive) renderer2.state.buffers.stencil.setTest(true);
    if (this.renderToScreen) {
      renderer2.setRenderTarget(null);
      this._fsQuad.render(renderer2);
    } else {
      renderer2.setRenderTarget(readBuffer);
      this._fsQuad.render(renderer2);
    }
    renderer2.setClearColor(this._oldClearColor, this._oldClearAlpha);
    renderer2.autoClear = oldAutoClear;
  }
  // internals
  _getSeparableBlurMaterial(kernelRadius) {
    const coefficients = [];
    const sigma = kernelRadius / 3;
    for (let i = 0; i < kernelRadius; i++) {
      coefficients.push(0.39894 * Math.exp(-0.5 * i * i / (sigma * sigma)) / sigma);
    }
    const offsets = [];
    const weights = [];
    for (let i = 1; i < kernelRadius; i += 2) {
      const wa = coefficients[i];
      const wb = i + 1 < kernelRadius ? coefficients[i + 1] : 0;
      const w = wa + wb;
      offsets.push((i * wa + (i + 1) * wb) / w);
      weights.push(w);
    }
    return new ShaderMaterial({
      defines: {
        "KERNEL_PAIRS": offsets.length
      },
      uniforms: {
        "colorTexture": { value: null },
        "invSize": { value: new Vector2(0.5, 0.5) },
        // inverse texture size
        "direction": { value: new Vector2(0.5, 0.5) },
        "centerWeight": { value: coefficients[0] },
        "gaussianOffsets": { value: offsets },
        "gaussianWeights": { value: weights }
      },
      vertexShader: (
        /* glsl */
        `

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`
      ),
      fragmentShader: (
        /* glsl */
        `

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`
      )
    });
  }
  _getCompositeMaterial(nMips) {
    return new ShaderMaterial({
      defines: {
        "NUM_MIPS": nMips
      },
      uniforms: {
        "blurTexture1": { value: null },
        "blurTexture2": { value: null },
        "blurTexture3": { value: null },
        "blurTexture4": { value: null },
        "blurTexture5": { value: null },
        "bloomStrength": { value: 1 },
        "bloomFactors": { value: null },
        "bloomTintColors": { value: null },
        "bloomRadius": { value: 0 }
      },
      vertexShader: (
        /* glsl */
        `

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`
      ),
      fragmentShader: (
        /* glsl */
        `

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`
      )
    });
  }
};
UnrealBloomPass.BlurDirectionX = new Vector2(1, 0);
UnrealBloomPass.BlurDirectionY = new Vector2(0, 1);

// node_modules/three/examples/jsm/shaders/OutputShader.js
var OutputShader = {
  name: "OutputShader",
  uniforms: {
    "tDiffuse": { value: null },
    "toneMappingExposure": { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`
  )
};

// node_modules/three/examples/jsm/postprocessing/OutputPass.js
var OutputPass = class extends Pass {
  /**
   * Constructs a new output pass.
   */
  constructor() {
    super();
    this.isOutputPass = true;
    this.uniforms = UniformsUtils.clone(OutputShader.uniforms);
    this.material = new RawShaderMaterial({
      name: OutputShader.name,
      uniforms: this.uniforms,
      vertexShader: OutputShader.vertexShader,
      fragmentShader: OutputShader.fragmentShader
    });
    this._fsQuad = new FullScreenQuad(this.material);
    this._outputColorSpace = null;
    this._toneMapping = null;
  }
  /**
   * Performs the output pass.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2, writeBuffer, readBuffer) {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["toneMappingExposure"].value = renderer2.toneMappingExposure;
    if (this._outputColorSpace !== renderer2.outputColorSpace || this._toneMapping !== renderer2.toneMapping) {
      this._outputColorSpace = renderer2.outputColorSpace;
      this._toneMapping = renderer2.toneMapping;
      this.material.defines = {};
      if (ColorManagement.getTransfer(this._outputColorSpace) === SRGBTransfer) this.material.defines.SRGB_TRANSFER = "";
      if (this._toneMapping === LinearToneMapping) this.material.defines.LINEAR_TONE_MAPPING = "";
      else if (this._toneMapping === ReinhardToneMapping) this.material.defines.REINHARD_TONE_MAPPING = "";
      else if (this._toneMapping === CineonToneMapping) this.material.defines.CINEON_TONE_MAPPING = "";
      else if (this._toneMapping === ACESFilmicToneMapping) this.material.defines.ACES_FILMIC_TONE_MAPPING = "";
      else if (this._toneMapping === AgXToneMapping) this.material.defines.AGX_TONE_MAPPING = "";
      else if (this._toneMapping === NeutralToneMapping) this.material.defines.NEUTRAL_TONE_MAPPING = "";
      else if (this._toneMapping === CustomToneMapping) this.material.defines.CUSTOM_TONE_MAPPING = "";
      this.material.needsUpdate = true;
    }
    if (this.renderToScreen === true) {
      renderer2.setRenderTarget(null);
      this._fsQuad.render(renderer2);
    } else {
      renderer2.setRenderTarget(writeBuffer);
      if (this.clear) renderer2.clear(renderer2.autoClearColor, renderer2.autoClearDepth, renderer2.autoClearStencil);
      this._fsQuad.render(renderer2);
    }
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose() {
    this.material.dispose();
    this._fsQuad.dispose();
  }
};

// node_modules/three/examples/jsm/shaders/FilmShader.js
var FilmShader = {
  name: "FilmShader",
  uniforms: {
    "tDiffuse": { value: null },
    "time": { value: 0 },
    "intensity": { value: 0.5 },
    "grayscale": { value: false }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		#include <common>

		uniform float intensity;
		uniform bool grayscale;
		uniform float time;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 base = texture2D( tDiffuse, vUv );

			float noise = rand( fract( vUv + time ) );

			vec3 color = base.rgb + base.rgb * clamp( 0.1 + noise, 0.0, 1.0 );

			color = mix( base.rgb, color, intensity );

			if ( grayscale ) {

				color = vec3( luminance( color ) ); // assuming linear-srgb

			}

			gl_FragColor = vec4( color, base.a );

		}`
  )
};

// node_modules/three/examples/jsm/postprocessing/FilmPass.js
var FilmPass = class extends Pass {
  /**
   * Constructs a new film pass.
   *
   * @param {number} [intensity=0.5] - The grain intensity in the range `[0,1]` (0 = no effect, 1 = full effect).
   * @param {boolean} [grayscale=false] - Whether to apply a grayscale effect or not.
   */
  constructor(intensity = 0.5, grayscale = false) {
    super();
    const shader = FilmShader;
    this.uniforms = UniformsUtils.clone(shader.uniforms);
    this.material = new ShaderMaterial({
      name: shader.name,
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    this.uniforms.intensity.value = intensity;
    this.uniforms.grayscale.value = grayscale;
    this._fsQuad = new FullScreenQuad(this.material);
  }
  /**
   * Performs the film pass.
   *
   * @param {WebGLRenderer} renderer - The renderer.
   * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param {number} deltaTime - The delta time in seconds.
   * @param {boolean} maskActive - Whether masking is active or not.
   */
  render(renderer2, writeBuffer, readBuffer, deltaTime) {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["time"].value += deltaTime;
    if (this.renderToScreen) {
      renderer2.setRenderTarget(null);
      this._fsQuad.render(renderer2);
    } else {
      renderer2.setRenderTarget(writeBuffer);
      if (this.clear) renderer2.clear();
      this._fsQuad.render(renderer2);
    }
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose() {
    this.material.dispose();
    this._fsQuad.dispose();
  }
};

// src/scenes/cards3d.mjs
var id = "cards3d";
var kind = "webgl";
var slots = {};
var textUsage = {};
var ctx = null;
var renderer = null;
var composer = null;
var scene = null;
var camera = null;
var cardGroup = null;
var coinGroup = null;
var wheelGroup = null;
var wheelMesh = null;
var typeGroup = null;
var pointer = null;
var falling = [];
var clamp01 = (v) => Math.min(1, Math.max(0, v));
var ease = (v) => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
var lerp = (a, b, k) => a + (b - a) * k;
function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function texture(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function faceTexture(count) {
  return texture(256, 392, (g, w, h) => {
    g.fillStyle = "#0b0b0c";
    g.fillRect(0, 0, w, h);
    const screen = g.createLinearGradient(0, 40, 0, 190);
    screen.addColorStop(0, "#6a6a6a");
    screen.addColorStop(1, "#1b1b1b");
    g.fillStyle = screen;
    g.beginPath();
    g.roundRect(22, 40, w - 44, 150, 16);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.font = "500 44px -apple-system, system-ui, sans-serif";
    g.fillText(String(count), 22, 296);
    g.fillStyle = "rgba(255,255,255,0.42)";
    g.font = "400 22px -apple-system, system-ui, sans-serif";
    g.fillText("Views", 22, 330);
  });
}
function wheelTexture() {
  return texture(512, 512, (g, w, h) => {
    const c = w / 2;
    const r = w * 0.48;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const a0 = i / 12 * Math.PI * 2;
      const a1 = (i + 1) / 12 * Math.PI * 2;
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, r, a0, a1);
      g.closePath();
      g.fillStyle = i % 2 ? "#1b1b1c" : "#2a2a2c";
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 2;
      g.stroke();
      const mid = (a0 + a1) / 2;
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.font = "600 34px -apple-system, system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(i % 2 ? "\xD7" : "+", c + Math.cos(mid) * r * 0.62, c + Math.sin(mid) * r * 0.62);
    }
    g.fillStyle = "#0a0a0b";
    g.beginPath();
    g.arc(c, c, r * 0.12, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 3;
    g.stroke();
  });
}
function typeTexture(text, sub) {
  return texture(1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.font = "700 84px -apple-system, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(text, w / 2, h * 0.52);
    if (sub) {
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.font = "400 44px -apple-system, system-ui, sans-serif";
      g.fillText(sub, w / 2, h * 0.68);
    }
  });
}
function mount(context) {
  ctx = context;
  const bg = new Color(ctx.color("bg"));
  renderer = new WebGLRenderer({ canvas: ctx.canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(ctx.dpr);
  renderer.setSize(ctx.width, ctx.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  scene = new Scene();
  scene.background = bg;
  scene.fog = new Fog(bg, 9, 20);
  const backdrop = texture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#2b2b36");
    grad.addColorStop(0.55, "#111119");
    grad.addColorStop(1, "#06060a");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const backdropMesh = new Mesh(
    new PlaneGeometry(46, 26),
    new MeshBasicMaterial({ map: backdrop, toneMapped: false, fog: false })
  );
  backdropMesh.position.set(0, 3, -9);
  scene.add(backdropMesh);
  camera = new PerspectiveCamera(36, ctx.width / ctx.height, 0.1, 80);
  const room = new Scene();
  room.background = new Color("#050506");
  const strip = (x, y, z, w, h, rot, rgb, scale = 1) => {
    const m = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({
        color: new Color(rgb[0], rgb[1], rgb[2]).multiplyScalar(scale),
        side: DoubleSide
      })
    );
    m.position.set(x, y, z);
    m.rotation.set(rot[0], rot[1], rot[2]);
    room.add(m);
  };
  strip(0, 4, -3, 9, 3, [0, 0, 0], [1, 1, 1], 1);
  strip(-4, 0.5, 0, 6, 8, [0, Math.PI / 2, 0], [1, 0.24, 0.5], 2.6);
  strip(4, -0.5, 1, 4, 6, [0, -Math.PI / 2, 0], [0.2, 0.62, 1], 2);
  strip(0, -2.4, 2, 10, 4, [-Math.PI / 2, 0, 0], [0.3, 0.3, 0.42], 0.5);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, 0.06).texture;
  scene.add(new HemisphereLight(16777215, 592138, 0.35));
  const key = new DirectionalLight(16777215, 2.6);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -7e-4;
  scene.add(key);
  const rim = new PointLight(16732058, 42, 20);
  rim.position.set(-3.5, 1.8, -2.6);
  scene.add(rim);
  const rim2 = new PointLight(5227519, 26, 18);
  rim2.position.set(3.4, 0.6, -2.2);
  scene.add(rim2);
  const floor = new Mesh(
    new PlaneGeometry(50, 50),
    new MeshStandardMaterial({ color: 526346, roughness: 0.22, metalness: 0.65, envMapIntensity: 1.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.55;
  floor.receiveShadow = true;
  scene.add(floor);
  const wash = texture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(120, 170, 255, 0.55)");
    grad.addColorStop(0.45, "rgba(90, 120, 220, 0.16)");
    grad.addColorStop(1, "rgba(90, 120, 220, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const washMesh = new Mesh(
    new PlaneGeometry(9, 9),
    new MeshBasicMaterial({ map: wash, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })
  );
  washMesh.position.set(0, 0.9, -2.6);
  scene.add(washMesh);
  const halo = new Mesh(
    new TorusGeometry(2.05, 0.012, 12, 160),
    new MeshBasicMaterial({ color: new Color(0.72, 0.85, 1).multiplyScalar(2.2), toneMapped: false, fog: false })
  );
  halo.position.set(0, 0.55, -2.2);
  scene.add(halo);
  cardGroup = new Group();
  const cardGeom = new ExtrudeGeometry(roundedRect(1.02, 1.56, 0.16), {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 24
  });
  cardGeom.center();
  const cardMat = new MeshPhysicalMaterial({
    color: 1513243,
    metalness: 0.42,
    roughness: 0.15,
    envMapIntensity: 2.4,
    clearcoat: 1,
    clearcoatRoughness: 0.06
  });
  [
    [15038, -1.55, 0.18],
    [518797, -0.5, -0.18],
    [9864421, 0.6, 0.22],
    [21204, 1.6, -0.2]
  ].forEach(([count, x, y], i) => {
    const holder = new Group();
    holder.position.set(x, y, i % 2 ? 0.15 : -0.1);
    holder.rotation.y = -x * 0.2 + 0.1;
    const body = new Mesh(cardGeom, cardMat);
    body.castShadow = true;
    body.receiveShadow = true;
    holder.add(body);
    const face = new Mesh(
      new PlaneGeometry(0.94, 1.44),
      new MeshBasicMaterial({ map: faceTexture(count), toneMapped: false })
    );
    face.position.z = 0.09;
    holder.add(face);
    cardGroup.add(holder);
  });
  scene.add(cardGroup);
  coinGroup = new Group();
  coinGroup.position.set(0, -1.55, 0);
  const coinGeom = new CylinderGeometry(0.22, 0.22, 0.07, 40);
  const coinMat = new MeshStandardMaterial({ color: 12566463, metalness: 1, roughness: 0.22, envMapIntensity: 1.8 });
  [-0.7, 0, 0.7].forEach((x, s) => {
    for (let i = 0; i < 14; i++) {
      const coin = new Mesh(coinGeom, coinMat);
      coin.castShadow = true;
      coin.receiveShadow = true;
      const restY = 0.04 + i * 0.072;
      coin.position.set(x, restY, 0);
      coinGroup.add(coin);
      falling.push({ coin, restY, delay: 4.35 + s * 0.35 + i * 0.055, from: 3.2 });
    }
  });
  scene.add(coinGroup);
  wheelGroup = new Group();
  wheelGroup.position.set(0, 0.1, 0);
  wheelMesh = new Mesh(
    new CircleGeometry(1.12, 72),
    new MeshStandardMaterial({ map: wheelTexture(), metalness: 0.1, roughness: 0.6, envMapIntensity: 0.6 })
  );
  wheelMesh.castShadow = true;
  wheelGroup.add(wheelMesh);
  const ring = new Mesh(
    new TorusGeometry(1.13, 0.035, 16, 96),
    new MeshStandardMaterial({ color: 16777215, metalness: 1, roughness: 0.2, emissive: 3355443 })
  );
  wheelGroup.add(ring);
  pointer = new Mesh(
    new CircleGeometry(0.1, 3),
    new MeshBasicMaterial({ color: 16777215, toneMapped: false })
  );
  pointer.position.set(0, 1.3, 0.2);
  pointer.rotation.z = Math.PI;
  wheelGroup.add(pointer);
  scene.add(wheelGroup);
  typeGroup = new Group();
  const typePlane = new Mesh(
    new PlaneGeometry(2.6, 1.3),
    new MeshBasicMaterial({ map: typeTexture("CREATE TO EARN"), transparent: true, toneMapped: false })
  );
  typePlane.position.set(0, 0, 1.2);
  typeGroup.add(typePlane);
  scene.add(typeGroup);
  composer = new EffectComposer(renderer);
  composer.setSize(ctx.width, ctx.height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector3(ctx.width, ctx.height), 0.34, 0.6, 0.86);
  composer.addPass(bloom);
  composer.addPass(new FilmPass(0.34, false));
  composer.addPass(new OutputPass());
}
var CARD_POS = new Vector3(0, 0.45, 6.5);
var COIN_POS = new Vector3(0, 1, 7);
var WHEEL_POS = new Vector3(0, 0.2, 6.2);
var TYPE_POS = new Vector3(0, 0.15, 7);
function render(t) {
  const cardBeat = t < 4.2;
  const coinBeat = t >= 4.2 && t < 7.6;
  const wheelBeat = t >= 7.6 && t < 10.4;
  cardGroup.visible = cardBeat;
  coinGroup.visible = coinBeat;
  wheelGroup.visible = wheelBeat;
  typeGroup.visible = t >= 10.4;
  if (cardBeat) {
    camera.position.copy(CARD_POS);
    camera.position.x = Math.sin(t * 0.25) * 0.5;
    camera.position.y = 0.55 + Math.sin(t * 0.4) * 0.05;
    camera.lookAt(0, 0.02, 0);
  } else if (coinBeat) {
    camera.position.copy(COIN_POS);
    camera.position.y = 1 - ease((t - 4.2) / 3.2) * 0.5;
    camera.lookAt(0, -0.4, 0);
  } else if (wheelBeat) {
    camera.position.copy(WHEEL_POS);
    camera.position.x = Math.sin((t - 7.6) * 0.3) * 0.4;
    camera.lookAt(0, 0.05, 0);
  } else {
    camera.position.copy(TYPE_POS);
    camera.lookAt(0, 0.15, 0);
  }
  for (const item of falling) {
    const k = clamp01((t - item.delay) / 0.55);
    item.coin.position.y = lerp(item.from, item.restY, ease(k));
    item.coin.visible = k > 0;
    item.coin.rotation.z = (1 - k) * 2.4;
  }
  if (wheelBeat) {
    const spin = ease((t - 7.6) / 2.2);
    const winner = 3;
    const settle = -Math.PI / 2 - (winner + 0.5) / 12 * Math.PI * 2;
    wheelMesh.rotation.z = settle - Math.PI * 2 * 2.4 * (1 - spin);
    pointer.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
  }
  if (!cardBeat && !coinBeat && !wheelBeat) {
    typeGroup.rotation.y = Math.sin(t * 0.5) * 0.06;
  }
  composer.render();
}
export {
  id,
  kind,
  mount,
  render,
  slots,
  textUsage
};
