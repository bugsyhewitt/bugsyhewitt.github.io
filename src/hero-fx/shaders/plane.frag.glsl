uniform sampler2D uTexture;
uniform sampler2D uGrid;
varying vec2 vUv;

uniform vec2 uContainerResolution;
uniform vec2 uImageResolution;

/* object-fit:cover UV mapping.
   For the image UVs, the vertical bias matches CSS background-position:center 32%:
     uOffsetY = (0.5 - 0.32) * (1.0 - ratioY)  =  0.18 * (1.0 - ratioY)
   This is derived from: image's 32% mark aligns with container's 32% mark.
   The heightCropFactor (1 - ratioY) scales the offset by how much vertical
   cropping is happening, so it collapses to zero when there is no crop. */
vec2 coverUvs(vec2 imageRes, vec2 containerRes, bool applyPositionBias) {
    float imageAspectX = imageRes.x / imageRes.y;
    float imageAspectY = imageRes.y / imageRes.x;
    float containerAspectX = containerRes.x / containerRes.y;
    float containerAspectY = containerRes.y / containerRes.x;

    vec2 ratio = vec2(
        min(containerAspectX / imageAspectX, 1.0),
        min(containerAspectY / imageAspectY, 1.0)
    );

    float offsetY = applyPositionBias ? 0.18 * (1.0 - ratio.y) : 0.0;

    return vec2(
        vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        vUv.y * ratio.y + (1.0 - ratio.y) * 0.5 + offsetY
    );
}

void main() {
    vec2 imageUvs = coverUvs(uImageResolution, uContainerResolution, true);
    vec2 gridUvs  = coverUvs(vec2(1.0, 1.0),  uContainerResolution, false);

    vec4 displacement = texture2D(uGrid, gridUvs);

    vec2 displacedUvs = imageUvs - displacement.rg * 0.01;

    float displacementStrength = clamp(length(displacement.rg), 0.0, 2.0);
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
