import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import RoadmapApp from './RoadmapApp';
import rawRoadmap from './roadmapData.json';
import arabicRoadmapData from './roadmapArabicData.json';
import newSchoolRoadmapData from './roadmapNewSchoolData.json';

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <RoadmapApp 
                roadmapData={rawRoadmap} 
                title="Roadmap" 
                badge="Go Backend"
                subtitle="Complete path to Senior Level (150+ Deep Topics & Hand-crafted files)"
                prefix=""
            />
        </React.StrictMode>
    );
}

const arabicContainer = document.getElementById('arabic-app');
if (arabicContainer) {
    const root = createRoot(arabicContainer);
    root.render(
        <React.StrictMode>
            <RoadmapApp 
                roadmapData={arabicRoadmapData}
                title="Roadmap"
                badge="Classic Arabic"
                subtitle="Complete path to Arabic fluency (Classical methods & Texts)"
                prefix="ar_"
            />
        </React.StrictMode>
    );
}

const newSchoolContainer = document.getElementById('new-school-app');
if (newSchoolContainer) {
    const root = createRoot(newSchoolContainer);
    root.render(
        <React.StrictMode>
            <RoadmapApp 
                roadmapData={newSchoolRoadmapData}
                title="Roadmap"
                badge="New School Arabic"
                subtitle="Modern & Practical Arabic (Reading, Speech, Common Scenarios)"
                prefix="ns_"
            />
        </React.StrictMode>
    );
}
