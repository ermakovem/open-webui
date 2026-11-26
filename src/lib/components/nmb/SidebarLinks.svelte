<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Link from '$lib/components/icons/Link.svelte';
	import UserCircle from '$lib/components/icons/UserCircle.svelte';
	export let collapsed = false;
	export let onNavigate: () => void;
	const entries = [
		{ href: '/nmb/subscriptions', label: 'Подписки', icon: Link },
		{ href: '/nmb/account', label: 'Личный кабинет', icon: UserCircle }
	];
	function select(event: MouseEvent, href: string) {
		// The compact rail expands on bubbling clicks outside its links.
		event.stopPropagation();
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		onNavigate();
		void goto(href);
	}
</script>

{#each entries as entry}
	{@const current = $page.url.pathname === entry.href}
	{#if collapsed}
		<div>
			<Tooltip content={entry.label} placement="right">
				<a
					href={entry.href}
					aria-label={entry.label}
					aria-current={current ? 'page' : undefined}
					draggable="false"
					on:click={(event) => select(event, entry.href)}
					class="group flex size-8 items-center justify-center rounded-lg hover:bg-base-100 dark:hover:bg-base-900 {current
						? 'bg-base-100 dark:bg-base-900'
						: ''}"
				>
					<svelte:component this={entry.icon} className="size-4" />
				</a>
			</Tooltip>
		</div>
	{:else}
		<div class="flex px-1 text-base-700 dark:text-base-300">
			<a
				href={entry.href}
				aria-current={current ? 'page' : undefined}
				draggable="false"
				on:click={(event) => select(event, entry.href)}
				class="flex grow items-center gap-2 rounded-xl px-2 py-1.5 text-[0.8125rem] leading-5 transition hover:bg-base-100 dark:hover:bg-base-900 {current
					? 'bg-base-100 dark:bg-base-900'
					: ''}"
			>
				<svelte:component this={entry.icon} className="size-4 shrink-0" />
				<span>{entry.label}</span>
			</a>
		</div>
	{/if}
{/each}
