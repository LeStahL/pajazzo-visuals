/* Pajazzo Shapes Visuals
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

// 3D hash function
void rand3(in vec3 x, out vec3 num)
{
    rand(x.x*c.xx, num.x);
    rand(x.y*c.xx, num.y);
    rand(x.z*c.xx, num.z);
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
    const int N = 13;
    const vec3 colors[N] = vec3[N](
        c.yyy,
        vec3(0.15,0.14,0.12),
        vec3(0.38,0.16,0.16),
        vec3(0.42,0.20,0.19),
        vec3(0.60,0.14,0.16),
        vec3(0.70,0.11,0.15),
        vec3(0.89,0.11,0.10),
        vec3(0.89,0.27,0.03),
        vec3(0.92,0.39,0.14),
        vec3(0.91,0.47,0.15),
        vec3(0.92,0.57,0.14),
        vec3(0.90,0.63,0.12),
        vec3(0.92,0.72,0.14)
    );
	float index = floor(scale*float(N)), 
        remainder = scale*float(N)-index;
    col = mix(colors[int(index)],colors[int(index)+1], remainder);
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
            float pa;
            rand(p, pa);
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
            float pa;
            rand(p, pa);
            p += pa;
            
            vec2 o = p - pf;
            d = length(.5*o-dot(x-pf, o)/dot(o,o)*o);
            ret = min(ret, d);
        }
    
    d = ret;
    ind = pf;
}

void dbreak(in vec3 x, out float dst, out vec3 ind)
{
    vec3 y = floor(x);
   	float ret = 10.;
    
    //find closest control point. ("In which cell am I?")
    vec3 pf=c.yyy, p;
    float df=100., d;
    
    p = y ;
                vec3 dp;
                rand3(p,dp);
                p += dp;

                d = length(x-p);
    df = d;
    pf = p;

    
    //compute voronoi distance: minimum distance to any edge
    for(int i=-1; i<=1; i+=1)
        for(int j=-1; j<=1; j+=1)
            for(int k=-1; k<=1; k+=1)
            {
                p = y + vec3(float(i), float(j), float(k));
                vec3 dp;
                rand3(p,dp);
                p += dp;

                vec3 o = p - pf;
                d = abs(.5-dot(x-pf, o)/length(o));
                ret = min(ret, d);
            }
    dst = ret;
    ind = pf;
}

vec3 ind;
void scene(in vec3 x, out vec2 sdf)
{
    mat3 RR;
    rot(.5*x, RR);
    x = mix(x, RR*x, clamp((iTime-15.)/5.,0.,1.));
    
    float iNBeats, iScale;
    lfnoise(c.xx-iTime, iNBeats);
    lfnoise(c.xx-.3*iTime-3.4, iScale);
    iNBeats *= .1;
    mat3 rm;
    rot(.05*vec3(1.,2.,3.)*iTime+iNBeats, rm);
    x = rm*x;
    float size = mix(.4,.4+.3*iScale, clamp((iTime-10.)/5.,0.,1.));
    vec3 y = mod(x, size)-.5*size;
    
    vec2 flet = vec2(atan(y.y,y.x),acos(y.z/length(y)));
    float sdr;
    mfnoise(flet-iTime, 7.e1,7.e3, .45, sdr);
    sdr = mix(0.,sdr, clamp((iTime-30.)/5.,0.,1.));
    
    size -= clamp(.4*sdr*clamp(iScale,0.,1.),-.05,.05);
    
    float vn;
    lfnoise(x.xy-2.-1.*iTime, vn);
    vec4 v = (length(y)-.3*size)*c.xxxx, w;
    float dv;
    dbox(y.xy,.3*size*c.xx,dv);
    zextrude(y.z,-dv,.4*size,dv);
    v.x = mix(v.x, dv,.5+.5*iScale);
    dbreak(2.*x-(.2+.1*iScale)*vn, w.x, w.gba);
    ind = v.gba+.1*w.gba;
    float dd, de;
    stroke(.4*w.x*size,5.e-3+1.e-3*iScale, dd);
    stroke(v.x,1.e-1*size, de);
    float d = max(-dd, de);
    d = max(-length(x)+1., d);
    stroke(d,.001, d);
    sdf = vec2(mix(de, d, (.9+iScale*.1)*clamp((iTime-5.)/5.,0.,1.)), 1.);
}

void normal(in vec3 x, out vec3 n)
{
    const float dx = 5.e-2;
    vec2 s, na;
    
    scene(x,s);
    scene(x+dx*c.xyy, na);
    n.x = na.x;
    scene(x+dx*c.yxy, na);
    n.y = na.x;
    scene(x+dx*c.yyx, na);
    n.z = na.x;
    n = normalize(n-s.x);
}

void stdcolor(in vec2 x, out vec3 col)
{
	col = 0.5 + 0.5*cos(iTime+x.xyx+vec3(0,2,4));
}

void colorize(in vec2 x, out vec3 col)
{
    stdcolor(x,col);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    a = iResolution.x/iResolution.y;
    vec2 uv = fragCoord/iResolution.yy-0.5*vec2(a, 1.0);
    vec3 col = c.yyy;
    
    vec3 o = c.yyx+mix(c.yyy,-1.*c.yxy,clamp((iTime-50.)/5.,0.,1.)), dir = normalize(vec3(uv,0.)-o), y;
        float da = (.25-o.z)/dir.z;
        vec2 s;
        int N = 200, i;
        for(i=0; i<N; ++i)
        {
            y = o + da * dir;
            scene(y, s);
            if(s.x < 1.e-4) break;
            //if(y.z < 0.) break;
            da += s.x;
        }
        if(i < N)
        {
            float ra;
            lfnoise(c.xx-iTime, ra);
            vec3 n, l = normalize(c.yyx+mix(c.yyy, y, .5+.5*ra));
            normal(y, n);
            
            vec2 size = 5.*vec2(.3,.1);
            mat3 RR;
            vec2 vi;
            float dv;
        	dvoronoi((y.xy+y.yz+y.zx)/size*.5, dv, vi);
            stroke(dv, .01/max(size.x,size.y), dv);
            vec2 xind = ind.xy+ind.yz+ind.zx;
            vec3 rrt;
            lfnoise(xind + iTime*c.xx, rrt.x);
            lfnoise(xind + 1.1*iTime*c.xx, rrt.y);
            lfnoise(xind + 1.2*iTime*c.xx, rrt.z);
            rot(.4*rrt-.3*vec3(1.3,1.41,1.66)*iTime, RR);
            
            vec3 ci;
            colorize(y.xy, ci);
           
            ci += .1*ci
                 - 1.3*ci*abs(dot(l,n))
                 + 1.9*ci*pow(abs(dot(reflect(-l,n),dir)),3.);
            col = .5*ci;
            
            ci = mix(ci, .2*ci, step(dv,0.)*clamp((iTime-75.)/5.,0.,1.));
        	xind = mix(xind, vi, clamp((iTime-70.)/5., 0., 1.));
            
            
            col += abs(RR *ci);
            
            col = mix(col, 2.*col, step(length(rrt),.3));
            
            col *= .5;
            
            //col = mix(col, ci, clamp(tanh(1.e-1*da),0.,1.));
        }
    
    vec3 ddd;
    rand(uv-iTime*c.xx, ddd.x);
    rand(uv-iTime*c.xx, ddd.y);
    rand(uv-iTime*c.xx, ddd.z);
    col -=.1*ddd;
    
    col = clamp(col, 0., 1.);
    
    col = mix(c.yyy, col, clamp(iTime/5.,0.,1.));
    
    fragColor = vec4(col,1.0);
}

void main()
{
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
