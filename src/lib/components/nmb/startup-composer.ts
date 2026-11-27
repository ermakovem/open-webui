export type StartupDraft = { text: string; submit: boolean };

type StartupComposer = {
	ready(receive: (draft: StartupDraft) => void): void;
	fail(message: string): void;
	identify(userId: string | null): void;
	dismiss(): void;
};

declare global {
	interface Window {
		nmbStartupComposer?: StartupComposer;
	}
}

export const startupComposer = () =>
	typeof window === 'undefined' ? undefined : window.nmbStartupComposer;

let transition: 'to-auth' | 'in-auth' | 'to-chat' | 'to-error' | null = null;
const pathOf = (url: URL) => url.pathname + url.search + url.hash;

export const dismissStartupComposer = () => {
	transition = null;
	startupComposer()?.dismiss();
};

export const beginStartupAuth = (trustedHeader: boolean, url: URL) => {
	if (!trustedHeader || !startupComposer() || transition || pathOf(url) !== '/') return false;
	transition = 'to-auth';
	return true;
};

export const returnFromStartupAuth = (path: string) => {
	if (transition !== 'in-auth' || !startupComposer() || path !== '/') return false;
	transition = 'to-chat';
	return true;
};

export const showStartupLoadError = (message: string) => {
	const composer = startupComposer();
	if (!composer) return false;
	composer.fail(message);
	transition = 'to-error';
	return true;
};

export const handleStartupNavigation = ({
	to,
	type,
	willUnload
}: {
	to: { url: URL } | null;
	type: string;
	willUnload: boolean;
}) => {
	if (!startupComposer()) return;
	if (type === 'goto' && !willUnload && to) {
		const path = pathOf(to.url);
		if (transition === 'to-auth' && path === '/auth?redirect=%2F') {
			transition = 'in-auth';
			return;
		}
		if (
			(transition === 'to-chat' && path === '/') ||
			(transition === 'to-error' && path === '/error')
		) {
			transition = null;
			return;
		}
	}
	dismissStartupComposer();
};
