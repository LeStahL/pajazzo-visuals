/* Pajazzo Urban Flow Visuals
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
vec2 offset = c.yy,
    size = vec2(.1,.05),
    per_stone_offset = .01*c.xx;

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

// (c) 2014 Inigo Quilez (iq); https://www.shadertoy.com/view/XsXSz4
// License: MIT
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// Signed distance to a 2D triangle
void dtriangle( in vec2 p0, in vec2 p1, in vec2 p2, in vec2 p, out float dst)
{
    vec2 e0 = p1 - p0;
    vec2 e1 = p2 - p1;
    vec2 e2 = p0 - p2;

    vec2 v0 = p - p0;
    vec2 v1 = p - p1;
    vec2 v2 = p - p2;

    vec2 pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0.0, 1.0 );
    vec2 pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0.0, 1.0 );
    vec2 pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0.0, 1.0 );
    
    float s = sign( e0.x*e2.y - e0.y*e2.x );
    vec2 d = min( min( vec2( dot( pq0, pq0 ), s*(v0.x*e0.y-v0.y*e0.x) ),
                    vec2( dot( pq1, pq1 ), s*(v1.x*e1.y-v1.y*e1.x) )),
                    vec2( dot( pq2, pq2 ), s*(v2.x*e2.y-v2.y*e2.x) ));

    dst = -sqrt(d.x)*sign(d.y);
}
// End of (c) 2014 Inigo Quilez (iq); https://www.shadertoy.com/view/XsXSz4

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

void scene(in vec3 x, out vec2 d)
{
    vec3 y = vec3(mod(offset + x.xy, 2.*size-per_stone_offset)
                -size-.5*per_stone_offset, x.z);
    vec2 ind = (x-y).xy/(2.*size-per_stone_offset);
    float dv;
    vec2 vi;
    dvoronoi(x.xy/size*.5, dv, vi);
    ind = mix(ind, vi, clamp((iTime-70.)/5., 0., 1.));
    float ra;
    lfnoise(ind-iTime, ra);
    ra = .5+.5*ra;
    float dd;
    dbox(y.xy, size, dd);
    
    stroke(dv, .05, dv);
    //dv *= 15.;
    dd = mix(dd, -dv, clamp((iTime-70.)/5., 0., 1.));
    d.x = mix(dd, length(y.xy)-.5*min(size.x,size.y), clamp((iTime-40.)/5., 0.,1.));
    d.x = mix(d.x, dd, clamp((iTime-60.)/5., 0.,1.));
    
    zextrude(x.z, -d.x,mix(0.,.25*ra,clamp((iTime-25.)/5., 0.,1.)), d.x);
    d.y = 1.;
    
    // Add guard objects for debugging
    float dr = .05;
    y = mod(x,dr)-.5*dr;
    float guard = -length(max(abs(y)-vec3(.5*dr*c.xx, .6),0.));
    guard = abs(guard)+dr*.1;
    d.x = min(d.x, guard);
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

void colorize(in vec2 uv, out vec3 col)
{
    vec2 origin = .5*vec2(cos(iTime),sin(iTime)),
        x = mod(offset + uv, 2.*size-per_stone_offset)-size-.5*per_stone_offset,
        dx,
        xind = (uv - x) / (size+.5*per_stone_offset);
    vec2 vi;
    float dv;
        dvoronoi(uv.xy/size*.5, dv, vi);
        xind = mix(xind, vi, clamp((iTime-70.)/5., 0., 1.));
    lfnoise(xind+.1, dx.x);
    lfnoise(xind+.12, dx.y);
    
    vec4 sdf = c.xyyy;
    
    // Add background glow effect entry
    {
        float scale;
        vec2 da;
        mfnoise(uv-.4*iTime*c.xy, 14., 144., .45, da.x);
        mfnoise(uv-.1*iTime*c.xy, 14., 144., .45, da.y);
        lfnoise(14.*uv-4.*iTime*c.xy -da, scale);

        scale *= mix(0., 1., clamp(iTime/5.,0.,1.));
                float dv;
        

        dbox(x, size, sdf.x);
        sdf.x = -sdf.x;
        vec3 ca;
        color(clamp(-.8+1.9*scale,0.,1.),ca);
        sdf.gba = mix(ca, ca.gbr, clamp((iTime-10.)/5., 0., 1.));

        vec4 sda, sdb;
        lfnoise(xind-iTime, scale);
        dbox(x, size, sda.x);
        sda.x = mix(sda.x, dv, clamp((iTime-70.)/5., 0., 1.));
        color(.5+.5*sin(20.*2.*pi*sda.x/max(size.x,size.y)), ca);
        sda.gba = mix(ca, ca.gbr, clamp((iTime-10.)/5., 0., 1.));
        add(sdf, sda, sda);
        
        sdf = mix(sdf, sda, clamp((iTime-15.)/5.*step(scale,0.), 0., 1.));
        
        sda.x = sdf.x;
        sda.gba = mix(sdf.gba, sdf.agb, dx.x);
        sdf = mix(sdf, sda, clamp((iTime-20.)/5.*step(scale,0.), 0., 1.));
        
        //sda.x = sdf.x;
        //sda.gba = mix(sdf.agb, sdf.gab, dx.x);
        //sdf = mix(sdf, sda, clamp((iTime-25.)/5., 0., 1.)*step(scale,0.));
    }    
    col = sdf.gba*step(sdf.x,0.);
    
    mat3 RR;
    vec3 rrt;
    lfnoise(xind + iTime*c.xx, rrt.x);
    lfnoise(xind + 1.1*iTime*c.xx, rrt.y);
    lfnoise(xind + 1.2*iTime*c.xx, rrt.z);
    rot(.4*rrt-.3*vec3(1.3,1.41,1.66)*iTime, RR);
    col = abs(RR *col);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    a = iResolution.x/iResolution.y;
    vec2 uv = fragCoord/iResolution.yy-0.5*vec2(a, 1.0);
    vec3 col = c.yyy;
    
    vec2 dx;
    lfnoise(uv+.1-iTime*c.xy, dx.x);
    lfnoise(uv+.12-iTime*c.yx, dx.y);
    uv += mix(c.yy,.1*dx, clamp((iTime-45.)/5.,0.,1.));
    
    size *= mix(1., .5, clamp((iTime-30.)/5.,0.,1.));
    float la;
    lfnoise(c.xx+.5*iTime, la);
    size += size*mix(0., .5*la, clamp((iTime-110.)/5.,0.,1.));
    
    colorize(uv, col);
    if(iTime > 25.) // Raymarch blocks
    {
        vec3 o = c.yyx+mix(c.yyy,-1.*c.yxy,clamp((iTime-50.)/5.,0.,1.)), dir = normalize(vec3(uv,0.)-o), y;
        float da = (.25-o.z)/dir.z;
        vec2 s;
        int N = 100, i;
        for(i=0; i<N; ++i)
        {
            y = o + da * dir;
            scene(y, s);
            if(s.x < 1.e-3) break;
            //if(y.z < 0.) break;
            da += s.x;
        }
        if(i < N)
        {
            vec3 n, l = normalize(y+c.yyx);
            normal(y, n);
            vec3 ci;
            colorize(y.xy, ci);
            col = mix(col, ci, clamp((iTime-25.)/5.,0.,1.));
            ci = .3*c.xxx
                + .3*c.yyx*abs(dot(l,n))
                + .3*c.xyx*pow(abs(dot(reflect(-l,n),dir)),3.);
            col = mix(col, .2*c.yyx, clamp(y.z*.5,0.,1.));
            mat3 RR;
            vec3 rrt;
            vec2 x = mod(offset + uv, 2.*size-per_stone_offset)-size-.5*per_stone_offset,
                xind = (uv - x) / (size+.5*per_stone_offset);
            vec2 vi;
            float dv;
            dvoronoi(y.xy/size*.5, dv, vi);
            stroke(dv, .1, dv);
            ci = mix(ci, .2*ci, step(dv,0.)*clamp((iTime-75.)/5.,0.,1.));
            xind = mix(xind, vi, clamp((iTime-70.)/5., 0., 1.));
            lfnoise(xind + iTime*c.xx, rrt.x);
            lfnoise(xind + 1.1*iTime*c.xx, rrt.y);
            lfnoise(xind + 1.2*iTime*c.xx, rrt.z);
            rot(.4*rrt-.3*vec3(1.3,1.41,1.66)*iTime, RR);
            col += abs(RR *ci);
        }
    }
    
    
    // 1: Show pattern only in stone borders
    // 2: Show party lights on stones
    // 3: Show rays that make party lights
    // 4: Move stones onto each other
    // 5: Make stones 3D and bounce
    // 6: Add fractal stuff
    
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
