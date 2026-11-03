import { ShaderMaterial, Matrix4, NoBlending, Vector2 } from 'three'

/** Depth-only hemisphere SSAO: reuses the beauty depth, including alpha cutouts
 * and dissolving add-ons, rather than rendering a second approximation of them. */
export function createAmbientOcclusionMaterial() {
  return new ShaderMaterial({
    depthTest: false, depthWrite: false, blending: NoBlending,
    uniforms: {
      depthBuffer: { value: null }, projection: { value: new Matrix4() },
      inverseProjection: { value: new Matrix4() }, resolution: { value: new Vector2() },
    },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D depthBuffer;
      uniform mat4 projection, inverseProjection;
      uniform vec2 resolution;
      varying vec2 vUv;
      vec3 positionAt(vec2 uv) {
        vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(depthBuffer,uv).r*2.-1.,1.);
        return p.xyz/p.w;
      }
      void main() {
        vec3 p=positionAt(vUv);
        if(p.z < -60. || texture2D(depthBuffer,vUv).r >= .99999) { gl_FragColor=vec4(1.); return; }
        vec2 texel=1./resolution;
        vec3 left=p-positionAt(vUv-vec2(texel.x,0.));
        vec3 right=positionAt(vUv+vec2(texel.x,0.))-p;
        vec3 down=p-positionAt(vUv-vec2(0.,texel.y));
        vec3 up=positionAt(vUv+vec2(0.,texel.y))-p;
        vec3 n=normalize(cross(abs(left.z)<abs(right.z)?left:right,abs(down.z)<abs(up.z)?down:up));
        vec3 tangent=normalize(cross(n,abs(n.z)<.99?vec3(0.,0.,1.):vec3(0.,1.,0.)));
        vec3 bitangent=cross(n,tangent);
        float angle=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)*6.283185;
        float occlusion=0.;
        for(int i=0;i<16;i++) {
          float f=(float(i)+.5)/16.;
          float a=float(i)*2.399963+angle;
          vec3 direction=tangent*cos(a)*sqrt(f)+bitangent*sin(a)*sqrt(f)+n*sqrt(1.-f);
          vec3 samplePosition=p+direction*.38*mix(.2,1.,f);
          vec4 projected=projection*vec4(samplePosition,1.);
          vec2 uv=projected.xy/projected.w*.5+.5;
          if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) continue;
          float z=positionAt(uv).z;
          occlusion+=step(samplePosition.z+.018,z)*(1.-smoothstep(.15,.38,abs(z-p.z)));
        }
        float ao=1.-occlusion/16.*(1.-smoothstep(25.,60.,-p.z));
        gl_FragColor=vec4(vec3(ao),1.);
      }`,
  })
}
