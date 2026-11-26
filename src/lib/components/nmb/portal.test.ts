import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPortal } from './portal';

const signal = new AbortController().signal;
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('NMB portal transport', () => {
	it('uses the portal representation and form CSRF on an authenticated same-origin POST', async () => {
		const view = { section: 'issued', csrf: 'new-nonce', new_key: 'test-value' };
		const fetcher = vi.fn().mockResolvedValue(Response.json(view));
		vi.stubGlobal('fetch', fetcher);
		expect(await requestPortal('/account/keys', signal, { csrf: 'test-nonce' })).toEqual(view);
		const [path, init] = fetcher.mock.calls[0];
		expect(path).toBe('/account/keys');
		expect(init).toMatchObject({
			method: 'POST',
			mode: 'same-origin',
			credentials: 'same-origin',
			cache: 'no-store',
			redirect: 'error',
			headers: { Accept: 'application/vnd.nmb.portal+json' },
			signal
		});
		expect(init.body).toBeInstanceOf(URLSearchParams);
		expect(init.body.get('csrf')).toBe('test-nonce');
	});
	it('keeps an HTTP failure distinguishable from a pending login', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(Response.json({ detail: 'Время входа истекло' }, { status: 403 }))
		);
		await expect(
			requestPortal('/subscriptions/status', signal, { csrf: 'x', state: 'y' })
		).rejects.toMatchObject({ status: 403, message: 'Время входа истекло' });
	});
	it('rejects fallback HTML and unrecognized views', async () => {
		for (const response of [
			new Response('<html></html>'),
			Response.json({ section: 'unexpected', csrf: 'x' })
		]) {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
			await expect(requestPortal('/account', signal)).rejects.toThrow();
		}
	});
});
