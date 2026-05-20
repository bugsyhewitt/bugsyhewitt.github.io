uniform sampler2D uTexture;
uniform sampler2D uGrid;
varying vec2 vUv;

uniform vec2 uContainerResolution;
uniform vec2 uImageResolution;
uniform vec2 uOffset;

/* object-fit:cover UV mapping.
   Mirrors J0SUKE's ratio approach; uOffset.y biases the crop window
   so that the image's 32%-from-top mark sits at canvas center,
   matching the CSS background-position:center 32%. */
vec2 coverUvs(vec2 imageRes, vec2 containerRes, vec2 offset) {
    float imageAspectX = imageRes.x / imageRes.y;
    float imageAspectY = imageRes.y / imageRes.x;
    float containerAspectX = containerRes.x / containerRes.y;
    float containerAspectY = containerRes.y / containerRes.x;

    vec2 ratio = vec2(
        min(containerAspectX / imageAspectX, 1.0),
        min(containerAspectY / imageAspectY, 1.0)
    );

    return vec2(
        vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        vUv.y * ratio.y + (1.0 - ratio.y) * 0.5 + offset.y
    );
}

void main() {
    /* Image UVs — cover fit + vertical position bias */
    vec2 imageUvs = coverUvs(uImageResolution, uContainerResolution, uOffset);

    /* GPGPU grid UVs — cover fit into square, no position bias.
       Keeps displacement circles round regardless of canvas aspect. */
    vec2 gridUvs = coverUvs(vec2(1.0, 1.0), uContainerResolution, vec2(0.0));

    vec4 displacement = texture2D(uGrid, gridUvs);

    /* Displace image UVs by GPGPU field */
    vec2 displacedUvs = imageUvs - displacement.rg * 0.01;

    /* Chromatic aberration — per-channel UV shifts scaled by displacement strength */
    float displacementStrength = length(displacement.rg);
    displacementStrength = clamp(displacementStrength, 0.0, 2.0);

    vec2 shift = displacement.rg * 0.001;

    vec2 redUvs   = displacedUvs + shift * (1.0 + displacementStrength * 0.25);
    vec2 greenUvs = displacedUvs + shift * (1.0 + displacementStrength * 2.0);
    vec2 blueUvs  = displacedUvs + shift * (1.0 + displacementStrength * 1.5);

    vec4 finalImage;
    finalImage.r = texture2D(uTexture, redUvs).r;
    finalImage.g = texture2D(uTexture, greenUvs).g;
    finalImage.b = texture2D(uTexture, blueUvs).b;
    finalImage.a = texture2D(uTexture, displacedUvs).a;

    gl_FragColor = finalImage;
}
