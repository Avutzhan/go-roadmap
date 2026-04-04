<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>curly labs</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        <!-- Styles / Scripts -->
        @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
            @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @else
            <!-- Fallback standard tailwind if vite isn't loaded -->
            <script src="https://cdn.tailwindcss.com"></script>
        @endif
    </head>
    <body class="bg-[#FDFDFC] dark:bg-[#0a0a0a] text-[#1b1b18] flex p-6 lg:p-8 items-center lg:justify-center min-h-screen flex-col">
        <header class="w-full lg:max-w-5xl max-w-[335px] text-sm mb-6">
            <nav class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex flex-col sm:flex-row gap-3">
                    <a href="{{ url('/roadmap') }}" class="inline-block px-5 py-2 bg-[#fbbf24] text-black font-black border-2 border-slate-900 rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,0)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all text-sm uppercase text-center">
                        🎓 Go Backend
                    </a>
                    <a href="{{ url('/arabic-roadmap') }}" class="inline-block px-5 py-2 bg-[#4ade80] text-black font-black border-2 border-slate-900 rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,0)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all text-sm uppercase text-center">
                        🕌 Classic Arabic
                    </a>
                    <a href="{{ url('/new-school-roadmap') }}" class="inline-block px-5 py-2 bg-[#60a5fa] text-black font-black border-2 border-slate-900 rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,0)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all text-sm uppercase text-center">
                        🕋 New School Arabic
                    </a>
                </div>
                
                @if (Route::has('login'))
                    <div class="flex items-center justify-end gap-4">
                        @auth
                            <a
                                href="{{ url('/dashboard') }}"
                                class="inline-block px-5 py-1.5 dark:text-[#EDEDEC] border-[#19140035] hover:border-[#1915014a] border text-[#1b1b18] dark:border-[#3E3E3A] dark:hover:border-[#62605b] rounded-sm text-sm leading-normal"
                            >
                                Dashboard
                            </a>
                        @else
                            <a
                                href="{{ route('login') }}"
                                class="inline-block px-5 py-1.5 dark:text-[#EDEDEC] text-[#1b1b18] border border-transparent hover:border-[#19140035] dark:hover:border-[#3E3E3A] rounded-sm text-sm leading-normal"
                            >
                                Log in
                            </a>
    
                            @if (Route::has('register'))
                                <a
                                    href="{{ route('register') }}"
                                    class="inline-block px-5 py-1.5 dark:text-[#EDEDEC] border-[#19140035] hover:border-[#1915014a] border text-[#1b1b18] dark:border-[#3E3E3A] dark:hover:border-[#62605b] rounded-sm text-sm leading-normal">
                                    Register
                                </a>
                            @endif
                        @endauth
                    </div>
                @endif
            </nav>
        </header>

        <div class="flex items-center justify-center w-full transition-opacity opacity-100 duration-750 lg:grow px-4">
            <main class="w-full max-w-5xl relative overflow-hidden rounded-3xl border-4 border-slate-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] min-h-[500px] flex items-center justify-center bg-slate-900">
                <style>
                    @keyframes blob {
                      0% { transform: translate(0px, 0px) scale(1); }
                      33% { transform: translate(30px, -50px) scale(1.1); }
                      66% { transform: translate(-20px, 20px) scale(0.9); }
                      100% { transform: translate(0px, 0px) scale(1); }
                    }
                    .animate-blob { animation: blob 7s infinite; }
                    .animation-delay-2000 { animation-delay: 2s; }
                    .animation-delay-4000 { animation-delay: 4s; }
                </style>
                <!-- Animated blob background -->
                <div class="absolute top-0 -left-4 w-96 h-96 bg-[#8b5cf6] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob"></div>
                <div class="absolute top-0 -right-4 w-96 h-96 bg-[#facc15] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                <div class="absolute -bottom-8 left-20 w-96 h-96 bg-[#ec4899] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
                
                <div class="relative z-10 flex flex-col items-center bg-slate-900/60 p-12 rounded-[2.5rem] backdrop-blur-md border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] text-center">
                    <h1 class="text-6xl md:text-[8rem] leading-tight font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-violet-300 via-fuchsia-400 to-yellow-300 drop-shadow-lg lowercase hover:scale-105 transition-transform duration-500 cursor-default mb-2 select-none">
                        curly labs
                    </h1>
                    <p class="text-white mt-4 px-6 py-2 bg-white/10 rounded-full border border-white/20 text-lg md:text-xl font-bold tracking-widest uppercase shadow-inner backdrop-blur-xl">
                        Learning Ecosystem
                    </p>
                </div>
            </main>
        </div>

        <footer class="w-full lg:max-w-5xl max-w-[335px] text-sm mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-2">
                <span class="text-slate-500 font-medium">Laravel v{{ app()->version() }}</span>
                <span class="text-slate-300">•</span>
                <span class="text-slate-500">PHP v{{ PHP_VERSION }}</span>
            </div>
            <div class="text-slate-500 font-medium">Build fast, scale gracefully.</div>
        </footer>
    </body>
</html>
