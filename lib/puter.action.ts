import puter from "@heyputer/puter.js";
import { getOrCreateHostingConfig, uploadImageToHosting } from "./puter.hosting";
import { isHostedUrl, PROJECTS_KEY } from "./utils";

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

export const createProject = async ({ item, visibility }: CreateProjectParams): Promise<DesignItem | null | undefined> => {
  let renderHostingFailed = false;
  const projectId = item.id;

  const hosting = await getOrCreateHostingConfig();

  const hostedSource = projectId ? 
      await uploadImageToHosting({
          hosting, url: item.sourceImage, projectId, label: 'source',
  }) : null;

  const hostedRender = projectId && item.renderedImage ? await uploadImageToHosting({
    hosting, url: item.renderedImage, projectId, label: 'rendered',
  }) : null;

  const resolvedSource = hostedSource?.url || (isHostedUrl(item.sourceImage) ? item.sourceImage: ''
  );

  if(!resolvedSource) {
    console.warn('Failed to host source image, skipping save.')
    return null;
  }

  let resolvedRender: string | undefined;
  if (hostedRender?.url) {
    resolvedRender = hostedRender.url;
  } else if (item.renderedImage && isHostedUrl(item.renderedImage)) {
    resolvedRender = item.renderedImage;
  } else if (item.renderedImage) {
    // Configured render exists but could not be hosted and is not already hosted
    renderHostingFailed = true;
    resolvedRender = undefined;
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

  try{
    if (renderHostingFailed) {
      console.warn('Rendered image could not be hosted and will be lost');
    }

    // Persist to kv store
    const projects = await loadProjects();
    const existingIndex = projects.findIndex(p => p.id === projectId);

    if (existingIndex >= 0) {
      projects[existingIndex] = payload;
    } else {
      projects.unshift(payload);
    }

    const saved = await saveProjects(projects);
    if (!saved) {
      console.warn('Failed to persist project to storage');
    }

    return payload;
  } catch(e) {
    console.log(`Failed to save project`, e)
    return null;
  }
}