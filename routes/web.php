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

    Route::get('/api/progress', function (\Illuminate\Http\Request $request) {
        $prefix = $request->query('prefix', '');

        $query = DB::table('user_nodes_progress')->where('completed', true);
        if ($prefix) {
            $query->where('node_id', 'like', $prefix . '%');
        } else {
            $query->whereNot('node_id', 'like', 'ar_%')
                  ->whereNot('node_id', 'like', 'ns_%');
        }

        return response()->json($query->pluck('node_id'));
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

    Route::post('/api/progress/bulk', function (\Illuminate\Http\Request $request) {
        $action = $request->input('action');
        $prefix = $request->input('prefix', '');

        if ($action === 'uncheck_all') {
            if ($prefix) {
                 DB::table('user_nodes_progress')->where('node_id', 'like', $prefix . '%')->delete();
            } else {
                 DB::table('user_nodes_progress')
                   ->whereNot('node_id', 'like', 'ar_%')
                   ->whereNot('node_id', 'like', 'ns_%')
                   ->delete();
            }
        } else if ($action === 'check_all') {
            $node_ids = $request->input('node_ids', []);
            
            if ($prefix) {
                 DB::table('user_nodes_progress')->where('node_id', 'like', $prefix . '%')->delete();
            } else {
                 DB::table('user_nodes_progress')
                   ->whereNot('node_id', 'like', 'ar_%')
                   ->whereNot('node_id', 'like', 'ns_%')
                   ->delete();
            }

            $data = [];
            foreach ($node_ids as $id) {
                $data[] = ['node_id' => $id, 'completed' => true, 'updated_at' => now()];
            }
            foreach (array_chunk($data, 100) as $chunk) {
                DB::table('user_nodes_progress')->insert($chunk);
            }
        }

        return response()->json(['success' => true]);
    });

});

Route::get('/arabic-roadmap', function () {
    return view('arabic-roadmap');
});

Route::get('/new-school-roadmap', function () {
    return view('new-school-roadmap');
});
