import { HashRouter, Routes, Route } from "react-router-dom";
import Sources from "./screens/Sources";
import Detail from "./screens/Detail";
import Reader from "./screens/Reader";

export default function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Sources />} />
                <Route path="/comic/:source/:comicId" element={<Detail />} />
                <Route path="/reader/:source/:comicId/:chapterIndex" element={<Reader />} />
            </Routes>
        </HashRouter>
    );
}
