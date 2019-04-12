/* Pajazzo Real Love Visuals
 * Copyright (C) 2019  Alexander Kraus <nr4@z10.info>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

 #version 130

uniform float iTime;
uniform vec2 iResolution;
 
// Global constants
const float pi = acos(-1.);
const vec3 c = vec3(1.0, 0.0, -1.0);
float a = 1.0;

// Hash function
void rand(in vec2 x, out float num)
{
    x += 400.;
    num = fract(sin(dot(sign(x)*abs(x) ,vec2(12.9898,78.233)))*43758.5453);
}

// Arbitrary-frequency 2D noise
void lfnoise(in vec2 t, out float num)
{
    vec2 i = floor(t);
    t = fract(t);
    //t = ((6.*t-15.)*t+10.)*t*t*t;  // TODO: add this for slower perlin noise
    t = smoothstep(c.yy, c.xx, t); // TODO: add this for faster value noise
    vec2 v1, v2;
    rand(i, v1.x);
    rand(i+c.xy, v1.y);
    rand(i+c.yx, v2.x);
    rand(i+c.xx, v2.y);
    v1 = c.zz+2.*mix(v1, v2, t.y);
    num = mix(v1.x, v1.y, t.x);
}

// Multi-frequency 2D noise
void mfnoise(in vec2 x, in float fmin, in float fmax, in float alpha, out float num)
{
    num = 0.;
    float a = 1., nf = 0., buf;
    for(float f = fmin; f<fmax; f = f*2.)
    {
        lfnoise(f*x, buf);
        num += a*buf;
        a *= alpha;
        nf += 1.;
    }
    num *= (1.-alpha)/(1.-pow(alpha, nf));
}

void rot(in vec3 p, out mat3 rot)
{
    rot = mat3(c.xyyy, cos(p.x), sin(p.x), 0., -sin(p.x), cos(p.x))
        *mat3(cos(p.y), 0., -sin(p.y), c.yxy, sin(p.y), 0., cos(p.y))
        *mat3(cos(p.z), -sin(p.z), 0., sin(p.z), cos(p.z), c.yyyx);
}

// Distance to regular voronoi
void dvoronoi(in vec2 x, out float d, out vec2 ind)
{
    vec2 y = floor(x);
   	float ret = 1.;
    
    //find closest control point. ("In which cell am I?")
    vec2 pf=c.yy, p;
    float df=10.;
    
    for(int i=-1; i<=1; i+=1)
        for(int j=-1; j<=1; j+=1)
        {
            p = y + vec2(float(i), float(j));
            vec2 pa;
            lfnoise(p-.5*iTime, pa.x);
            lfnoise(p-.5*iTime-1.3, pa.y);
            pa = .5+.5*pa;
            p += pa;
            
            d = length(x-p);
            
            if(d < df)
            {
                df = d;
                pf = p;
            }
        }
    
    //compute voronoi distance: minimum distance to any edge
    for(int i=-1; i<=1; i+=1)
        for(int j=-1; j<=1; j+=1)
        {
            p = y + vec2(float(i), float(j));
            vec2 pa;
            lfnoise(p-.5*iTime, pa.x);
            lfnoise(p-.5*iTime-1.3, pa.y);
            pa = .5+.5*pa;
            p += pa;
            
            vec2 o = p - pf;
            d = length(.5*o-dot(x-pf, o)/dot(o,o)*o);
            ret = min(ret, d);
        }
    
    d = ret;
    ind = pf;
}

// 2D box
void dbox(in vec2 p, in vec2 b, out float dst)
{
  	vec2 d = abs(p) - b;
  	dst = length(max(d,0.0)) + min(max(d.x,d.y),0.0); 
}

// 2D circle
void dcircle(in vec2 x, in float r, out float dst)
{
    dst = length(x)-r;
}

// Stroke
void stroke(in float d0, in float s, out float d)
{
    d = abs(d0)-s;
}

// Extrusion
void zextrude(in float z, in float d2d, in float h, out float d)
{
    vec2 w = vec2(-d2d, abs(z)-0.5*h);
    d = length(max(w,0.0));
}

// Add sdfs to scene
void add(in vec4 old, in vec4 new, out vec4 result)
{
    result = mix(old, new, step(new.x,0.));
}

// Mix appropriate marble colors.
void color(in float scale, out vec3 col)
{
    scale = clamp(scale, 0., .999);
    const int N = 5;
    const vec3 colors[N] = vec3[N](
        c.yyy,
        vec3(0.24,0.03,0.62),
        vec3(0.55,0.22,0.91),
        .6*vec3(0.69,0.37,0.93),
        .2*vec3(0.79,0.07,0.83)
    );
	float index = mod(floor(scale*float(N)),N-1.), 
        remainder = clamp(scale*float(N)-index,0.,1.);
    col = mix(colors[int(index)],colors[int(mod(index+1.,N-1.))], remainder);
}

void dheart(in vec2 x, in float R, out float dst)
{
    x.x *= (1.-mix(0.,1.8*R, x.y));
    x.y *= (1.+.4*R*R);
    float p = atan(x.y,abs(x.x));
    dst = length(x);
    dst -= mix(R,-.5*R, p/2./pi+.5);
}

void colorize(in vec2 uv, out vec3 col)
{
    col = c.yyy;
    uv -= 100.;
    
    float roff;
    lfnoise(.5*iTime*c.xx, roff);
    roff = mix(0., .5+.5*roff, clamp((iTime-20.)/5.,0.,1.));
    
    for(float i=0.; i<3.+8.*roff; i+=1.)
    {
        vec2 gd;
        lfnoise(.1*i*c.xx+.33, gd.x);
        lfnoise(.1*i*c.xx+.13, gd.y);
        uv += gd;
        
        float dh, db, d, dv;
        dheart(uv,.75,dh);
        vec2 yi,y;
        dvoronoi((3.+2.*gd.x)*uv, dv, yi);
        y = uv-yi/(3.+2.*gd.x);
        float py;
        lfnoise(yi-iTime-.3+i, py);
        py *= pi;
        mat2 Ry = mat2(cos(py),-sin(py),sin(py),cos(py));
        y = Ry * y;
        vec2 dy;
        lfnoise(yi-iTime+.1*i, dy.x);
        lfnoise(yi-iTime-.1+.1*i, dy.y);
        float size;
        lfnoise(yi-iTime-.2+.1*i, size);
		size *= (3.+2.*gd.x);
        dheart(y-.05*dy, .1+.05*size,db);
        float dhs, dbs, ds;
        stroke(db, .02, dbs);
        d = mix(1., dh, clamp(iTime/5., 0., 1.));
        d = mix(d, db, clamp((iTime-5.)/5.,0.,1.));
        d = mix(d, dbs, .5*clamp((iTime-10.)/5.,0.,1.));
        vec3 c1;
        float scale;
        lfnoise(.3*iTime*c.xx+yi+.01*i, scale);
        scale = .5+.5*scale;
        color(scale,c1);
        
        col = mix(col, mix(col,c1,.5), smoothstep(1.5/iResolution.y, -1.5/iResolution.y,d));
		
        float dbss;
        stroke(dbs, .005, dbss);
        col = mix(col, mix(col,c1,1.), smoothstep(1.5/iResolution.y, -1.5/iResolution.y,dbss));
    	
        mat3 RR;
        vec3 rrt;
        lfnoise(yi + .01*i + .3*iTime*c.xx, rrt.x);
        lfnoise(yi + .005*i + .3*1.1*iTime*c.xx, rrt.y);
        lfnoise(yi + .02*i + .3*1.2*iTime*c.xx, rrt.z);
        rot(.3*rrt-.05*vec3(1.3,1.41,1.66)*iTime, RR);

        col = abs(RR*col);
        
        float dvs;
        stroke(dv,.01,dvs);
        dvs = .1-dvs;
        col = mix(col, mix(col,c1,.22), smoothstep(1.5/iResolution.y, -1.5/iResolution.y,dvs));
        col = mix(col, mix(col,c.yyy,.12), smoothstep(1.5/iResolution.y, -1.5/iResolution.y,-abs(dvs)+.1));
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    a = iResolution.x/iResolution.y;
    vec2 uv = fragCoord/iResolution.yy-0.5*vec2(a, 1.0);
    vec3 col = c.yyy;
    
    uv -= .3*iTime*c.yx;
    
    colorize(uv,col);
    
    vec3 ddd;
    rand(uv-iTime*c.xx, ddd.x);
    rand(uv-iTime*c.xx, ddd.y);
    rand(uv-iTime*c.xx, ddd.z);
    col -=.1*ddd;
    
    col = clamp(col, 0.,1.);
    
    fragColor = vec4(col,1.0);
}

void main()
{
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
