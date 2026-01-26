export const getRootUrl = (): string => {
    return window.RedmineCreateTasks?.rootUrl || '';
};

export const getProjectIdentifier = (): string => {
    return window.RedmineCreateTasks?.projectIdentifier || '';
};

export const getApiUrl = (path: string): string => {
    const root = getRootUrl();
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const cleanRoot = root.endsWith('/') ? root.slice(0, -1) : root;
    return `${cleanRoot}/${cleanPath}`;
};
