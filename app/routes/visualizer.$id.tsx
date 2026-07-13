import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { generate3DView } from '../../lib/ai.action';
import { getProjectById } from '../../lib/puter.action';
import { Box, Download, RefreshCcw, X } from 'lucide-react';
import Button from '../../components/ui/Button';

const VisualizerId = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeId = params.id;
  const locationState = (location.state as VisualizerLocationState | null | undefined) ?? {};

  const [editorState, setEditorState] = useState<VisualizerLocationState>({
    initialImage: locationState.initialImage,
    initialRender: locationState.initialRender ?? null,
    name: locationState.name ?? null,
  });

  const hasInitialGenerated = useRef(false);

  const [isProcessing, setisProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(locationState.initialRender ?? null);

  const initialImage = editorState.initialImage;
  const initialRender = editorState.initialRender;
  const projectName = editorState.name || 'Untitled Project';

  const handleBack = () => navigate('/');

  const runGeneration = async () => {
    if(!initialImage) return;

    try {
      setisProcessing(true);
      const result = await generate3DView({ sourceImage: initialImage });

      if (result?.renderedImage) {
        setCurrentImage(result.renderedImage);
      }
    } catch (error) {
        console.error('Generation failed: ', error);
    } finally {
        setisProcessing(false);
    }
  }

  useEffect(() => {
    if (locationState.initialImage && locationState.initialImage !== editorState.initialImage) {
      setEditorState((prev) => ({
        ...prev,
        initialImage: locationState.initialImage,
        initialRender: locationState.initialRender ?? prev.initialRender ?? null,
        name: locationState.name ?? prev.name ?? null,
      }));
    }
  }, [locationState.initialImage, locationState.initialRender, locationState.name, editorState.initialImage]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromRoute = async () => {
      if (!routeId) return;

      const project = await getProjectById(routeId);
      if (cancelled || !project) return;

      setEditorState((prev) => ({
        ...prev,
        initialImage: prev.initialImage || project.sourceImage,
        initialRender: prev.initialRender ?? project.renderedImage ?? null,
        name: prev.name || project.name || null,
      }));

      setCurrentImage((current) => current ?? project.renderedImage ?? null);
    };

    hydrateFromRoute();

    return () => {
      cancelled = true;
    };
  }, [routeId]);

  useEffect(() => {
    if (!initialImage || hasInitialGenerated.current) return;

    if (initialRender) {
      setCurrentImage(initialRender);
      hasInitialGenerated.current = true;
      return;
    }

    hasInitialGenerated.current = true;
    runGeneration();
  }, [initialImage, initialRender]);

  return (
      <div className="visualizer">
        <nav className="topbar">
            <div className="brand">
               <Box className ="logo" />

                      <span className="name">
                            Planorama
                      </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
              <X className="icon" /> Exit Editor
            </Button>
        </nav>

        <section className="content">
          <div className="panel">
             <div className="panel-header">
                  <div className="panel-meta">
                        <p>Project</p>
                        <h2>{projectName}</h2>
                        <p className="note">Created by You</p>
                  </div>

                  <div className="panel-actions">
                        <Button
                          size="sm"
                          onClick={( ) => {}}
                          className="export"
                          disabled={!currentImage}
                        >
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                  </div>
             </div>

             <div className={`render-area ${isProcessing ? 'is-processing' : ''}`}>
              {currentImage ? (
                <img src={currentImage} alt="AI Render" className="render-img" />
              ) : (
                <div className="render-placeholder">
                  {initialImage && (
                    <img src={initialImage} alt="Original" className="render-fallback" />
                  )}

                  {isProcessing && (
                    <div className="render-overlay">
                        <div className="rendering-card">
                            <RefreshCcw className="spinner"/>
                            <span className="title">Rendering...</span>
                            <span className="subtitle">Generating your 3D visualization...</span>
                        </div>
                    </div>
                  )}
                </div>
              )}
             </div>
          </div>
        </section>
      </div>
  )
}

export default VisualizerId