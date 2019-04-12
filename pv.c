/* Pajazzo Visuals
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

// WIN32 code
const char *demoname = "PV/Team210";
unsigned int muted = 0.;

int _fltused = 0;

#define ABS(x) ((x)<0?(-x):(x))
#define sign(x) ((x)<0?-1.:1.)

#define WIN32_LEAN_AND_MEAN
#define VC_EXTRALEAN
#include <windows.h>
#include "commctrl.h"
#include <mmsystem.h>
#include <Mmreg.h>

#include <GL/gl.h>
#include "glext.h"

// Standard library and CRT rewrite for saving executable size
void *memset(void *ptr, int value, size_t num)
{
    for(int i=num-1; i>=0; i--)
        ((unsigned char *)ptr)[i] = value;
    return ptr;
}

size_t strlen(const char *str)
{
    int len = 0;
    while(str[len] != '\0') ++len;
    return len;
}

void *malloc( unsigned int size )
{
    return GlobalAlloc(GMEM_ZEROINIT, size) ;
}

// TODO: remove
#include <stdio.h>

#include <math.h>

// OpenGL extensions
PFNGLGETPROGRAMIVPROC glGetProgramiv;
PFNGLGETSHADERIVPROC glGetShaderiv;
PFNGLGETSHADERINFOLOGPROC glGetShaderInfoLog;
PFNGLGETPROGRAMINFOLOGPROC glGetProgramInfoLog;
PFNGLCREATESHADERPROC glCreateShader;
PFNGLCREATEPROGRAMPROC glCreateProgram;
PFNGLSHADERSOURCEPROC glShaderSource;
PFNGLCOMPILESHADERPROC glCompileShader;
PFNGLATTACHSHADERPROC glAttachShader;
PFNGLLINKPROGRAMPROC glLinkProgram;
PFNGLUSEPROGRAMPROC glUseProgram;
PFNGLGETUNIFORMLOCATIONPROC glGetUniformLocation;
PFNGLUNIFORM2FPROC glUniform2f;
PFNGLUNIFORM1FPROC glUniform1f;
PFNGLGENFRAMEBUFFERSPROC glGenFramebuffers;
PFNGLBINDFRAMEBUFFERPROC glBindFramebuffer;
PFNGLFRAMEBUFFERTEXTURE2DPROC glFramebufferTexture2D;
PFNGLNAMEDRENDERBUFFERSTORAGEEXTPROC glNamedRenderbufferStorageEXT;
PFNGLUNIFORM1IPROC glUniform1i;
PFNGLACTIVETEXTUREPROC glActiveTexture;


// TODO: remove below
void debug(int shader_handle)
{
    printf("    Debugging shader with handle %d.\n", shader_handle);
    int compile_status = 0;
    glGetShaderiv(shader_handle, GL_COMPILE_STATUS, &compile_status);
    if(compile_status != GL_TRUE)
    {
        printf("    FAILED.\n");
        GLint len;
        glGetShaderiv(shader_handle, GL_INFO_LOG_LENGTH, &len);
        printf("    Log length: %d\n", len);
        GLchar *CompileLog = (GLchar*)malloc(len*sizeof(GLchar));
        glGetShaderInfoLog(shader_handle, len, NULL, CompileLog);
        printf("    Error messages:\n%s\n", CompileLog);
        free(CompileLog);
    }
    else 
        printf("    Shader compilation successful.\n");
}

void debugp(int program)
{
    printf("    Debugging program.\n");
    int compile_status = 0;
    glGetProgramiv(program, GL_LINK_STATUS, &compile_status);
    if(compile_status != GL_TRUE)
    {
        printf("    FAILED.\n");
        GLint len;
        glGetProgramiv(program, GL_INFO_LOG_LENGTH, &len);
        printf("    Log length: %d\n", len);
        GLchar *CompileLog = (GLchar*)malloc(len*sizeof(GLchar));
        glGetProgramInfoLog(program, len, NULL, CompileLog);
        printf("    Error messages:\n%s\n", CompileLog);
        free(CompileLog);
    }
    else 
        printf("    Program linking successful.\n");
}
// TODO: remove above

// Graphics shader globals
int w = 1920, h = 1080,
urban_flow_handle,urban_flow_program,
urban_flow_time_location, urban_flow_resolution_location,
post_handle, post_program, post_resolution_location, 
post_channel0_location, post_fsaa_location;

float fsaa = 25.;

#define duration 12.*60.

// Demo globals
double t_start = 0., 
t_now = 0., 
t_end = duration; // TODO: set to sensible end
int music_block = 0;

// Music shader globals
int sample_rate = 44100, channels = 2;
double duration1 = duration; //3 min running time
float *smusic1;
int music1_size;
float texs = 1024;
int block_size = 1024*1024, 
nblocks1;
unsigned int paused = 0;

HWAVEOUT hWaveOut;
WAVEHDR silence_header = {0, 0, 0, 0, 0, 0, 0, 0 };
double t_paused;

GLuint first_pass_framebuffer = 0, first_pass_texture;

HDC hdc;
HGLRC glrc;
GLenum error;

MSG msg;

DWORD WINAPI LoadUrbanFlowThread(LPVOID lpParam)
{
    #undef VAR_IRESOLUTION
    #undef VAR_ITIME
    #include "gfx/true_love.h"
    #ifndef VAR_IRESOLUTION
    #define VAR_IRESOLUTION "iResolution"
    #endif
    #ifndef VAR_ITIME
    #define VAR_ITIME "iTime"
    #endif
    int urban_flow_size = strlen(true_love_frag),
    urban_flow_handle = glCreateShader(GL_FRAGMENT_SHADER);
    urban_flow_program = glCreateProgram();
    glShaderSource(urban_flow_handle, 1, (GLchar **)&true_love_frag, &urban_flow_size);
    glCompileShader(urban_flow_handle);
    printf("---> Urban Flow shader:\n");
    debug(urban_flow_handle);
    glAttachShader(urban_flow_program, urban_flow_handle);
    glLinkProgram(urban_flow_program);
    printf("---> Urban Flow program:\n");
    debugp(urban_flow_program);
    glUseProgram(urban_flow_program);
    urban_flow_time_location =  glGetUniformLocation(urban_flow_program, VAR_ITIME);
    urban_flow_resolution_location = glGetUniformLocation(urban_flow_program, VAR_IRESOLUTION);
    printf("++++ Urban Flow shader created.\n");
    
    return 0;
}

void quad()
{
    glBegin(GL_QUADS);
    glVertex3f(-1,-1,0);
    glVertex3f(-1,1,0);
    glVertex3f(1,1,0);
    glVertex3f(1,-1,0);
    glEnd();
    glFlush();
}

// Pure opengl drawing code, essentially cross-platform
void draw()
{
    // Render first pass
    glBindFramebuffer(GL_FRAMEBUFFER, first_pass_framebuffer);
    glViewport(0,0,w,h);
    glClear(GL_COLOR_BUFFER_BIT);
    
    float t = t_now;
    glUseProgram(urban_flow_program);
    glUniform1f(urban_flow_time_location, t);
    glUniform2f(urban_flow_resolution_location, w, h);
    
    quad();
    
    // Render second pass (Post processing) to screen
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glClear(GL_COLOR_BUFFER_BIT);
    glViewport(0,0,w,h);
    
    glUseProgram(post_program);
    glUniform2f(post_resolution_location, w, h);
    glUniform1f(post_fsaa_location, fsaa);
    glUniform1i(post_channel0_location, 0);
    
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, first_pass_texture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, 0);
    
    quad();
    
    glBindTexture(GL_TEXTURE_2D, 0);
}

LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
{
    switch(uMsg)
    {
        case WM_KEYDOWN:
            switch(wParam)
            {
                case VK_ESCAPE:
                    ExitProcess(0);
                    break;
                case VK_SPACE:
                    // pause/unpaused render timer
                    paused = !paused;
                    if(paused)
                        waveOutPause(hWaveOut);
                    else
                        waveOutRestart(hWaveOut);
                    break;
            }
            break;
            
                case WM_RBUTTONDOWN:
                    ExitProcess(0);
                    break;
                    
                default:
                    break;
                    
    }
    return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

int WINAPI demo(HINSTANCE hInstance, HINSTANCE hPrevInstance, PWSTR pCmdLine, int nCmdShow)
{
    //TODO: remove
    AllocConsole();
    freopen("CONIN$", "r", stdin);
    freopen("CONOUT$", "w", stdout);
    freopen("CONOUT$", "w", stderr);
    
    // Display demo window
    CHAR WindowClass[]  = "Team210 Demo Window";
    
    WNDCLASSEX wc = { 0 };
    wc.cbSize = sizeof(wc);
    wc.style = CS_OWNDC | CS_VREDRAW | CS_HREDRAW;
    wc.lpfnWndProc = &WindowProc;
    wc.cbClsExtra = 0;
    wc.cbWndExtra = 0;
    wc.hInstance = hInstance;
    wc.hIcon = LoadIcon(NULL, IDI_WINLOGO); 
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = NULL;
    wc.lpszMenuName = NULL;
    wc.lpszClassName = WindowClass;
    wc.hIconSm = NULL;
    
    RegisterClassEx(&wc);
    
    // Get full screen information
    HMONITOR hmon = MonitorFromWindow(0, MONITOR_DEFAULTTONEAREST);
    MONITORINFO mi = { sizeof(mi) };
    GetMonitorInfo(hmon, &mi);
    
    // Create the window.
    HWND hwnd = CreateWindowEx(
        0,                                                          // Optional window styles.
        WindowClass,                                                // Window class
        ":: NR4^QM/Team210 :: GO - MAKE A DEMO ::",                                 // Window text
        WS_POPUP | WS_VISIBLE,                                      // Window style
        mi.rcMonitor.left,
        mi.rcMonitor.top,
        mi.rcMonitor.right - mi.rcMonitor.left,
        mi.rcMonitor.bottom - mi.rcMonitor.top,                     // Size and position
        
        NULL,                                                       // Parent window    
        NULL,                                                       // Menu
        hInstance,                                                  // Instance handle
        0                                                           // Additional application data
    );
    
    // Show it
    ShowWindow(hwnd, TRUE);
    UpdateWindow(hwnd);
    
    // Create OpenGL context
    PIXELFORMATDESCRIPTOR pfd =
    {
        sizeof(PIXELFORMATDESCRIPTOR),
        1,
        PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER,    //Flags
        PFD_TYPE_RGBA,        // The kind of framebuffer. RGBA or palette.
        32,                   // Colordepth of the framebuffer.
        0, 0, 0, 0, 0, 0,
        0,
        0,
        0,
        0, 0, 0, 0,
        24,                   // Number of bits for the depthbuffer
        8,                    // Number of bits for the stencilbuffer
        0,                    // Number of Aux buffers in the framebuffer.
        PFD_MAIN_PLANE,
        0,
        0, 0, 0
    };
    
    hdc = GetDC(hwnd);
    
    int  pf = ChoosePixelFormat(hdc, &pfd); 
    SetPixelFormat(hdc, pf, &pfd);
    
    glrc = wglCreateContext(hdc);
    wglMakeCurrent (hdc, glrc);
    
    // OpenGL extensions
    glGetProgramiv = (PFNGLGETPROGRAMIVPROC) wglGetProcAddress("glGetProgramiv");
    glGetProgramInfoLog = (PFNGLGETPROGRAMINFOLOGPROC) wglGetProcAddress("glGetProgramInfoLog");
    glGetShaderiv = (PFNGLGETSHADERIVPROC) wglGetProcAddress("glGetShaderiv");
    glGetShaderInfoLog = (PFNGLGETSHADERINFOLOGPROC) wglGetProcAddress("glGetShaderInfoLog");
    glCreateShader = (PFNGLCREATESHADERPROC) wglGetProcAddress("glCreateShader");
    glCreateProgram = (PFNGLCREATEPROGRAMPROC) wglGetProcAddress("glCreateProgram");
    glShaderSource = (PFNGLSHADERSOURCEPROC) wglGetProcAddress("glShaderSource");
    glCompileShader = (PFNGLCOMPILESHADERPROC) wglGetProcAddress("glCompileShader");
    glAttachShader = (PFNGLATTACHSHADERPROC) wglGetProcAddress("glAttachShader");
    glLinkProgram = (PFNGLLINKPROGRAMPROC) wglGetProcAddress("glLinkProgram");
    glUseProgram = (PFNGLUSEPROGRAMPROC) wglGetProcAddress("glUseProgram");
    glGetUniformLocation = (PFNGLGETUNIFORMLOCATIONPROC) wglGetProcAddress("glGetUniformLocation");
    glUniform2f = (PFNGLUNIFORM2FPROC) wglGetProcAddress("glUniform2f");
    glUniform1f = (PFNGLUNIFORM1FPROC) wglGetProcAddress("glUniform1f");
    glGenFramebuffers = (PFNGLGENFRAMEBUFFERSPROC) wglGetProcAddress("glGenFramebuffers");
    glBindFramebuffer = (PFNGLBINDFRAMEBUFFERPROC) wglGetProcAddress("glBindFramebuffer");
    glFramebufferTexture2D = (PFNGLFRAMEBUFFERTEXTURE2DPROC) wglGetProcAddress("glFramebufferTexture2D");
    glNamedRenderbufferStorageEXT = (PFNGLNAMEDRENDERBUFFERSTORAGEEXTPROC) wglGetProcAddress("glNamedRenderbufferStorage");
    glActiveTexture = (PFNGLACTIVETEXTUREPROC) wglGetProcAddress("glActiveTexture");
    glUniform1i = (PFNGLUNIFORM1IPROC) wglGetProcAddress("glUniform1i");
    
    // Load post processing shader
    printf("++++ Creating Post Shader.\n");
    #undef VAR_IFSAA
    #undef VAR_IRESOLUTION
    #undef VAR_ICHANNEL0
    #include "gfx/post.h"
    #ifndef VAR_IFSAA
    #define VAR_IFSAA "iFSAA"
    #endif
    #ifndef VAR_IRESOLUTION
    #define VAR_IRESOLUTION "iResolution"
    #endif
    #ifndef VAR_ICHANNEL0
    #define VAR_ICHANNEL0 "iChannel0"
    #endif
    int post_size = strlen(post_frag),
    post_handle = glCreateShader(GL_FRAGMENT_SHADER);
    post_program = glCreateProgram();
    glShaderSource(post_handle, 1, (GLchar **)&post_frag, &post_size);
    glCompileShader(post_handle);
    printf("---> Post shader:\n");
    debug(post_handle);
    glAttachShader(post_program, post_handle);
    glLinkProgram(post_program);
    printf("---> Post Program:\n");
    debugp(post_program);
    glUseProgram(post_program);
    post_channel0_location = glGetUniformLocation(post_program, VAR_ICHANNEL0);
    post_fsaa_location = glGetUniformLocation(post_program, VAR_IFSAA);
    post_resolution_location = glGetUniformLocation(post_program, VAR_IRESOLUTION);
    printf("++++ Post shader created.\n");
    
    // Create framebuffer for rendering first pass to
    glGenFramebuffers(1, &first_pass_framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, first_pass_framebuffer);
    glGenTextures(1, &first_pass_texture);
    glBindTexture(GL_TEXTURE_2D, first_pass_texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, 0);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, first_pass_texture, 0);
    glDrawBuffer(GL_COLOR_ATTACHMENT0);
    
    // Music allocs
    nblocks1 = sample_rate*duration1/block_size+1;
    music1_size = nblocks1*block_size; 
    smusic1 = (float*)malloc(4*music1_size);
    short *dest = (short*)smusic1;
    for(int i=0; i<2*music1_size; ++i)
        dest[i] = 0;
    
    draw();
    SwapBuffers(hdc);
    
    LoadUrbanFlowThread(0);
    draw();
    SwapBuffers(hdc);
    
    hWaveOut = 0;
    int n_bits_per_sample = 16;
    WAVEFORMATEX wfx = { WAVE_FORMAT_PCM, channels, sample_rate, sample_rate*channels*n_bits_per_sample/8, channels*n_bits_per_sample/8, n_bits_per_sample, 0 };
    waveOutOpen(&hWaveOut, WAVE_MAPPER, &wfx, 0, 0, CALLBACK_NULL);
    
    WAVEHDR header = { smusic1, 4*music1_size, 0, 0, 0, 0, 0, 0 };
    waveOutPrepareHeader(hWaveOut, &header, sizeof(WAVEHDR));
    waveOutWrite(hWaveOut, &header, sizeof(WAVEHDR));
    
    // Main loop
    t_start = 0.;
    while(1)
    {
        while ( PeekMessageA( &msg, NULL, 0, 0, PM_REMOVE ) ) 
        {
            if ( msg.message == WM_QUIT ) {
                return 0;
            }
            TranslateMessage( &msg );
            DispatchMessageA( &msg );
        }
        
        static MMTIME MMTime = { TIME_SAMPLES, 0};
        waveOutGetPosition(hWaveOut, &MMTime, sizeof(MMTIME));
        t_now = ((double)MMTime.u.sample)/( 44100.0);
        
        draw();
        SwapBuffers(hdc);
        
    }
    return msg.wParam;
}

