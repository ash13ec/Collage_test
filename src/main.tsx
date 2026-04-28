import './styles.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App, { starterLayers } from './App';

function Root() {
  const initialLayers = starterLayers();
  const [layers, setLayers] = useState(initialLayers);
  const [selectedId, setSelectedId] = useState(initialLayers.at(-1)?.id ?? '');

  return (
    <App
      layers={layers}
      selectedId={selectedId}
      setLayers={setLayers}
      setSelectedId={setSelectedId}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
