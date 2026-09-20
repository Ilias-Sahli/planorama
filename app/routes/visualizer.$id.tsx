import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { generate3DView } from '../../lib/ai.action';
import { createProject, getProjectsById } from '../../lib/puter.action';
import { Box, Check, Download, Link2, RefreshCcw, Share2, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import { fetchBlobFromUrl, getImageExtension } from '../../lib/utils';
import { SHARE_STATUS_RESET_DELAY_MS } from '../../lib/constants';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

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

  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shareResetRef.current !== null) window.clearTimeout(shareResetRef.current);
    };
  }, []);

  const flashShareStatus = (status: ShareStatus) => {
    setShareStatus(status);
    if (shareResetRef.current !== null) window.clearTimeout(shareResetRef.current);
    shareResetRef.current = window.setTimeout(() => setShareStatus('idle'), SHARE_STATUS_RESET_DELAY_MS);
  };

  const initialImage = editorState.initialImage;
  const initialRender = editorState.initialRender;
  const projectName = editorState.name || 'Untitled Project';

  const handleBack = () => navigate('/');

  const getShareUrl = () => (typeof window !== 'undefined' ? window.location.href : '');
  const getShareText = () =>
    `${project?.name || editorState.name || 'My Planorama render'} — designed with Planorama`;

  const ensurePublic = async () => {
    if (!project || project.isPublic) return project;
    try {
      const saved = await createProject({ item: project, visibility: 'public' });
      if (saved) setProject(saved);
      return saved ?? project;
    } catch (error) {
      console.warn('Failed to publish project before share', error);
      return project;
    }
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      flashShareStatus('done');
    } catch {
      // Clipboard API fallback for non-secure contexts.
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      flashShareStatus('done');
    }
  };

  const handleNativeShare = async () => {
    const url = getShareUrl();
    if (!url) return;
    // Make the link viewable by others before sharing.
    setIsSharing(true);
    try {
      await ensurePublic();

      const data: ShareData = {
        title: project?.name || editorState.name || 'Planorama',
        text: getShareText(),
        url,
      };

      // Attach the rendered image when the platform supports file sharing.
      if (currentImage && navigator.canShare) {
        try {
          const resolved = await fetchBlobFromUrl(currentImage);
          if (resolved) {
            const ext = getImageExtension(resolved.contentType || resolved.blob.type, currentImage);
            const file = new File([resolved.blob], `planorama.${ext}`, {
              type: resolved.blob.type || 'image/png',
            });
            if (navigator.canShare({ files: [file] })) {
              (data as ShareData & { files?: File[] }).files = [file];
            }
          }
        } catch {
          // File attach is best-effort; text+url share still works.
        }
      }

      if (navigator.share) {
        await navigator.share(data);
        flashShareStatus('done');
      } else {
        await handleCopyLink();
      }
    } catch (error) {
      // AbortError = user dismissed the sheet; don't show it as failure.
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Share failed: ', error);
        await handleCopyLink();
      }
    } finally {
      setIsSharing(false);
    }
  };

  const openSocial = (target: string) => {
    window.open(target, '_blank', 'noopener,width=600,height=540');
  };

  const handleSocialShare = (network: 'x' | 'facebook' | 'whatsapp' | 'linkedin' | 'telegram' | 'pinterest' | 'email') => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    const image = encodeURIComponent(currentImage?.startsWith('http') ? currentImage : getShareUrl());

    switch (network) {
      case 'x':
        return openSocial(`https://twitter.com/intent/tweet?text=${text}&url=${url}`);
      case 'facebook':
        return openSocial(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
      case 'whatsapp':
        return openSocial(`https://wa.me/?text=${text}%20${url}`);
      case 'linkedin':
        return openSocial(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`);
      case 'telegram':
        return openSocial(`https://t.me/share/url?url=${url}&text=${text}`);
      case 'pinterest':
        return openSocial(`https://pinterest.com/pin/create/button/?url=${url}&media=${image}&description=${text}`);
      case 'email':
        window.location.href = `mailto:?subject=${text}&body=${text}%0A${url}`;
        return;
    }
  };

  const handleExport = async () => {
    if (!currentImage) return;

    const baseName =
      (project?.name || editorState.name || `residence-${id || 'render'}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'render';

    try {
      // Data URL: download directly without fetch.
      if (currentImage.startsWith('data:')) {
        const mime = currentImage.slice(5, currentImage.indexOf(';'));
        const ext = getImageExtension(mime, currentImage);
        const link = document.createElement('a');
        link.href = currentImage;
        link.download = `${baseName}.${ext}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      // Remote / hosted URL: fetch as blob (handles CORS-enabled hosts),
      // fall back to opening in a new tab if fetch fails.
      const resolved = await fetchBlobFromUrl(currentImage);
      if (!resolved) {
        window.open(currentImage, '_blank', 'noopener');
        return;
      }

      const ext = getImageExtension(resolved.contentType || resolved.blob.type, currentImage);
      const objectUrl = URL.createObjectURL(resolved.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${baseName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke after the click so the download can start first.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error('Export failed: ', error);
      window.open(currentImage, '_blank', 'noopener');
    }
  };

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
                        <div className="relative">
                          <Button
                            size="sm"
                            onClick={() => setShowShareMenu((v) => !v)}
                            className="share"
                            disabled={!currentImage || isSharing}
                            title="Share this project"
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            {isSharing ? 'Sharing...' : shareStatus === 'done' ? 'Link copied!' : 'Share'}
                          </Button>

                          {showShareMenu && (
                            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-2xl z-40">
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100"
                                onClick={handleNativeShare}
                              >
                                <Share2 className="w-4 h-4" /> System share...
                              </button>
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100"
                                onClick={handleCopyLink}
                              >
                                {shareStatus === 'done' ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                                Copy link
                              </button>
                              <div className="my-1 border-t border-zinc-100" />
                              {(['x', 'facebook', 'whatsapp', 'linkedin', 'telegram', 'pinterest', 'email'] as const).map((network) => (
                                <button
                                  key={network}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm capitalize hover:bg-zinc-100"
                                  onClick={() => handleSocialShare(network)}
                                >
                                  Share on {network === 'x' ? 'X' : network}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={handleExport}
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
          <div className="panel compare">
             <div className="panel-header">
              <div className="panel-meta">
                <p>Comparison</p>
                <h3>Before and After</h3>
              </div>
              <div className="hint">Drag to compare</div>
            </div>

          <div className="compare-stage">
            {project?.sourceImage && currentImage ? (
              <ReactCompareSlider
                defaultValue={50}
                style={{width: '100%', height: 'auto'}}
                itemOne={
                  <ReactCompareSliderImage src={project?.sourceImage} alt="before" className="compare-img"/>
                }
                itemTwo={
                  <ReactCompareSliderImage src={currentImage} alt="after" className="compare-img"/>
                } />
            ) : (
              <div className="compare-fallback">
                {project?.sourceImage && (
                  <img src ={project.sourceImage} alt="Before" className="compare-img"/>
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