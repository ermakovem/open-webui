export type Destination = 'subscriptions' | 'account';
export type Fields = Record<string, string>;
export interface Subscription {
	name: string;
	provider: string;
	status: string | null;
	disabled: boolean;
	windows: {
		label: string;
		remaining: number | null;
		reset: string | null;
		observed: string | null;
	}[];
}
interface Common {
	csrf: string;
	owner: string;
	origin: string;
	providers: Record<string, string>;
}
export interface Account extends Common {
	section: 'account';
	notice: string;
	subscriptions: Subscription[];
	key_exists: boolean;
	activity: { day: string; model: string; outcome: string; total: number }[];
}
export interface Subscriptions extends Common {
	section: 'subscriptions';
	notice: string;
	subscriptions: Subscription[];
	journal: { time: string; owner: string; action: string; target: string; result: string }[];
}
export type PortalView =
	| Account
	| Subscriptions
	| (Common &
			(
				| { section: 'issued'; new_key: string }
				| { section: 'oauth'; url: string; state: string; provider: string }
				| { section: 'device'; url: string; state: string; user_code: string }
				| { section: 'pending'; state: string; notice: string }
				| {
						section: 'models';
						target: string;
						models: string[];
						hidden: string[];
						needs_prefix: boolean;
				  }
				| { section: 'confirm'; target: string }
				| { section: 'notice'; notice: string }
			));
export type Post = (path: string, fields?: Fields) => void;

const sections = new Set<PortalView['section']>([
	'account',
	'subscriptions',
	'issued',
	'oauth',
	'device',
	'pending',
	'models',
	'confirm',
	'notice'
]);

export class PortalError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function requestPortal(
	path: string,
	signal: AbortSignal,
	fields?: Fields
): Promise<PortalView> {
	const response = await fetch(path, {
		method: fields ? 'POST' : 'GET',
		headers: { Accept: 'application/vnd.nmb.portal+json' },
		mode: 'same-origin',
		credentials: 'same-origin',
		redirect: 'error',
		cache: 'no-store',
		body: fields ? new URLSearchParams(fields) : undefined,
		signal
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		throw new PortalError(
			response.status,
			typeof data?.detail === 'string' ? data.detail : `Ошибка запроса (HTTP ${response.status}).`
		);
	}
	if (!sections.has(data?.section) || typeof data.csrf !== 'string' || !data.csrf) {
		throw new Error('Сервис вернул неизвестный формат ответа.');
	}
	return data;
}
