precision highp float;
out vec4 fragColor;

// Uniforms
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uBackgroundColor;
uniform float uPixelSize;
uniform float uWaveSpeed;
uniform float uWaveThickness;
uniform float uTimeDecay;
uniform float uDistanceDecay;
uniform float uBloomStrength;
uniform bool uAnimatedBackground;

// Ripple data
const int MAX_CLICKS = 16;
uniform vec2 uClickPos[MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

// Constants
const float CELL_PIXEL_SIZE = 8.0;

// Bayer matrix helpers 
float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

#define Bayer4(a) (Bayer2(0.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(0.5*(a))*0.25 + Bayer2(a))
#define Bayer16(a) (Bayer8(0.5*(a))*0.25 + Bayer2(a))

// Blue noise approximation for smoother dithering
float blueNoise(vec2 coord) {
    vec2 p = coord * 0.01;
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123 + 
                sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
}

// Wave function Physics wala
float calculateWave(vec2 pos, vec2 center, float time, float waveSpeed, float thickness) {
    float dist = distance(pos, center);
    float waveRadius = waveSpeed * time;
    
    // Gerstner wave for more realistic water behavior
    float wavePhase = 6.28318 * (dist - waveRadius) / thickness;
    float wave = exp(-pow((dist - waveRadius) / thickness, 2.0));
    
    // Add subtle wave interference
    wave *= (1.0 + 0.3 * sin(wavePhase * 2.0)) * 0.7;
    
    return wave;
}

// Background gradient
vec3 getAnimatedBackground(vec2 uv) {
    if (!uAnimatedBackground) {
        return uBackgroundColor;
    }
    
    vec2 animUV = uv + vec2(sin(uTime * 0.3), cos(uTime * 0.2)) * 0.1;
    float gradient = smoothstep(0.0, 1.0, animUV.y + sin(animUV.x * 3.14159) * 0.2);
    
    return mix(uBackgroundColor, uBackgroundColor * 1.5, gradient * 0.3);
}

void main() {
    float pixelSize = uPixelSize;
    vec2 fragCoord = gl_FragCoord.xy - uResolution * 0.5;
    
    // aspect ratio handling
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 pixelId = floor(fragCoord / pixelSize);
    
    float cellPixelSize = CELL_PIXEL_SIZE * pixelSize;
    vec2 cellId = floor(fragCoord / cellPixelSize);
    vec2 cellCoord = cellId * cellPixelSize;
    
    vec2 uv = ((cellCoord / uResolution)) * vec2(aspectRatio, 1.0);
    
    float totalWave = 0.0;
    float maxIntensity = 0.0;
    
    // ripple processing
    for (int i = 0; i < MAX_CLICKS; ++i) {
        vec2 pos = uClickPos[i];
        if(pos.x < 0.0 && pos.y < 0.0) continue;
        
        vec2 cuv = (((pos - uResolution * 0.5 - cellPixelSize * 0.5) / uResolution)) * vec2(aspectRatio, 1.0);
        float timeSinceClick = max(uTime - uClickTimes[i], 0.0);
        float dist = distance(uv, cuv);
        
        // wave calculation
        float wave = calculateWave(uv, cuv, timeSinceClick, uWaveSpeed, uWaveThickness);
        
        // Improved attenuation
        float timeAttenuation = exp(-uTimeDecay * timeSinceClick);
        float distanceAttenuation = exp(-uDistanceDecay * dist);
        float finalWave = wave * timeAttenuation * distanceAttenuation;
        
        totalWave = max(totalWave, finalWave);
        maxIntensity = max(maxIntensity, finalWave);
    }
    
    // Enhanced dithering with multiple patterns
    float ditherValue;
    
    // Choose dithering pattern based on intensity for artistic effect
    if (maxIntensity > 0.8) {
        ditherValue = Bayer16(fragCoord / pixelSize);
    } else if (maxIntensity > 0.6) {
        ditherValue = Bayer8(fragCoord / pixelSize);
    } else if (maxIntensity > 0.3) {
        ditherValue = Bayer4(fragCoord / pixelSize);
    } else {
        ditherValue = blueNoise(fragCoord / pixelSize);
    }
    
    ditherValue -= 0.5;
    
    // color mixing
    float thresholdValue = totalWave + ditherValue;
    float rippleStrength = smoothstep(0.3, 0.7, thresholdValue);
    
    // Get background color (animated or static)
    vec3 backgroundColor = getAnimatedBackground(uv);
    
    // Color interpolation with bloom effect
    vec3 rippleColor = mix(uColor1, uColor2, rippleStrength);
    vec3 finalColor = mix(backgroundColor, rippleColor, rippleStrength);
    
    // Add bloom effect
    if (rippleStrength > 0.5) {
        finalColor += rippleColor * uBloomStrength * (rippleStrength - 0.5) * 2.0;
    }
    
    fragColor = vec4(finalColor, 1.0);
}
