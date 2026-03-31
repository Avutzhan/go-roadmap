<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

// Automatically spin up MVP SQLite Database and Progress Table
if (!file_exists(database_path('database.sqlite'))) {
    touch(database_path('database.sqlite'));
}

try {
    if (!Schema::hasTable('user_nodes_progress')) {
        Schema::create('user_nodes_progress', function (Blueprint $table) {
            $table->id();
            $table->string('node_id')->unique();
            $table->boolean('completed')->default(false);
            $table->timestamps();
        });
    }
} catch (\Exception $e) { }

Route::get('/', function () {
    return view('welcome');
});

Route::get('/roadmap', function () {
    return view('roadmap');
});

// Bypass CSRF for MVP APIs
Route::withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class])->group(function() {

    Route::get('/api/progress', function () {
        return response()->json(
            DB::table('user_nodes_progress')->where('completed', true)->pluck('node_id')
        );
    });

    Route::post('/api/progress', function (\Illuminate\Http\Request $request) {
        $node_id = $request->input('node_id');
        $completed = $request->input('completed', true);

        DB::table('user_nodes_progress')->updateOrInsert(
            ['node_id' => $node_id],
            ['completed' => $completed, 'updated_at' => now()]
        );

        return response()->json(['success' => true]);
    });

});
