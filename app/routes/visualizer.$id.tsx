import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { generate3DView } from '../../lib/ai.action';
import { createProject, getProjectsById } from '../../lib/puter.action';
import { Box, Download, RefreshCcw, X } from 'lucide-react';
import Button from '../../components/ui/Button';

const VisualizerId = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useOutletContext<AuthContext>()
  const routeId = id;
  const locationState = (location.state as VisualizerLocationState | null | undefined) ?? {};

  const [editorState, setEditorState] = useState<VisualizerLocationState>({
    initialImage: locationState.initialImage,
    initialRender: locationState.initialRender ?? null,
    name: locationState.name ?? null,
  });

  const hasInitialGenerated = useRef(false);

  const [project, setProject] = useState<DesignItem | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  const [isProcessing, setisProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(locationState.initialRender ?? null);

  const initialImage = editorState.initialImage;
  const initialRender = editorState.initialRender;
  const projectName = editorState.name || 'Untitled Project';

  const handleBack = () => navigate('/');

  const runGeneration = async (item: DesignItem) => {
    if(!id || !item.sourceImage) return;

    try {
      setisProcessing(true);
      const result = await generate3DView({ sourceImage: item.sourceImage });

      if (result?.renderedImage) {
        setCurrentImage(result.renderedImage);
        
        const updatedItem = {
          ...item,
          renderedImage: result.renderedImage,
          renderedPath: result.renderedPath,
          timestamp: Date.now(),
          ownerId: item.ownerId ?? userId ?? null,
          isPublic: item.isPublic ?? false,
        }

        const saved = await createProject({ item: updatedItem, visibility: "private" })

        if(saved){
          setProject(saved);
          setCurrentImage(saved.renderedImage || result.renderedImage);
        }
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

      const existing = await getProjectsById({ id: routeId });
      if (cancelled || !existing) return;

      setEditorState((prev) => ({
        ...prev,
        initialImage: prev.initialImage || existing.sourceImage,
        initialRender: prev.initialRender ?? existing.renderedImage ?? null,
        name: prev.name || existing.name || null,
      }));

      setCurrentImage((current) => current ?? existing.renderedImage ?? null);
    };

    hydrateFromRoute();

    return () => {
      cancelled = true;
    };
  }, [routeId]);

  useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      if (!id) {
        setIsProjectLoading(false);
        return;
      }

      setIsProjectLoading(true);

      const fetchedProject = await getProjectsById({ id });

      if (!isMounted) return;

      setProject(fetchedProject);
      setCurrentImage(fetchedProject?.renderedImage || null);
      setIsProjectLoading(false);
      hasInitialGenerated.current = false;
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (
      isProjectLoading ||
      hasInitialGenerated.current ||
      !project?.sourceImage
    )
      return;

    if (project.renderedImage) {
      setCurrentImage(project.renderedImage);
      hasInitialGenerated.current = true;
      return;
    }

    hasInitialGenerated.current = true;
    void runGeneration(project);
  }, [project, isProjectLoading]);


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
                        <h2>{project?.name || editorState.name || `Residence ${id}`}</h2>
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
                  {project?.sourceImage && (
                    <img src={project?.sourceImage} alt="Original" className="render-fallback" />
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