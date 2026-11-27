import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import './startup-requests';

function simulate({ trusted = true, token = '', path = '/' } = {}) {
	const html = readFileSync(new URL('../../../app.html', import.meta.url), 'utf8');
	const script = html.match(/<script id="nmb-startup-requests">([\s\S]*?)<\/script>/)?.[1];
	expect(script).toBeDefined();
	const signin = { token: 'test-session' };
	const fetch = vi.fn(async (url: string) => {
		if (url === '/api/config') return Response.json({ features: { auth_trusted_header: trusted } });
		if (url === '/api/v1/auths/signin') return Response.json(signin);
		return Response.json({ data: [] });
	});
	const window = {} as Window;
	runInNewContext(script!, {
		window,
		location: new URL(path, 'https://nmb.test'),
		localStorage: { token },
		fetch
	});
	return { window, fetch, signin };
}

describe('NMB cold startup requests', () => {
	it('starts trusted login and its reads early, and hands each response to the app once', async () => {
		const { window, fetch, signin } = simulate();
		const take = window.nmbStartupRequest!;
		expect((await take('config', ''))?.ok).toBe(true);
		expect(await (await take('signin', ''))?.json()).toEqual(signin);
		expect((await take('config', signin.token))?.ok).toBe(true);
		expect(await take('models', 'other-user')).toBeNull();
		expect((await take('models', signin.token))?.ok).toBe(true);
		expect((await take('settings', signin.token))?.ok).toBe(true);
		expect(await take('models', signin.token)).toBeNull();
		expect(fetch.mock.calls.map(([path]) => path)).toEqual([
			'/api/config', '/api/v1/auths/signin', '/api/config', '/api/models', '/api/v1/users/user/settings'
		]);
	});

	it('leaves auth and authenticated reads to the app without a trusted header flow', async () => {
		const { window, fetch } = simulate({ trusted: false });
		expect(await window.nmbStartupRequest?.('signin', '')).toBeNull();
		expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/config']);
	});

	it('uses normal loading on existing sessions and direct links', () => {
		for (const variant of [{ token: 'present' }, { path: '/c/123' }, { path: '/?model=other' }]) {
			const { window, fetch } = simulate(variant);
			expect(window.nmbStartupRequest).toBeUndefined();
			expect(fetch).not.toHaveBeenCalled();
		}
	});
});
