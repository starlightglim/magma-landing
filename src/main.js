// Import necessary ThreeJS libraries
import * as THREE from 'three';

// Main scene variables
let scene, camera, renderer;
let rockMesh;
let mouse = new THREE.Vector2(0.5, 0.5);
let lastMousePos = new THREE.Vector2(0.5, 0.5);
let raycaster = new THREE.Raycaster();
let isHovering = false;
let hoverPosition = new THREE.Vector2(0.5, 0.5);
let targetPosition = new THREE.Vector2(0.5, 0.5);
let animationFrameId = null; // For animation management
let isVisible = true; // For visibility management
let clock = new THREE.Clock();
let interactionPoints = [];
let lastMouseMoveTime = 0; // For tracking mouse movement timing
let initialCameraZ = 5; // Store initial camera Z position
let zoomScale = 1.0; // Initial zoom scale
let targetZoomScale = 1.0; // Target zoom scale

// Scene parameters with simplified, more minimal aesthetic
const params = {
  // Lava parameters
  baseIntensity: 0.25,       // Further increased for more visibility
  maxIntensity: 0.9,         // Further increased for more visibility
  lavaColor: '#999999',      // Even lighter gray
  lavaColor2: '#bbbbbb',     // Lighter secondary gray
  lavaColor3: '#eeeeee',     // Almost white tertiary color
  
  // Rock parameters
  baseCreviceGlow: 0.08,     // Further increased for more visibility
  maxCreviceGlow: 0.2,       // Increased for more visible glow
  baseRimLight: 0.1,         // Increased for more visibility
  maxRimLight: 0.4,          // Increased for more visibility
  rockDarkness: 0.8,         // Less dark rock for better contrast
  
  // Flow parameters
  flowSpeed: 0.03,           // Faster flow
  flowRadius: 0.7,           // Larger influence radius
  transitionSpeed: 0.95,     // Slightly faster transitions
  noiseScale: 2.2,           // Increased noise pattern
  noiseOctaves: 3,           // Keep octaves for pattern
  colorMixSpeed: 0.3,        // Faster color mixing
  fadeSpeed: 0.95,           // Faster fade
  
  // Turbulence parameters
  turbulenceScale: 1.4,      // More turbulence
  turbulenceSpeed: 0.08,     // Faster turbulence
  
  // Variation parameters 
  temperatureVariation: 0.15, // More variation
  flowVariation: 0.15,       // More flow variation
};

// Initialize the scene
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0A0A0A); // Keep exact match with our CSS background

  // Set up camera
  const aspect = window.innerWidth / window.innerHeight;
  
  // On mobile, use a narrower field of view to create a "captured area" effect
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Use a closer camera position for mobile to show a smaller section
    camera = new THREE.OrthographicCamera(-aspect * 0.8, aspect * 0.8, 1 * 0.8, -1 * 0.8, 0.1, 1000);
  } else {
    camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 1000);
  }
  
  camera.position.set(0, 0, 5);
  initialCameraZ = camera.position.z;
  camera.lookAt(0, 0, 0);

  // Get canvas with error checking
  const canvas = document.getElementById('lava-canvas');
  if (!canvas) {
    console.error('Canvas element not found! Creating canvas...');
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'lava-canvas';
    newCanvas.style.position = 'fixed';
    newCanvas.style.top = '0';
    newCanvas.style.left = '0';
    newCanvas.style.width = '100%';
    newCanvas.style.height = '100%';
    newCanvas.style.zIndex = '0';
    document.body.appendChild(newCanvas);
    console.log('Canvas created and added to document body');
  }
  
  // Set up renderer with simpler settings
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas || document.getElementById('lava-canvas'),
    antialias: false, // Disable for performance
    alpha: false,
    powerPreference: 'high-performance'
  });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Use a lower pixel ratio for better performance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  
  // Make sure we clear the canvas on each render
  renderer.autoClear = true;

  // Simpler lighting
  const ambientLight = new THREE.AmbientLight(0x333333, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffa030, 0.7);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Initialize interaction points
  initInteractionPoints();

  // Load rock with lava
  loadRockWithLava();

  // Add event listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  
  // Add hover event listeners to interactive elements
  setupHoverEffects();
  
  // Add visibility change detection to pause when tab is inactive
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Start the clock
  clock.start();
}

// Initialize interaction points system
function initInteractionPoints() {
  interactionPoints = [];
  
  // Pre-allocate array for shader
  for (let i = 0; i < 6; i++) { // Reduced from 8 to 6 for better performance
    interactionPoints.push({
      position: new THREE.Vector2(0, 0),
      strength: 0,
      age: 0,
      maxAge: 4.0, // Reduced from 5.0
      active: false
    });
  }
}

// Handle visibility change to pause animation when tab is inactive
function handleVisibilityChange() {
  isVisible = document.visibilityState === 'visible';
  
  if (isVisible) {
    if (!animationFrameId) {
      clock.start(); // Restart the clock
      animationFrameId = requestAnimationFrame(animate);
    }
  } else {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      clock.stop(); // Stop the clock when tab is inactive
    }
  }
}

// Track mouse movement with rate limiting for performance
function onMouseMove(event) {
  // Get current time for rate limiting
  const currentTime = clock.getElapsedTime();
  
  // Only process mouse movement at most 30 times per second
  if (currentTime - lastMouseMoveTime > 0.033) {
    // Normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Calculate normalized position (0 to 1)
    const normalizedX = event.clientX / window.innerWidth;
    const normalizedY = 1.0 - (event.clientY / window.innerHeight);
    
    // Create interaction point at mouse position with reduced intensity
    addInteractionPoint(normalizedX, normalizedY, 1.0);
    
    // Set a zoom target when interacting
    targetZoomScale = 1.05;
    
    lastMouseMoveTime = currentTime;
  }
}

function loadRockWithLava() {
  const textureLoader = new THREE.TextureLoader();
  
  // Set texture loading options for performance
  THREE.Cache.enabled = true;
  
  // Load all textures with paths relative to public directory
  const albedoTexture = textureLoader.load('textures/TCom_Rock_Lava2_1K_albedo.jpg');
  const normalTexture = textureLoader.load('textures/TCom_Rock_Lava2_1K_normal.png');
  const heightTexture = textureLoader.load('textures/TCom_Rock_Lava2_1K_height.png');
  const roughnessTexture = textureLoader.load('textures/TCom_Rock_Lava2_1K_roughness.png');
  const aoTexture = textureLoader.load('textures/TCom_Rock_Lava2_1K_ao.png');
  const maskTexture = textureLoader.load('textures/TCom_Rock_Lava2_1K_mask.png');

  // Set texture properties for better performance
  [albedoTexture, normalTexture, heightTexture, roughnessTexture, aoTexture, maskTexture].forEach(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 1; // Reduced for performance
  });

  // Simplified shader for better performance and minimal aesthetic
  const lavaShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deltaTime: { value: 0 },
      mousePos: { value: new THREE.Vector2(0.5, 0.5) },
      lastMousePos: { value: new THREE.Vector2(0.5, 0.5) },
      currentInfluence: { value: 0.0 },
      targetInfluence: { value: 0.0 },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      randomSeed: { value: Math.random() * 100 },
      interactionPoints: { value: [] }, 
      ...Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = { value: typeof value === 'string' ? new THREE.Color(value) : value };
        return acc;
      }, {}),
      // Add texture uniforms
      albedoMap: { value: albedoTexture },
      normalMap: { value: normalTexture },
      heightMap: { value: heightTexture },
      roughnessMap: { value: roughnessTexture },
      aoMap: { value: aoTexture },
      maskMap: { value: maskTexture }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      
      uniform float time;
      uniform float deltaTime;
      uniform vec2 mousePos;
      uniform vec2 lastMousePos;
      uniform vec2 resolution;
      uniform float randomSeed;
      uniform float baseIntensity;
      uniform float maxIntensity;
      uniform vec3 lavaColor;
      uniform vec3 lavaColor2;
      uniform vec3 lavaColor3;
      uniform float baseCreviceGlow;
      uniform float maxCreviceGlow;
      uniform float baseRimLight;
      uniform float maxRimLight;
      uniform float rockDarkness;
      uniform float flowSpeed;
      uniform float flowRadius;
      uniform float transitionSpeed;
      uniform float noiseScale;
      uniform float noiseOctaves;
      uniform float colorMixSpeed;
      uniform float currentInfluence;
      uniform float targetInfluence;
      uniform float fadeSpeed;
      uniform float turbulenceScale;
      uniform float turbulenceSpeed;
      uniform float temperatureVariation;
      uniform float flowVariation;
      
      // Interaction points
      uniform vec4 interactionPoints[6]; // x, y, strength, age
      
      uniform sampler2D albedoMap;
      uniform sampler2D normalMap;
      uniform sampler2D heightMap;
      uniform sampler2D roughnessMap;
      uniform sampler2D aoMap;
      uniform sampler2D maskMap;
      
      // Simplified hash function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      // Simplified noise function
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Simplified FBM for better performance
      float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        
        for (int i = 0; i < 3; ++i) { // Reduced from 5 to 3
          v += a * noise(x);
          x = x * 2.0 + shift;
          a *= 0.5;
        }
        
        return v;
      }

      // Simpler flow pattern
      float flow(vec2 uv, float time) {
        float pattern = 0.0;
        
        // Layer 1
        pattern += fbm(uv * noiseScale + vec2(time * flowSpeed, time * flowSpeed * 0.5));
        
        // Layer 2 with different scale
        pattern += 0.5 * fbm(uv * noiseScale * 2.0 + vec2(time * flowSpeed * -0.8, time * flowSpeed * 0.8));
        
        // Add variation
        float variation = flowVariation * noise(uv * 5.0) - flowVariation * 0.5;
        pattern += variation;
        
        return clamp(pattern, 0.0, 1.0);
      }

      // Function to handle interaction points
      float calculateInteractionInfluence(vec2 uv) {
        float influence = 0.0;
        
        // Process each interaction point
        for(int i = 0; i < 6; i++) {
          vec4 point = interactionPoints[i];
          if(point.z <= 0.0) continue; // Skip inactive points
          
          // Calculate distance and influence
          float dist = distance(uv, point.xy);
          float pointInfluence = point.z * smoothstep(0.25, 0.0, dist) * smoothstep(4.0, 0.0, point.w);
          
          // Add interaction influence
          influence = max(influence, pointInfluence);
        }
        
        return influence;
      }
      
      void main() {
        // Sample textures
        vec4 albedo = texture2D(albedoMap, vUv);
        float height = texture2D(heightMap, vUv).r;
        float roughness = texture2D(roughnessMap, vUv).r;
        float ao = texture2D(aoMap, vUv).r;
        float mask = texture2D(maskMap, vUv).r;
        
        // Create flow pattern
        float pattern = flow(vUv, time) * mask;
        
        // Add interaction influence
        float interactionInfluence = calculateInteractionInfluence(vUv);
        float totalInfluence = max(currentInfluence, interactionInfluence);
        
        // Calculate parameters based on influence
        float lavaIntensity = mix(baseIntensity, maxIntensity, totalInfluence);
        float creviceGlowAmount = mix(baseCreviceGlow, maxCreviceGlow, totalInfluence);
        
        // Create height-based cracks
        float cracks = smoothstep(0.4, 0.7, height) * mask;
        
        // Calculate rim lighting
        float rim = 1.0 - max(0.0, dot(vNormal, normalize(vViewPosition)));
        rim = smoothstep(0.5, 1.0, rim) * mix(baseRimLight, maxRimLight, totalInfluence);
        
        // Create color variation based on temperature
        float temp = pattern * lavaIntensity;
        
        // Add subtle temperature variation
        float tempVar = temperatureVariation * noise(vUv * 10.0) - temperatureVariation * 0.5;
        temp += tempVar;
        
        // Mix colors based on temperature
        vec3 hotColor = mix(lavaColor, lavaColor2, smoothstep(0.0, 0.5, temp));
        hotColor = mix(hotColor, lavaColor3, smoothstep(0.5, 1.0, temp));
        
        // Mix colors with textures
        vec3 baseColor = albedo.rgb * (1.0 - rockDarkness);
        vec3 lavaColor = mix(baseColor, hotColor, smoothstep(0.0, 0.8, temp));
        vec3 crackColor = mix(lavaColor, hotColor * 1.2, cracks * creviceGlowAmount);
        
        // Add rim lighting and AO
        vec3 finalColor = crackColor + rim * hotColor;
        finalColor *= mix(0.7, 1.0, ao);
        
        // Add subtle glow
        finalColor += pattern * hotColor * 0.1;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  // Create mesh with optimized geometry
  const aspect = window.innerWidth / window.innerHeight;
  const geometryDetail = window.innerWidth > 768 ? 64 : 32; // Reduced detail for better performance
  const geometry = new THREE.PlaneGeometry(2 * aspect, 2, geometryDetail, geometryDetail);
  
  rockMesh = new THREE.Mesh(geometry, lavaShaderMaterial);
  scene.add(rockMesh);
  
  // Initialize uniform for interaction points
  const points = [];
  for (let i = 0; i < 6; i++) { // Reduced from 8 to 6
    points.push(new THREE.Vector4(0, 0, 0, 0));
  }
  rockMesh.material.uniforms.interactionPoints.value = points;
}

// Add a new interaction point
function addInteractionPoint(x, y, strength = 1.0) {
  // Find an inactive point or the oldest one
  let oldestIdx = 0;
  let oldestAge = 0;
  
  for (let i = 0; i < interactionPoints.length; i++) {
    if (!interactionPoints[i].active) {
      oldestIdx = i;
      break;
    }
    
    if (interactionPoints[i].age > oldestAge) {
      oldestAge = interactionPoints[i].age;
      oldestIdx = i;
    }
  }
  
  // Reuse this point
  interactionPoints[oldestIdx] = {
    position: new THREE.Vector2(x, y),
    strength: strength,
    age: 0,
    active: true
  };
}

function setupHoverEffects() {
  // Target interactive elements with simplified selectors
  const interactiveSelectors = [
    '.nav-logo', '.cta', '.nav-link', 
    '.dropdown-item', '.header-logo'
  ];

  interactiveSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => addInteractionListeners(el));
  });
  
  // Helper function to add interaction listeners
  function addInteractionListeners(el) {
    el.addEventListener('mouseenter', (e) => {
      isHovering = true;
      updateHoverPosition(e, el);
      
      // Create interaction point for hover
      const rect = el.getBoundingClientRect();
      const centerX = (rect.left + rect.width / 2) / window.innerWidth;
      const centerY = 1.0 - (rect.top + rect.height / 2) / window.innerHeight;
      
      // Different strength based on element type
      let strength = 0.8;
      if (el.classList.contains('cta')) {
        strength = 1.2;
        targetZoomScale = 1.08; // More zoom for CTA button
      } else {
        targetZoomScale = 1.03; // Less zoom for other elements
      }
      
      addInteractionPoint(centerX, centerY, strength);
    });

    el.addEventListener('mouseleave', () => {
      isHovering = false;
      // Reset zoom scale gradually when not hovering
      targetZoomScale = 1.0;
    });
    
    // Add click effect
    el.addEventListener('click', () => {
      // Create a stronger interaction point
      const rect = el.getBoundingClientRect();
      const centerX = (rect.left + rect.width / 2) / window.innerWidth;
      const centerY = 1.0 - (rect.top + rect.height / 2) / window.innerHeight;
      
      // Different strength based on element type
      let strength = 1.2;
      if (el.classList.contains('cta')) {
        strength = 1.5;
        targetZoomScale = 1.1; // Maximum zoom on CTA click
      } 
      
      addInteractionPoint(centerX, centerY, strength);
    });
  }
}

function updateHoverPosition(event, element) {
  const rect = element.getBoundingClientRect();
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;

  // Convert to normalized device coordinates (-1 to +1)
  hoverPosition.x = (elementCenterX / window.innerWidth) * 2 - 1;
  hoverPosition.y = -(elementCenterY / window.innerHeight) * 2 + 1;
}

// Handle window resize with optimization
function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // More zoomed in view for mobile
    camera.left = -aspect * 0.8;
    camera.right = aspect * 0.8;
    camera.top = 1 * 0.8;
    camera.bottom = -1 * 0.8;
  } else {
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
  }
  
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Lower pixel ratio on mobile for better performance
  renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1) : Math.min(window.devicePixelRatio, 1.5));
  
  if (rockMesh) {
    // Adjust geometry complexity based on screen size
    const geometryDetail = isMobile ? 32 : 64; // Reduced detail
    rockMesh.geometry = new THREE.PlaneGeometry(2 * aspect, 2, geometryDetail, geometryDetail);
    
    // Update resolution uniform
    if (rockMesh.material.uniforms.resolution) {
      rockMesh.material.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
  }
}

// Add smoothstep function implementation
function smoothstep(edge0, edge1, x) {
  // Clamp x to 0..1 range and compute smoothstep
  x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

// Update interaction points
function updateInteractionPoints(deltaTime) {
  if (!rockMesh || !rockMesh.material.uniforms.interactionPoints) return;
  
  const pointsArray = rockMesh.material.uniforms.interactionPoints.value;
  
  // Update each point
  for (let i = 0; i < interactionPoints.length; i++) {
    const point = interactionPoints[i];
    
    if (point.active) {
      // Age the point
      point.age += deltaTime;
      
      // Decay strength over time
      point.strength *= 0.96; // Faster decay for cleaner effect
      
      // Deactivate if too old or too weak
      if (point.age > 4.0 || point.strength < 0.05) {
        point.active = false;
        point.strength = 0;
      }
      
      // Update the shader uniform
      pointsArray[i].x = point.position.x;
      pointsArray[i].y = point.position.y;
      pointsArray[i].z = point.strength;
      pointsArray[i].w = point.age;
    } else {
      // Make sure inactive points have zero strength
      pointsArray[i].z = 0;
    }
  }
}

// Animation loop with performance optimization
function animate() {
  if (!isVisible) {
    animationFrameId = null;
    return;
  }
  
  animationFrameId = requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();
  const isMobile = window.innerWidth <= 768;
  
  // Skip frames on mobile for better performance
  const shouldSkipFrame = isMobile && (elapsedTime % 3 < 1);
  
  if (rockMesh && !shouldSkipFrame) {
    const material = rockMesh.material;
    material.uniforms.time.value = elapsedTime * 0.35; // Faster animation
    material.uniforms.deltaTime.value = deltaTime;
    
    // Only update effects when visible or hovering
    if (isHovering || material.uniforms.currentInfluence.value > 0.01) {
      // Smoothly update target position
      if (isHovering) {
        targetPosition.lerp(hoverPosition, isMobile ? 0.1 : 0.06);
      } else {
        targetPosition.lerp(new THREE.Vector2(0, 0), isMobile ? 0.03 : 0.015);
      }

      // Update raycaster with current target position
      raycaster.setFromCamera(targetPosition, camera);
      
      const intersects = raycaster.intersectObject(rockMesh);
      
      let targetInfluence = 0.0;
      if (intersects.length > 0 && isHovering) {
        const intersection = intersects[0];
        const uv = intersection.uv;
        
        const dist = Math.sqrt(
          Math.pow(uv.x - 0.5, 2) + 
          Math.pow(uv.y - 0.5, 2)
        );
        
        targetInfluence = smoothstep(params.flowRadius, 0.0, dist) * 0.6; // Reduced influence
      }
      
      const currentInfluence = material.uniforms.currentInfluence.value;
      const newInfluence = currentInfluence + (targetInfluence - currentInfluence) * (1.0 - params.transitionSpeed);
      
      material.uniforms.currentInfluence.value = newInfluence;
      material.uniforms.targetInfluence.value = targetInfluence;
      material.uniforms.mousePos.value.copy(targetPosition);
    }
    
    // Update interaction points
    updateInteractionPoints(deltaTime);
    
    // Occasionally create random lava spurts but much less frequently
    if (Math.random() < 0.005) { // Increased from 0.002 for more activity
      const x = Math.random();
      const y = Math.random();
      
      addInteractionPoint(x, y, 0.3 + Math.random() * 0.3); // Increased intensity
    }
  }
  
  renderer.render(scene, camera);
}

// Start the app
init();
animate();