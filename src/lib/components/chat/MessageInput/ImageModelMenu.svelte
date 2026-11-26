<script lang="ts">
	import { getContext, onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { updateUserSettings } from '$lib/apis/users';
	import { settings, type ImageModel } from '$lib/stores';
	import { imageChoices } from '$lib/utils/nmbImageChoices';
	import { loadSubscriptionMenu, subscriptionRows, quotaSummary, quotaDetails, type SubscriptionMenu } from '$lib/components/chat/ModelSelector/subscriptionMenu';
	import ChevronLeft from '$lib/components/icons/ChevronLeft.svelte';
	import ChevronRight from '$lib/components/icons/ChevronRight.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import Star from '$lib/components/icons/Star.svelte';
	import SearchInput from './InputMenu/SearchInput.svelte';

	export let options: ImageModel[] = [];
	export let goBack: () => void;
	const i18n = getContext<typeof import('$lib/i18n').default>('i18n');
	const emptyMenu: SubscriptionMenu = { subscriptions: [], models: [] };
	let menu = emptyMenu;
	let query = '';
	let saving = false;
	let groups = new Set<string>();
	let picker: HTMLDivElement;
	onMount(() => { loadSubscriptionMenu().then((result) => menu = result).catch(() => {}); });

	$: selected = imageChoices($settings);
	$: pinned = $settings.nmbPinnedImageModels ?? [];
	$: term = query.trim().toLocaleLowerCase();
	$: items = options.map((model) => ({
		value: model.id, catalogId: model.model, label: model.name
	})).filter((model) => (model.label + ' ' + model.value).toLocaleLowerCase().includes(term));
	$: rows = subscriptionRows(items, menu, pinned, groups, !!term);

	function toggleGroup(id: string) {
		if (term) return;
		const next = new Set(groups);
		if (!next.delete(id)) next.add(id);
		groups = next;
	}

	async function toggle(key: 'nmbPinnedImageModels' | 'nmbImageModels', id?: string) {
		if (saving) return;
		const previous = key === 'nmbImageModels' ? selected : pinned;
		const value = !id ? [] : previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
		const patch = key === 'nmbImageModels' ? { nmbImageModels: value, nmbImageModel: value[0] ?? '' } : { nmbPinnedImageModels: value };
		const focusedStar = id && document.activeElement instanceof HTMLElement && document.activeElement.dataset.imageFavorite === id;
		saving = true;
		try {
			const result = await updateUserSettings(localStorage.token, { ui: patch });
			if (JSON.stringify(result?.ui?.[key]) !== JSON.stringify(value)) throw new Error();
			settings.update((current) => ({ ...current, ...patch }));
			if (focusedStar && !value.includes(id)) {
				await tick();
				const group = menu.models.find((item) => item.id === options.find((option) => option.id === id)?.model)?.subscription;
				const next = picker?.querySelector<HTMLElement>('[data-image-favorite="' + CSS.escape(id) + '"]')
					?? picker?.querySelector<HTMLElement>('[data-image-subscription="account:' + CSS.escape(group ?? '') + '"]');
				next?.focus();
			}
		} catch {
			toast.error('Не удалось сохранить настройку');
		} finally {
			saving = false;
		}
	}
</script>

<div data-image-picker bind:this={picker} class="flex min-h-0 flex-col gap-0.5 overflow-hidden" in:fly={{ x: 20, duration: 150 }}>
	<button type="button" role="menuitem" class="flex w-full shrink-0 items-center gap-2 px-2 py-1 text-[0.8125rem] rounded-xl hover:bg-base-50/40 dark:hover:bg-base-800/40" on:click={goBack}>
		<ChevronLeft /> {$i18n.t('Image model')} <span class="text-base-500">{options.length}</span>
	</button>
	<SearchInput bind:value={query} placeholder={$i18n.t('Search image models')} />
	<div class="min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin" role="group" aria-label={$i18n.t('Image model')}>
		{#each rows as row (row.key)}
			{#if row.section}
				{@const section = row.section}
				<button type="button" role="menuitem" data-image-subscription={section.id} aria-expanded={section.expanded}
					title={quotaDetails(section.windows ?? [])}
					class="flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-[0.8125rem] font-semibold hover:bg-base-50/40 dark:hover:bg-base-800/40"
					on:click={() => toggleGroup(section.id)}>
					<span class={section.expanded ? 'rotate-90' : ''}><ChevronRight /></span>
					<span class="min-w-0 flex-1">{section.label}</span>
					{#if section.windows}<span class="text-right text-xs font-normal text-base-500">{quotaSummary(section.windows)}</span>{/if}
				</button>
			{:else}
				{@const model = row.item}
				{@const favorite = pinned.includes(model.value)}
				<div class="flex items-center gap-1 rounded-xl hover:bg-base-50/40 dark:hover:bg-base-800/40">
					<button type="button" role="menuitemcheckbox" data-image-model={model.value} aria-checked={selected.includes(model.value)}
						disabled={saving} on:click={() => toggle('nmbImageModels', model.value)}
						class="flex min-h-[1.85rem] min-w-0 flex-1 items-center gap-1 px-2 py-1 text-left text-[0.8125rem]">
						<span class="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">{model.label}</span>
						{#if selected.includes(model.value)}<Check className="size-3.5 shrink-0" strokeWidth="2" />{/if}
					</button>
					<button type="button" data-image-favorite={model.value} aria-pressed={favorite}
						aria-label={(favorite ? 'Убрать из избранного: ' : 'В избранное: ') + model.label}
						class="shrink-0 p-1.5 rounded-lg {favorite ? 'text-amber-500 dark:text-amber-400' : 'text-base-500 dark:text-base-400'}"
						on:click={() => toggle('nmbPinnedImageModels', model.value)}>
						<Star className={favorite ? 'size-4 fill-current' : 'size-4'} />
					</button>
				</div>
			{/if}
		{:else}
			<div class="py-2 text-center text-xs text-base-500">{$i18n.t('No image models found')}</div>
		{/each}
		{#if !term}
			<button type="button" role="menuitemcheckbox" data-image-default aria-checked={!selected.length} disabled={saving}
				class="flex w-full justify-between items-center rounded-xl px-2 py-1.5 text-[0.8125rem] hover:bg-base-50/40 dark:hover:bg-base-800/40"
				on:click={() => toggle('nmbImageModels')}>
				{$i18n.t('Default')}{#if !selected.length}<Check className="size-3.5" strokeWidth="2" />{/if}
			</button>
		{/if}
	</div>
</div>
