import puter from "@heyputer/puter.js";
import { getOrCreateHostingConfig, uploadImageToHosting } from "./puter.hosting";
import { PROJECTS_KEY, isHostedUrl } from "./utils";
import { PUTER_WORKER_URL } from "./constants";

export const signIn = async () => await puter.auth.signIn();

export const signOut = () => puter.auth.signOut();

export const getCurrentUser = async () => {
  try {
    return await puter.auth.getUser();
  } catch {
    return null;
  }
}

export const loadProjects = async (): Promise<DesignItem[]> => {
  try {
    const projects = await puter.kv.get(PROJECTS_KEY) as DesignItem[] | null;
    return projects || [];
  } catch (e) {
    console.warn('Failed to load projects', e);
    return [];
  }
}

export const getProjectById = async (id: string): Promise<DesignItem | null> => {
  try {
    const projects = await loadProjects();
    return projects.find(p => p.id === id) || null;
  } catch (e) {
    console.warn('Failed to get project', e);
    return null;
  }
}

const saveProjects = async (projects: DesignItem[]): Promise<boolean> => {
  try {
    await puter.kv.set(PROJECTS_KEY, projects);
    return true;
  } catch (e) {
    console.warn('Failed to save projects', e);
    return false;
  }
}

export const createProject = async ({ item, visibility = "private"}: CreateProjectParams): Promise<DesignItem | null | undefined> => {
   let renderHostingFailed = false;
   const projectId = item.id;

   const hosting = await getOrCreateHostingConfig().catch(() => null);

   const hostedSource = projectId ?
       await uploadImageToHosting({
           hosting, url: item.sourceImage, projectId, label: 'source',
   }).catch(() => null) : null;

   const hostedRender = projectId && item.renderedImage ? await uploadImageToHosting({
     hosting, url: item.renderedImage, projectId, label: 'rendered',
   }).catch(() => null) : null;

  const resolvedSource = hostedSource?.url || item.sourceImage || '';

  if(!resolvedSource) {
    console.warn('Failed to resolve source image, skipping save.')
    return null;
  }

  let resolvedRender: string | undefined;
  if (hostedRender?.url) {
    resolvedRender = hostedRender.url;
  } else if (item.renderedImage) {
    // Keep the original render as fallback so upload/visualizer never loses it.
    if (!isHostedUrl(item.renderedImage)) renderHostingFailed = true;
    resolvedRender = item.renderedImage;
  } else {
    resolvedRender = undefined;
  }

  const {
    sourcePath: _sourcePath,
    renderedPath: _renderedPath,
    publicPath: _publicPath,
    ...rest
  } = item; 

  const payload = {
    ...rest,
    sourceImage: resolvedSource,
    renderedImage: resolvedRender,
    isPublic: visibility === 'public',
  }

  // Prefer worker persistence, fall back to local KV so upload never dead-ends.
  if(PUTER_WORKER_URL) {
    try{
          const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project: payload, visibility
            }),
          });

       if(!response.ok) {
          console.error('Failed to save the project', await response.text());
       } else {
          const data = (await response.json()) as { project?: DesignItem | null }

          if(data?.project) return data.project;
       }
    } catch(e) {
      console.log(`Worker save failed, falling back to KV`, e)
    }
  }

  try {
    const existing = await loadProjects();
    const next = [payload as DesignItem, ...existing.filter(p => p.id !== payload.id)];
    const ok = await saveProjects(next);
    if(ok) return payload as DesignItem;
    return null;
  } catch(e) {
    console.log(`Failed to save project`, e)
    return null;
  }
}

export const getProjects = async (): Promise<DesignItem[]> => {
  if(!PUTER_WORKER_URL) {
    return loadProjects();
  }

  try{
    const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/list`, { method: 'GET' });

    if(!response.ok) {
      console.error('Failed to fetch projects', await response.text());
      return loadProjects();
    }

    const data = (await response.json()) as { projects?: DesignItem[] | null };
    return Array.isArray(data?.projects) ? data.projects : await loadProjects();
  }catch(e){
    console.error('Failed to get projects', e);
    return loadProjects();
  }
}

export const getProject = async () => {
  if(!PUTER_WORKER_URL){
    console.warn('Missing VITE_PUTER_WORKER_URL; skip history fetch;');
    return [];
  }

  try{
    const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/list`, { method : 'GET' });

    if(!response.ok){
      console.error('Failed to fetch history', await response.text());
      return [];
    }

    const data = (await response.json()) as { projects?: DesignItem[] | null };

    return Array.isArray(data?.projects) ? data.projects: [];
  } catch (e){
    console.error('Failed to get projects', e);
    return [];
  }
}

export const getProjectsById = async ({ id }: { id: string }) => {
    if (PUTER_WORKER_URL) {
      try {
          const response = await puter.workers.exec(
              `${PUTER_WORKER_URL}/api/projects/get?id=${encodeURIComponent(id)}`,
              { method: "GET" },
          );

          if (response.ok) {
              const data = (await response.json()) as {
                  project?: DesignItem | null;
              };

              if(data?.project) return data.project;
          } else {
              console.error("Failed to fetch project:", await response.text());
          }
      } catch (error) {
          console.error("Worker fetch failed, falling back to KV:", error);
      }
    }

    // KV fallback (covers local saves when worker is down/misconfigured)
    return getProjectById(id);
};