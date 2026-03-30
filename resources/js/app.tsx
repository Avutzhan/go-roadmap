import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import RoadmapApp from './RoadmapApp';

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <RoadmapApp />
        </React.StrictMode>
    );
}
