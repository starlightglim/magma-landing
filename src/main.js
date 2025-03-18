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

// Scene parameters
const params = {
  // Lava parameters
  baseIntensity: 0.2,    // Increased base intensity
  maxIntensity: 1.4,     // Adjusted max intensity
  lavaColor: '#ff3300',  // Matching our brand color
  lavaColor2: '#ff6600', // Secondary brand color
  lavaColor3: '#ff9900', // Warm accent color
  
  // Rock parameters
  baseCreviceGlow: 0.05,  // Subtle base glow
  maxCreviceGlow: 0.15,   // Moderate max glow
  baseRimLight: 0.1,      // Subtle rim light
  maxRimLight: 0.4,       // Increased rim light
  rockDarkness: 0.6,      // Darker rock for contrast
  
  // Flow parameters
  flowSpeed: 0.05,        // Slower, more subtle flow
  flowRadius: 0.4,        // Larger influence radius
  transitionSpeed: 0.98,  // Smoother transitions
  noiseScale: 2.5,        // Adjusted noise scale
  noiseOctaves: 4,        // Reduced complexity
  colorMixSpeed: 0.3,     // Slower color mixing
  fadeSpeed: 0.97,        // Smoother fading
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

  // Get canvas
  const canvas = document.getElementById('lava-canvas');
  
  // Set up renderer with optimized settings
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: false, // Disable antialiasing for better performance
    powerPreference: 'high-performance',
    precision: 'mediump', // Use medium precision for better performance
    depth: false // Don't need depth for this effect
  });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio for better performance
  
  // Set renderer to not clear between frames since our scene is simple
  renderer.autoClear = false;

  // Simplify lighting
  const ambientLight = new THREE.AmbientLight(0x333333);
  scene.add(ambientLight);

  // Load rock with lava
  loadRockWithLava();

  // Add event listeners
  window.addEventListener('resize', onWindowResize);
  
  // Add hover event listeners to interactive elements
  setupHoverEffects();
  
  // Add visibility change detection to pause when tab is inactive
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Handle visibility change to pause animation when tab is inactive
function handleVisibilityChange() {
  isVisible = document.visibilityState === 'visible';
  
  if (isVisible) {
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animate);
    }
  } else {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
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
    texture.minFilter = THREE.LinearFilter; // Changed from LinearMipmapLinearFilter for better performance
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 1; // Limit anisotropic filtering
  });

  // Create shader material
  const lavaShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      mousePos: { value: new THREE.Vector2(0.5, 0.5) },
      lastMousePos: { value: new THREE.Vector2(0.5, 0.5) },
      currentInfluence: { value: 0.0 },  // Track current influence
      targetInfluence: { value: 0.0 },   // Target influence from mouse
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
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      
      uniform float time;
      uniform vec2 mousePos;
      uniform vec2 lastMousePos;
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
      
      uniform sampler2D albedoMap;
      uniform sampler2D normalMap;
      uniform sampler2D heightMap;
      uniform sampler2D roughnessMap;
      uniform sampler2D aoMap;
      uniform sampler2D maskMap;
      
      // Simplified noise function for better performance
      float noise(vec3 p){
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          
          vec2 uv = (i.xy+vec2(37.0,17.0)*i.z) + f.xy;
          vec2 rg = texture2D(roughnessMap, (uv+0.5)/64.0).yx;
          return mix(rg.x, rg.y, f.z);
      }
      
      // Optimized FBM with fewer octaves
      float fbm(vec3 x) {
          float v = 0.0;
          float a = 0.5;
          vec3 shift = vec3(100);
          
          // Reduced from 5 to 3 iterations for better performance
          for (int i = 0; i < 3; ++i) {
              v += a * noise(x);
              x = x * 2.0 + shift;
              a *= 0.5;
          }
          return v;
      }

      // Optimized organic flow function
      float organicFlow(vec2 uv, float time) {
          float flow = 0.0;
          float scale = noiseScale;
          float speed = flowSpeed;
          
          // Reduced iterations from 5 to 3
          for (int i = 0; i < 3; i++) {
              vec3 p = vec3(uv * scale, time * speed);
              flow += fbm(p) * (1.0 / float(i + 1));
              scale *= 2.0;
              speed *= 1.5;
          }
          
          return flow;
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
        float pattern = flow * mask;
        
        // Calculate influence-based parameters
        float lavaIntensity = mix(baseIntensity, maxIntensity, currentInfluence);
        float creviceGlowAmount = mix(baseCreviceGlow, maxCreviceGlow, currentInfluence);
        float rimLightAmount = mix(baseRimLight, maxRimLight, currentInfluence);
        
        // Simplified cracks calculation
        float cracks = smoothstep(0.4, 0.6, height) * mask;
        
        // Calculate rim lighting (simplified)
        float rim = 1.0 - max(0.0, dot(normal, normalize(vViewPosition)));
        rim = smoothstep(0.5, 1.0, rim) * rimLightAmount;
        
        // Create color variation based on temperature
        float temp = pattern * lavaIntensity;
        vec3 hotColor = mix(lavaColor, lavaColor2, temp * colorMixSpeed);
        hotColor = mix(hotColor, lavaColor3, temp * temp * colorMixSpeed);
        
        // Mix colors with textures
        vec3 baseColor = albedo.rgb;
        vec3 lavaColor = mix(baseColor, hotColor, temp);
        vec3 crackColor = mix(lavaColor, hotColor * 1.2, cracks * creviceGlowAmount);
        
        // Add rim lighting and AO
        vec3 finalColor = crackColor + rim * hotColor;
        finalColor *= ao;
        
        // Add roughness variation
        finalColor *= mix(1.0, 0.7, roughness);
        
        // Simplified pulsing
        float pulse = 1.0 + 0.1 * sin(time + pattern * 5.0);
        finalColor *= pulse;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: true
  });

  // Create mesh with optimized geometry
  const aspect = window.innerWidth / window.innerHeight;
  // Reduce geometry resolution for better performance
  const geometryDetail = window.innerWidth > 768 ? 64 : 32;
  const geometry = new THREE.PlaneGeometry(2 * aspect, 2, geometryDetail, geometryDetail);
  geometry.computeVertexNormals();
  geometry.computeTangents();
  
  rockMesh = new THREE.Mesh(geometry, lavaShaderMaterial);
  scene.add(rockMesh);
}

function setupHoverEffects() {
  const interactiveElements = [
    document.querySelector('.nav-logo'),
    document.querySelector('.cta-primary')
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
    const geometryDetail = window.innerWidth > 768 ? 64 : 32;
    rockMesh.geometry = new THREE.PlaneGeometry(2 * aspect, 2, geometryDetail, geometryDetail);
    rockMesh.geometry.computeVertexNormals();
    rockMesh.geometry.computeTangents();
  }
}

// Add smoothstep function implementation
function smoothstep(edge0, edge1, x) {
  // Clamp x to 0..1 range and compute smoothstep
  x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

// Animation loop with performance optimization
function animate() {
  if (!isVisible) {
    animationFrameId = null;
    return;
  }
  
  animationFrameId = requestAnimationFrame(animate);
  
  if (rockMesh) {
    const material = rockMesh.material;
    material.uniforms.time.value = performance.now() / 1000;

    // Only update effects when visible or hovering
    if (isHovering || material.uniforms.currentInfluence.value > 0.01) {
      // Smoothly update target position
      if (isHovering) {
        targetPosition.lerp(hoverPosition, 0.1);
      } else {
        targetPosition.lerp(new THREE.Vector2(0.5, 0.5), 0.05);
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
      material.uniforms.mousePos.value.set(targetPosition.x, targetPosition.y);
    }
  }
  
  renderer.render(scene, camera);
}

// Start the app
init();
animate(); 