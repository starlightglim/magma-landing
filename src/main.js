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

// Scene parameters
const params = {
  // Lava parameters
  baseIntensity: 0.3,     // Increased base intensity
  maxIntensity: 1.6,      // Adjusted max intensity
  lavaColor: '#ff3300',   // Matching our brand color
  lavaColor2: '#ff6600',  // Secondary brand color
  lavaColor3: '#ff9900',  // Warm accent color
  
  // Rock parameters
  baseCreviceGlow: 0.08,   // Subtle base glow
  maxCreviceGlow: 0.2,     // Moderate max glow
  baseRimLight: 0.15,      // Subtle rim light
  maxRimLight: 0.5,        // Increased rim light
  rockDarkness: 0.65,      // Darker rock for contrast
  
  // Flow parameters
  flowSpeed: 0.04,        // Slower, more subtle flow
  flowRadius: 0.5,        // Larger influence radius
  transitionSpeed: 0.96,  // Smoother transitions
  noiseScale: 3.0,        // Adjusted noise scale
  noiseOctaves: 5,        // Increased complexity
  colorMixSpeed: 0.35,    // Slower color mixing
  fadeSpeed: 0.95,        // Smoother fading
  
  // New turbulence parameters
  turbulenceScale: 1.8,   // Scale of turbulence
  turbulenceSpeed: 0.12,  // Speed of turbulence
  
  // New variation parameters 
  temperatureVariation: 0.15, // Random temperature variation
  flowVariation: 0.25,     // Random flow variation
};

// Initialize the scene
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a); // Matching our background color

  // Set up camera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 1000);
  camera.position.set(0, 0, 5);
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
  
  // Set up renderer with fixed settings
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas || document.getElementById('lava-canvas'),
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Make sure we clear the canvas on each render
  renderer.autoClear = true;

  // Add enhanced lighting
  const ambientLight = new THREE.AmbientLight(0x333333, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffa030, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  const backLight = new THREE.DirectionalLight(0x2040ff, 0.2);
  backLight.position.set(-1, -1, 1);
  scene.add(backLight);

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
  for (let i = 0; i < 8; i++) {
    interactionPoints.push({
      position: new THREE.Vector2(0, 0),
      strength: 0,
      age: 0,
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

// Track mouse movement across entire screen for subtle effects
function onMouseMove(event) {
  // Normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Occasionally add subtle interaction point
  if (Math.random() < 0.01) {
    const normalizedX = event.clientX / window.innerWidth;
    const normalizedY = 1.0 - (event.clientY / window.innerHeight);
    addInteractionPoint(normalizedX, normalizedY, 0.3);
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
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });

  // Enhanced shader material for more realistic lava
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
      interactionPoints: { value: [] }, // Array of interaction points
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
      varying vec3 vTangent;
      varying vec3 vBitangent;
      varying vec3 vWorldPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        // Calculate tangent space for normal mapping
        vec3 tangent = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vec3 bitangent = normalize(cross(vNormal, tangent));
        vTangent = tangent;
        vBitangent = bitangent;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      varying vec3 vWorldPosition;
      
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
      
      // Interaction points (up to 8 supported)
      uniform vec4 interactionPoints[8]; // x, y, strength, age
      
      uniform sampler2D albedoMap;
      uniform sampler2D normalMap;
      uniform sampler2D heightMap;
      uniform sampler2D roughnessMap;
      uniform sampler2D aoMap;
      uniform sampler2D maskMap;
      
      // Improved hash function
      vec3 hash33(vec3 p) {
        p = fract(p * vec3(443.8975, 397.2973, 491.1871));
        p += dot(p.zxy, p.yxz + 19.19);
        return fract(vec3(p.x * p.y, p.z * p.x, p.y * p.z));
      }
      
      // Improved noise function
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        vec2 uv = (i.xy + vec2(37.0, 17.0) * i.z) + f.xy;
        vec2 rg = texture2D(roughnessMap, mod(uv * 0.00625, 1.0)).yx;
        return mix(rg.x, rg.y, f.z);
      }
      
      // Fractal Brownian Motion for more organic patterns
      float fbm(vec3 x) {
        float v = 0.0;
        float a = 0.5;
        vec3 shift = vec3(100.0);
        
        for (int i = 0; i < 5; ++i) {
          v += a * noise(x);
          x = x * 2.0 + shift + 0.02 * sin(time * vec3(0.5, 0.4, 0.3));
          a *= 0.5;
        }
        
        return v;
      }
      
      // Turbulent flow
      float turbulence(vec3 p) {
        float t = 0.0;
        float f = 1.0;
        
        for(int i = 0; i < 3; i++) {
          float phase = time * turbulenceSpeed * (1.0 - 0.8 * f);
          t += abs(noise(p * f + vec3(0.0, 0.0, phase)) - 0.5) * (1.0 / f);
          f *= 2.0;
        }
        
        return t;
      }

      // Dynamic flow with directional bias
      float organicFlow(vec2 uv, float time) {
        float flow = 0.0;
        float scale = noiseScale;
        float speed = flowSpeed;
        
        // Multiple layers of noise with different scales and speeds
        for (int i = 0; i < 4; i++) {
          // Add time-based variation to make flow less uniform
          float timeOffset = time * speed * (1.0 + 0.15 * sin(uv.x * 4.0 + time * 0.1));
          
          // Add directional bias to make lava flow downward with some randomness
          vec2 flowDir = vec2(
            0.3 * sin(uv.y * 3.0 + time * 0.2), 
            1.0 + 0.25 * sin(uv.x * 2.0 + time * 0.3)
          );
          
          // Distort UV coordinates based on flow direction
          vec2 distortedUV = uv + flowDir * 0.01 * timeOffset;
          
          // Add turbulence
          float turb = turbulence(vec3(distortedUV * turbulenceScale, time * 0.1));
          
          // Combine everything
          vec3 p = vec3(distortedUV * scale, timeOffset);
          flow += fbm(p + vec3(turb, turb, 0.0)) * (1.0 / float(i + 1));
          
          scale *= 1.8;
          speed *= 1.2;
        }
        
        // Add random variation
        float variation = flowVariation * noise(vec3(uv * 8.0, time * 0.1)) - flowVariation * 0.5;
        flow += variation;
        
        return clamp(flow, 0.0, 1.0);
      }

      // Function to handle interaction points
      float calculateInteractionInfluence(vec2 uv) {
        float influence = 0.0;
        
        // Process each interaction point
        for(int i = 0; i < 8; i++) {
          vec4 point = interactionPoints[i];
          if(point.z <= 0.0) continue; // Skip inactive points
          
          // Calculate distance and influence
          float dist = distance(uv, point.xy);
          float pointInfluence = point.z * smoothstep(0.3, 0.0, dist) * smoothstep(1.5, 0.0, point.w);
          
          // Add interaction influence
          influence = max(influence, pointInfluence);
        }
        
        return influence;
      }

      vec3 perturbNormal(vec3 normal, vec3 tangent, vec3 bitangent, vec2 uv) {
        vec3 normalMap = texture2D(normalMap, uv).xyz * 2.0 - 1.0;
        mat3 TBN = mat3(tangent, bitangent, normal);
        return normalize(TBN * normalMap);
      }
      
      void main() {
        // Sample textures
        vec4 albedo = texture2D(albedoMap, vUv);
        float height = texture2D(heightMap, vUv).r;
        float roughness = texture2D(roughnessMap, vUv).r;
        float ao = texture2D(aoMap, vUv).r;
        float mask = texture2D(maskMap, vUv).r;
        
        // Get perturbed normal
        vec3 normal = perturbNormal(vNormal, vTangent, vBitangent, vUv);
        
        // Create organic flowing lava effect
        float flow = organicFlow(vUv, time);
        
        // Add interaction influence from mouse and interaction points
        float interactionInfluence = calculateInteractionInfluence(vUv);
        float totalInfluence = max(currentInfluence, interactionInfluence);
        
        // Create pattern with mask
        float pattern = flow * mask;
        
        // Calculate influence-based parameters
        float lavaIntensity = mix(baseIntensity, maxIntensity, totalInfluence);
        float creviceGlowAmount = mix(baseCreviceGlow, maxCreviceGlow, totalInfluence);
        float rimLightAmount = mix(baseRimLight, maxRimLight, totalInfluence);
        
        // Create height-based cracks with variation
        float cracks = smoothstep(0.3, 0.7, height) * mask;
        cracks *= (1.0 + 0.3 * noise(vec3(vUv * 8.0, time * 0.2)));
        
        // Calculate rim lighting
        float rim = 1.0 - max(0.0, dot(normal, normalize(vViewPosition)));
        rim = smoothstep(0.4, 1.0, rim) * rimLightAmount;
        
        // Add bubble effect (simplified without separate particle system)
        float bubblePattern = noise(vec3(vUv * 10.0, time * 0.5));
        float bubbles = step(0.95, bubblePattern) * step(0.3, mask) * totalInfluence;
        bubbles *= smoothstep(0.0, 0.2, sin(time * 3.0 + vUv.y * 10.0));
        
        // Create color variation based on temperature
        float temp = pattern * lavaIntensity;
        
        // Add temperature variation
        float tempVar = temperatureVariation * noise(vec3(vUv * 15.0, time * 0.2)) - temperatureVariation * 0.5;
        temp += tempVar;
        
        // Mix colors based on temperature
        vec3 hotColor = mix(lavaColor, lavaColor2, smoothstep(0.0, 0.5, temp));
        hotColor = mix(hotColor, lavaColor3, smoothstep(0.5, 1.0, temp));
        
        // Mix colors with textures
        vec3 baseColor = albedo.rgb * (1.0 - rockDarkness);
        vec3 lavaColor = mix(baseColor, hotColor, smoothstep(0.0, 0.8, temp));
        vec3 crackColor = mix(lavaColor, hotColor * 1.5, cracks * creviceGlowAmount);
        
        // Add bubbles
        crackColor = mix(crackColor, vec3(1.0, 0.9, 0.7), bubbles * 0.8);
        
        // Add rim lighting and AO
        vec3 finalColor = crackColor + rim * hotColor;
        finalColor *= mix(0.6, 1.0, ao);
        
        // Add roughness variation
        finalColor *= mix(1.0, 0.6, roughness);
        
        // Add subtle pulsing to the lava
        float pulse = 1.0 + 0.15 * sin(time + pattern * 5.0 + vUv.x * 2.0 + vUv.y * 3.0);
        finalColor *= pulse;
        
        // Add subtle glow around hot areas
        finalColor += pattern * hotColor * 0.15;
        
        // Simulate self-illumination in cracks
        float selfIllum = cracks * creviceGlowAmount * totalInfluence * 4.0;
        finalColor += selfIllum * hotColor;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  // Create mesh with optimized geometry
  const aspect = window.innerWidth / window.innerHeight;
  const geometryDetail = window.innerWidth > 768 ? 128 : 64; // Adaptive detail
  const geometry = new THREE.PlaneGeometry(2 * aspect, 2, geometryDetail, geometryDetail);
  geometry.computeVertexNormals();
  geometry.computeTangents();
  
  rockMesh = new THREE.Mesh(geometry, lavaShaderMaterial);
  scene.add(rockMesh);
  
  // Initialize uniform for interaction points
  const points = [];
  for (let i = 0; i < 8; i++) {
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
  const interactiveElements = [
    document.querySelector('.nav-logo'),
    document.querySelector('.cta-primary'),
    // Add more interactive elements as needed
    document.querySelector('.nav-item'),
    document.querySelector('.footer-link')
  ];

  interactiveElements.forEach(element => {
    if (element) {
      element.addEventListener('mouseenter', (e) => {
        isHovering = true;
        updateHoverPosition(e, element);
      });

      element.addEventListener('mouseleave', () => {
        isHovering = false;
      });

      element.addEventListener('mousemove', (e) => {
        if (isHovering) {
          updateHoverPosition(e, element);
        }
      });
      
      // Add click effect
      element.addEventListener('click', (e) => {
        // Create a stronger interaction point
        const rect = element.getBoundingClientRect();
        const centerX = (rect.left + rect.width / 2) / window.innerWidth;
        const centerY = 1.0 - (rect.top + rect.height / 2) / window.innerHeight;
        
        addInteractionPoint(centerX, centerY, 1.5);
      });
    }
  });
}

function updateHoverPosition(event, element) {
  const rect = element.getBoundingClientRect();
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;

  // Convert to normalized device coordinates (-1 to +1)
  hoverPosition.x = (elementCenterX / window.innerWidth) * 2 - 1;
  hoverPosition.y = -(elementCenterY / window.innerHeight) * 2 + 1;
  
  // Add subtle interaction point for hover
  if (Math.random() < 0.05) { // Randomly add points during hover for natural effect
    const normalizedX = elementCenterX / window.innerWidth;
    const normalizedY = 1.0 - (elementCenterY / window.innerHeight);
    addInteractionPoint(normalizedX, normalizedY, 0.8);
  }
}

// Handle window resize with optimization
function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  
  camera.left = -aspect;
  camera.right = aspect;
  camera.updateProjectionMatrix();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  if (rockMesh) {
    // Adjust geometry complexity based on screen size
    const geometryDetail = window.innerWidth > 768 ? 128 : 64;
    rockMesh.geometry = new THREE.PlaneGeometry(2 * aspect, 2, geometryDetail, geometryDetail);
    rockMesh.geometry.computeVertexNormals();
    rockMesh.geometry.computeTangents();
    
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
      point.strength *= 0.98;
      
      // Deactivate if too old or too weak
      if (point.age > 5.0 || point.strength < 0.05) {
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
  
  if (rockMesh) {
    const material = rockMesh.material;
    material.uniforms.time.value = elapsedTime;
    material.uniforms.deltaTime.value = deltaTime;
    
    // Only update effects when visible or hovering
    if (isHovering || material.uniforms.currentInfluence.value > 0.01) {
      // Smoothly update target position
      if (isHovering) {
        targetPosition.lerp(hoverPosition, 0.1);
      } else {
        targetPosition.lerp(new THREE.Vector2(0, 0), 0.03);
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
        
        targetInfluence = smoothstep(params.flowRadius, 0.0, dist);
      }
      
      const currentInfluence = material.uniforms.currentInfluence.value;
      const newInfluence = currentInfluence + (targetInfluence - currentInfluence) * (1.0 - params.transitionSpeed);
      
      material.uniforms.currentInfluence.value = newInfluence;
      material.uniforms.targetInfluence.value = targetInfluence;
      material.uniforms.mousePos.value.copy(targetPosition);
    }
    
    // Update interaction points
    updateInteractionPoints(deltaTime);
    
    // Occasionally create random lava spurts for more dynamism
    if (Math.random() < 0.02) {
      const x = Math.random();
      const y = Math.random();
      
      // Create spurts with varying intensity
      if (Math.random() < 0.7) {
        addInteractionPoint(x, y, 0.3 + Math.random() * 0.5);
      }
    }
  }
  
  renderer.render(scene, camera);
}

// Start the app
init();
animate();