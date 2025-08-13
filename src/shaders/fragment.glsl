precision highp float;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;

const int MAX_CLICKS = 10;
const float PIXEL_SIZE = 4.0;
const float CELL_PIXEL_SIZE = 8.0 * PIXEL_SIZE;

uniform vec2 uClickPos[MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

// Bayer matrix helpers
float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

#define Bayer4(a) (Bayer2(0.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(0.5*(a))*0.25 + Bayer2(a))

void main() {
    float pixelSize = PIXEL_SIZE;
    vec2 fragCoord = gl_FragCoord.xy - uResolution * 0.5;
    
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 pixelId = floor(fragCoord / pixelSize);
    float cellPixelSize = 8.0 * pixelSize;
    vec2 cellId = floor(fragCoord / cellPixelSize);
    vec2 cellCoord = cellId * cellPixelSize;
    vec2 uv = ((cellCoord / uResolution)) * vec2(aspectRatio, 1.0);
    
    float feed = 0.0;
    
    // Wave parameters
    const float speed = 0.30;
    const float thickness = 0.10;
    const float dampT = 1.0;
    const float dampR = 1.0;
    
    // Process all clicks
    for (int i = 0; i < MAX_CLICKS; ++i) {
        vec2 pos = uClickPos[i];
        if(pos.x < 0.0 && pos.y < 0.0) continue;
        
        vec2 cuv = (((pos - uResolution * 0.5 - cellPixelSize * 0.5) / uResolution)) * vec2(aspectRatio, 1.0);
        float t = max(uTime - uClickTimes[i], 0.0);
        float r = distance(uv, cuv);
        float waveR = speed * t;
        float ring = exp(-pow((r - waveR) / thickness, 2.0));
        float atten = exp(-dampT * t) * exp(-dampR * r);
        feed = max(feed, ring * atten);
    }
    
    float bayerValue = Bayer8(fragCoord / pixelSize) - 0.5;
    float bw = step(0.5, feed + bayerValue);
    fragColor = vec4(vec3(bw), 1.0);
}
