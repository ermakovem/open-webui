import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(new URL('../../../app.html', import.meta.url), 'utf8');

function openStartup(path = '/', sessionStorage = new Map<string, string>()) {
	const form = new EventTarget();
	const input = Object.assign(new EventTarget(), { value: '' });
	const send = { disabled: true };
	const status = { textContent: '' };
	const shell = {
		dataset: {},
		hidden: true,
		remove: vi.fn()
	};
	const getElementById = (id: string) =>
		({
			'nmb-startup': shell,
			'nmb-startup-form': form,
			'nmb-startup-input': input,
			'nmb-startup-send': send,
			'nmb-startup-status': status
		})[id];
	Object.assign(form, { contains: (element: unknown) => element === input });
	const document = { activeElement: null, getElementById };
	const window = new EventTarget();
	const location = new URL(path, 'https://nmb.test');
	const script = html.match(/<script id="nmb-startup-script">([\s\S]*?)<\/script>/)?.[1];
	expect(script, 'the entry document includes the inline composer script').toBeDefined();
	runInNewContext(script!, {
		document,
		window,
		location,
		navigator: { language: 'en-US' },
		localStorage: {},
		sessionStorage: {
			getItem: (key: string) => sessionStorage.get(key) ?? null,
			setItem: (key: string, text: string) => sessionStorage.set(key, text),
			removeItem: (key: string) => sessionStorage.delete(key)
		},
		AbortController,
		setTimeout,
		queueMicrotask
	});
	return {
		shell,
		document,
		input,
		form,
		send,
		status,
		window,
		sessionStorage,
		composer: (window as EventTarget & Pick<Window, 'nmbStartupComposer'>).nmbStartupComposer
	};
}

const text = 'Первая строка\nВторая <>&';
const type = (input: ReturnType<typeof openStartup>['input']) => {
	input.value = text;
	input.dispatchEvent(new Event('input'));
};
const submit = (form: EventTarget) => form.dispatchEvent(new Event('submit', { cancelable: true }));

describe('NMB early composer', () => {
	it('allows only the marked same-document trusted-auth round trip', async () => {
		const {
			beginStartupAuth,
			returnFromStartupAuth,
			handleStartupNavigation
		} = await import('./startup-composer');
		const dismiss = vi.fn();
		vi.stubGlobal('window', { nmbStartupComposer: { dismiss } });
		try {
			const home = new URL('https://nmb.test/');
			const auth = new URL('/auth?redirect=%2F', home);
			const navigate = (url: URL, type = 'goto') =>
				handleStartupNavigation({ to: { url }, type, willUnload: false });
			expect(beginStartupAuth(false, home)).toBe(false);
			expect(beginStartupAuth(true, home)).toBe(true);
			navigate(auth);
			expect(returnFromStartupAuth('/')).toBe(true);
			navigate(home);
			expect(dismiss).not.toHaveBeenCalled();

			expect(beginStartupAuth(true, home)).toBe(true);
			navigate(auth, 'link');
			expect(dismiss).toHaveBeenCalledOnce();
			expect(returnFromStartupAuth('/')).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('provides an unnamed native field and enables submit only on a direct clean root load', () => {
		expect(html.match(/<textarea\b[^>]*id="nmb-startup-input"[^>]*>/)?.[0]).toBeDefined();
		expect(html.match(/<textarea\b[^>]*id="nmb-startup-input"[^>]*>/)?.[0]).not.toMatch(/\bname=/);
		expect(openStartup().shell.hidden).toBe(false);
		expect(openStartup().send.disabled).toBe(false);
		for (const path of ['/c/id', '/nmb/subscriptions', '/?model=a', '/#prompt']) {
			const { shell, send } = openStartup(path);
			expect(shell.hidden).toBe(true);
			expect(send.disabled).toBe(true);
		}
	});

	it('delivers one request after repeated early submits', () => {
		const { input, form, composer } = openStartup();
		type(input);
		expect(submit(form)).toBe(false);
		expect(submit(form)).toBe(false);
		const receive = vi.fn();
		composer!.ready(receive);
		expect(receive.mock.calls).toEqual([[{ text, submit: true }]]);
	});

	it('does not remove a focused editor or deliver an in-progress composition', async () => {
		const { input, document, form, shell, composer } = openStartup();
		Object.assign(document, { activeElement: input });
		input.dispatchEvent(new Event('compositionstart'));
		type(input);
		const receive = vi.fn();
		composer!.ready(receive);
		expect(shell.remove).not.toHaveBeenCalled();
		expect(receive).not.toHaveBeenCalled();
		input.dispatchEvent(new Event('compositionend'));
		await Promise.resolve();
		expect(receive).not.toHaveBeenCalled();
		Object.assign(document, { activeElement: null });
		form.dispatchEvent(new Event('focusout'));
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(receive.mock.calls).toEqual([[{ text, submit: false }]]);
	});

	it('restores plain text after reload without restoring the send request', () => {
		const first = openStartup();
		type(first.input);
		submit(first.form);
		const second = openStartup('/', first.sessionStorage);
		expect(second.input.value).toBe(text);
		const receive = vi.fn();
		second.composer!.ready(receive);
		expect(receive.mock.calls).toEqual([[{ text, submit: false }]]);
	});

	it('keeps a draft editable after loading fails and cancels its send request', () => {
		const { input, form, composer, shell, send, status } = openStartup();
		type(input);
		submit(form);
		composer!.fail('Models unavailable');
		expect(status.textContent).toBe('Models unavailable');
		expect(input.value).toBe(text);
		expect(shell.remove).not.toHaveBeenCalled();
		expect(send.disabled).toBe(true);
		const receive = vi.fn();
		composer!.ready(receive);
		expect(receive.mock.calls).toEqual([[{ text, submit: false }]]);
	});

	it('shows an editable draft when the browser cannot load the startup modules', () => {
		const { input, window, status, send } = openStartup();
		type(input);
		window.dispatchEvent(
			Object.assign(new Event('unhandledrejection'), {
				reason: new TypeError('Failed to fetch dynamically imported module: /_app/start.js')
			})
		);
		expect(status.textContent).toBe('Could not load chat');
		expect(input.value).toBe(text);
		expect(send.disabled).toBe(true);
	});

	it('clears an outstanding request and its persisted draft on an identity change', () => {
		const first = openStartup();
		first.composer!.identify('profile-one');
		type(first.input);
		const second = openStartup('/', first.sessionStorage);
		submit(second.form);
		second.composer!.identify('profile-two');
		expect(second.input.value).toBe('');
		const receive = vi.fn();
		second.composer!.ready(receive);
		expect(receive.mock.calls).toEqual([[{ text: '', submit: false }]]);
		expect(second.sessionStorage.size).toBe(0);
	});
});
