export type QuotaWindow = {
	label: string;
	remaining: number | null;
	reset: string | null;
	observed: string | null;
};

export type MenuModel = {
	id: string;
	name: string;
	subscription: string;
	context_tokens: number | null;
	image: boolean;
	search: boolean;
};

export type SubscriptionMenu = {
	subscriptions: { id: string; label: string; windows: QuotaWindow[] }[];
	models: MenuModel[];
};

let pending: Promise<SubscriptionMenu> | undefined;
export function loadSubscriptionMenu(): Promise<SubscriptionMenu> {
	if (!pending) {
		pending = fetch('/account/model-menu', { credentials: 'same-origin', cache: 'no-store' })
			.then(async (response) => {
				if (!response.ok) throw new Error('Каталог подписок недоступен');
				const menu: SubscriptionMenu = await response.json();
				if (!Array.isArray(menu.models) || !Array.isArray(menu.subscriptions)) {
					throw new Error('Некорректный каталог подписок');
				}
				return menu;
			})
			.finally(() => { pending = undefined; });
	}
	return pending;
}

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export function formatModelContext(tokens: number | null | undefined): string {
	if (!tokens || tokens <= 0) return '';
	if (tokens >= 1_000_000) return number.format(tokens / 1_000_000) + 'M';
	if (tokens >= 1000) return number.format(tokens / 1000) + 'K';
	return String(tokens);
}

const resetDate = new Intl.DateTimeFormat('ru-RU', {
	day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});
function resetTime(value: string | null): string {
	const time = Date.parse(value ?? '');
	return Number.isFinite(time) ? resetDate.format(time) : '';
}

export function quotaSummary(windows: QuotaWindow[], now = Date.now()): string {
	const measured = windows.filter((w) => w.remaining != null && Number.isFinite(w.remaining));
	const current = measured.filter((w) => !(Date.parse(w.reset ?? '') <= now));
	const lowest = current.sort((a, b) => a.remaining! - b.remaining!)[0];
	if (!lowest) return measured.length ? 'обновляется' : 'нет данных';
	const reset = resetTime(lowest.reset);
	return number.format(lowest.remaining!) + '%' + (reset ? ' · до ' + reset : ' · сброс неизвестен');
}

export function quotaDetails(windows: QuotaWindow[]): string {
	return windows.map((w) => w.label + ' · осталось ' + (w.remaining != null ? number.format(w.remaining) + '%' : 'неизвестно')
		+ ' · сброс ' + (resetTime(w.reset) || 'неизвестен')).join('\n');
}

type Section = { id: string; label: string; windows?: QuotaWindow[]; expanded: boolean };
export type PickerRow<T> =
	| { key: string; section: Section; item?: undefined }
	| { key: string; section?: undefined; item: T };

export function subscriptionRows<T extends { value: string; catalogId?: string }>(
	items: T[], menu: SubscriptionMenu, pinned: string[], toggledSections: Set<string>, searching: boolean
): PickerRow<T>[] {
	const byId = new Map(items.map((item) => [item.value, item]));
	const account = new Map(menu.models.map((model) => [model.id, model.subscription]));
	const rows: PickerRow<T>[] = [];
	function append(id: string, label: string, members: T[], windows?: QuotaWindow[]) {
		if (!members.length) return;
		const normallyOpen = !id.startsWith('account:');
		const expanded = searching || (toggledSections.has(id) ? !normallyOpen : normallyOpen);
		rows.push({ key: id, section: { id, label, windows, expanded } });
		if (expanded) {
			for (const item of members) rows.push({ key: id + '/' + item.value, item });
		}
	}
	for (const id of pinned) {
		const item = byId.get(id);
		if (item) rows.push({ key: 'favorites/' + id, item });
	}
	const known = new Set(menu.subscriptions.map((s) => s.id));
	const occurrence = new Map<string, number>();
	for (const sub of menu.subscriptions) {
		const index = (occurrence.get(sub.label) ?? 0) + 1;
		occurrence.set(sub.label, index);
		const repeated = menu.subscriptions.some((other) => other.id !== sub.id && other.label === sub.label);
		append('account:' + sub.id, repeated ? sub.label + ' ' + index : sub.label,
			items.filter((item) => account.get(item.catalogId ?? item.value) === sub.id), sub.windows);
	}
	append('other', 'Другие модели', items.filter((item) => !known.has(account.get(item.catalogId ?? item.value) ?? '')));
	return rows;
}
