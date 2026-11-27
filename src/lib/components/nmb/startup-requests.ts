type RequestKind = 'config' | 'signin' | 'models' | 'settings';

declare global {
	interface Window {
		nmbStartupRequest?: (kind: RequestKind, token: string) => Promise<Response | null>;
	}
}

export const startupFetch = async (
	kind: RequestKind | null,
	token: string,
	request: () => Promise<Response>
) => {
	const response = kind && typeof window !== 'undefined'
		? await window.nmbStartupRequest?.(kind, token)
		: null;
	if (token && response?.status === 401) return request();
	return response ?? request();
};

export const discardStartupRequests = () => {
	if (typeof window !== 'undefined') delete window.nmbStartupRequest;
};
