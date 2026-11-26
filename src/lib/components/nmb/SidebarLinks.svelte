<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Link from '$lib/components/icons/Link.svelte';
	export let collapsed = false;
	export let onNavigate: () => void;
	const href = '/nmb/subscriptions';
	$: current = $page.url.pathname === href;
	function select(event: MouseEvent) {
		// The compact rail expands on bubbling clicks outside its links.
		event.stopPropagation();
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		onNavigate();
		void goto(href);
	}
</script>

{#if collapsed}
	<div>
		<Tooltip content="Подписки" placement="right">
			<a
				{href}
				aria-label="Подписки"
				aria-current={current ? 'page' : undefined}
				draggable="false"
				on:click={select}
				class="group flex size-8 items-center justify-center rounded-lg hover:bg-base-100 dark:hover:bg-base-900 {current
					? 'bg-base-100 dark:bg-base-900'
					: ''}"
			>
				<Link className="size-4" />
			</a>
		</Tooltip>
	</div>
{:else}
	<div class="flex px-1 text-base-700 dark:text-base-300">
		<a
			{href}
			aria-current={current ? 'page' : undefined}
			draggable="false"
			on:click={select}
			class="flex grow items-center gap-2 rounded-xl px-2 py-1.5 text-[0.8125rem] leading-5 transition hover:bg-base-100 dark:hover:bg-base-900 {current
				? 'bg-base-100 dark:bg-base-900'
				: ''}"
		>
			<Link className="size-4 shrink-0" />
			<span>Подписки</span>
		</a>
	</div>
{/if}
