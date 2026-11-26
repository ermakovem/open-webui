<script lang="ts">
	import QuotaList from './QuotaList.svelte';
	import type { Post, Subscriptions } from './portal';
	export let view: Subscriptions;
	export let post: Post;
	export let openModels: (name: string) => void;
	export let busy: boolean;
</script>

<section>
	<h2>Добавить подписку</h2>
	<div class="nmb-actions">
		{#each Object.entries(view.providers) as [provider, label]}
			<button
				class="nmb-button"
				disabled={busy}
				on:click={() => post('/subscriptions/start', { provider })}
			>
				{label}
			</button>
		{/each}
	</div>
</section>

<section id="limits">
	<h2>Общие подключения и лимиты</h2>
	<QuotaList
		subscriptions={view.subscriptions}
		providers={view.providers}
		notice={view.notice}
		let:sub
	>
		<div class="nmb-actions">
			<button class="nmb-button" disabled={busy} on:click={() => openModels(sub.name)}
				>Модели</button
			>
			{#if sub.provider in view.providers}
				<button
					class="nmb-button"
					disabled={busy}
					on:click={() => post('/subscriptions/start', { name: sub.name, provider: sub.provider })}
					>Переподключить</button
				>
			{/if}
			<button
				class="nmb-button"
				disabled={busy}
				on:click={() =>
					post('/subscriptions/change', {
						name: sub.name,
						action: sub.disabled ? 'enable' : 'disable'
					})}>{sub.disabled ? 'Включить' : 'Отключить'}</button
			>
			<button
				class="nmb-button nmb-danger"
				disabled={busy}
				on:click={() => post('/subscriptions/change', { name: sub.name, action: 'delete' })}
				>Удалить…</button
			>
		</div>
	</QuotaList>
</section>

<details class="mt-6">
	<summary class="cursor-pointer py-1 font-medium">Журнал изменений</summary>
	{#if view.journal.length}
		<div class="nmb-table">
			<table>
				<thead
					><tr
						><th>Время UTC</th><th>Профиль</th><th>Действие</th><th>Подключение</th><th
							>Результат</th
						></tr
					></thead
				>
				<tbody
					>{#each view.journal as row}<tr
							><td>{row.time}</td><td>{row.owner}</td><td>{row.action}</td><td>{row.target}</td><td
								>{row.result}</td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
	{:else}<p class="nmb-muted">Изменений пока нет.</p>{/if}
</details>
