<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { getModels } from '$lib/apis';
	import { mobile, models, showSidebar, user, WEBUI_NAME } from '$lib/stores';
	import SidebarIcon from '$lib/components/icons/Sidebar.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import AccountSection from './AccountSection.svelte';
	import SubscriptionsSection from './SubscriptionsSection.svelte';
	import PortalFlow from './PortalFlow.svelte';
	import {
		PortalError,
		requestPortal,
		type Fields,
		type PortalView
	} from './portal';
	import './portal.css';

	let personalOpen = false;
	let view: PortalView | null = null;
	let error = '';
	let busy = false;
	let deviceMessage = '';
	let modelTarget = '';
	let timer: ReturnType<typeof setTimeout>;
	let inFlight: AbortController | null = null;
	let titleElement: HTMLHeadingElement;
	let scrollArea: HTMLElement;
	const title = 'Подписки';

	function forget() {
		clearTimeout(timer);
		inFlight?.abort();
		inFlight = null;
		busy = false;
		view = null;
		modelTarget = '';
		deviceMessage = '';
		error = '';
	}

	beforeNavigate((navigation) => {
		if (
			!navigation.willUnload &&
			view?.section === 'issued' &&
			!window.confirm('Ключ сохранён? При выходе он будет скрыт.')
		)
			navigation.cancel();
	});

	onMount(() => {
		const anchor = window.location.hash;
		personalOpen = anchor === '#api';
		void home().then(() => {
			if (anchor === '#api' || anchor === '#limits') {
				document.getElementById(anchor.slice(1))?.scrollIntoView({ block: 'start' });
			}
		});
		const beforeUnload = (event: BeforeUnloadEvent) => {
			if (view?.section === 'issued') {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		const restored = (event: PageTransitionEvent) => {
			if (event.persisted) void home();
		};
		let away = document.hidden || !document.hasFocus();
		const refresh = () => {
			if (view?.section === 'device') status();
			else if (!view || view.section === 'subscriptions') void run('/subscriptions');
		};
		const onBlur = () => { away = true; };
		const onReturn = () => {
			if (document.hidden) away = true;
			else if (away) {
				away = false;
				refresh();
			}
		};
		window.addEventListener('beforeunload', beforeUnload);
		window.addEventListener('pagehide', forget);
		window.addEventListener('pageshow', restored);
		document.addEventListener('visibilitychange', onReturn);
		window.addEventListener('blur', onBlur);
		window.addEventListener('focus', onReturn);
		window.addEventListener('nmb:refresh-subscriptions', refresh);
		return () => {
			window.removeEventListener('beforeunload', beforeUnload);
			window.removeEventListener('pagehide', forget);
			window.removeEventListener('pageshow', restored);
			document.removeEventListener('visibilitychange', onReturn);
			window.removeEventListener('blur', onBlur);
			window.removeEventListener('focus', onReturn);
			window.removeEventListener('nmb:refresh-subscriptions', refresh);
			forget();
		};
	});

	function home() {
		forget();
		return run('/subscriptions');
	}

	function openModels(name: string) {
		modelTarget = name;
		void run('/subscriptions/models?' + new URLSearchParams({ name }));
	}

	function post(path: string, fields: Fields = {}) {
		if (!view || busy) return;
		void run(path, { ...fields, csrf: view.csrf });
	}

	function status() {
		if (view?.section === 'device') post('/subscriptions/status', { state: view.state });
	}

	async function run(path: string, fields?: Fields) {
		if (inFlight) return;
		clearTimeout(timer);
		const controller = new AbortController();
		inFlight = controller;
		busy = true;
		error = '';
		const previous = view;
		try {
			const result = await requestPortal(path, controller.signal, fields);
			if (controller.signal.aborted) return;
			if (
				result.section === 'pending' &&
				(previous?.section === 'device' ||
					(previous?.section === 'oauth' && path === '/subscriptions/status'))
			) {
				// A status check must preserve the code or callback form while login is pending.
				view = { ...previous, csrf: result.csrf };
				deviceMessage = result.notice;
			} else {
				view = result;
				deviceMessage = '';
				if (previous?.section !== result.section) {
					await tick();
					titleElement?.focus({ preventScroll: true });
					scrollArea?.scrollTo(0, 0);
				}
			}
			if (
				fields &&
				result.section === 'notice' &&
				['/subscriptions/change', '/subscriptions/models', '/subscriptions/status'].includes(path)
			) {
				// The chat uses its own model store in the shared layout.
				void getModels(localStorage.token, false, true)
					.then((catalog) => models.set(catalog))
					.catch(() => {});
			}
		} catch (failure) {
			if (controller.signal.aborted) return;
			error =
				failure instanceof PortalError ||
				(failure instanceof Error && !(failure instanceof TypeError))
					? failure.message
					: 'Не удалось связаться с сервисом.';
			if (failure instanceof PortalError && failure.status === 403) {
				view = null;
				modelTarget = '';
				deviceMessage = '';
			} else if (
				path.startsWith('/account/keys') ||
				(fields && path === '/subscriptions/change' && fields.confirm)
			) {
				// A lost response can follow a successful mutation. Read current state before another attempt.
				view = null;
			}
		} finally {
			if (inFlight === controller) {
				inFlight = null;
				busy = false;
				if (view?.section === 'device') {
					timer = setTimeout(status, previous?.section === 'device' ? 3500 : 2000);
				}
			}
		}
	}
</script>

<svelte:head><title>{title} · {$WEBUI_NAME}</title></svelte:head>

<div
	class="nmb-portal flex h-full min-w-0 flex-1 flex-col {$showSidebar
		? 'md:max-w-[calc(100%-var(--sidebar-width))]'
		: ''}"
>
	{#if $mobile}
		<div
			class="flex h-11 shrink-0 items-center gap-2 border-b border-base-100 px-2 dark:border-base-800"
		>
			<button
				type="button"
				id="sidebar-toggle-button"
				class="flex size-8 items-center justify-center rounded-lg hover:bg-base-100 dark:hover:bg-base-800"
				aria-label="Открыть боковую панель"
				on:click={() => showSidebar.set(true)}><SidebarIcon /></button
			>
			<span class="text-sm font-medium">{title}</span>
		</div>
	{/if}
	<div bind:this={scrollArea} class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
			<header class="mb-6">
				<h1
					tabindex="-1"
					bind:this={titleElement}
					class="text-2xl font-semibold tracking-tight outline-none"
				>
					{title}
				</h1>
				{#if view?.section === 'subscriptions'}<p class="nmb-muted mt-1 break-all">
						{$user?.name || view.owner}
					</p>{/if}
			</header>
			{#if error}
				<div class="nmb-notice mb-4">
					<p role="alert">{error}</p>
					{#if !view || !['device', 'oauth', 'pending'].includes(view.section)}
						<button class="nmb-button mt-2" disabled={busy} on:click={home}>Обновить раздел</button>
					{/if}
				</div>
			{/if}
			{#if view?.section === 'subscriptions'}
				{#if view.notice}
					<div class="nmb-notice mb-4">
						<p role="status">{view.notice}</p>
						<button class="nmb-button mt-2" disabled={busy} on:click={home}>Обновить раздел</button>
					</div>
				{/if}
				<details id="api" class="nmb-card mb-6" bind:open={personalOpen}>
					<summary class="cursor-pointer font-medium">Мой API-ключ и расход</summary>
					<div class="mt-4">
						<AccountSection {view} {post} {busy} />
					</div>
				</details>
				<SubscriptionsSection {view} {post} {openModels} {busy} />
			{:else if view}
				<PortalFlow
					{view}
					{post}
					{busy}
					{deviceMessage}
					returnHome={home}
					returnModels={modelTarget ? () => openModels(modelTarget) : null}
				/>
			{:else if busy}
				<div class="flex items-center gap-2 text-sm" role="status">
					<Spinner className="size-4" />Загрузка…
				</div>
			{/if}
		</div>
	</div>
</div>
