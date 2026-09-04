import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen.tsx';
import MapScreen from './screens/MapScreen.tsx';
import WorkshopScreen from './screens/WorkshopScreen.tsx';
import GalleryScreen from './screens/GalleryScreen.tsx';
import ParentScreen from './screens/ParentScreen.tsx';
import CertificateScreen from './screens/CertificateScreen.tsx';

function LessonRoute() {
  const { id } = useParams();
  if (!id) return <Navigate to="/map" replace />;
  return <WorkshopScreen mode={{ kind: 'lesson', lessonId: id }} />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/lesson/:id" element={<LessonRoute />} />
        <Route path="/freeplay" element={<WorkshopScreen mode={{ kind: 'freeplay' }} />} />
        <Route path="/gallery" element={<GalleryScreen />} />
        <Route path="/parent" element={<ParentScreen />} />
        <Route path="/certificate" element={<CertificateScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
