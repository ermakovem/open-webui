<script lang="ts">
	import type { Subscription } from './portal';
	export let subscriptions: Subscription[];
	export let providers: Record<string, string>;
	export let notice: string;
	const date = new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short',
		timeZone: 'UTC'
	});
	const formatTime = (value: string | null) =>
		value && Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : 'Нет данных';
</script>

{#each subscriptions as sub (sub.name)}
	<article class="nmb-card">
		<div class="flex flex-wrap items-start justify-between gap-2">
			<div class="min-w-0">
				<h3>{providers[sub.provider] ?? sub.provider}</h3>
				<p class="nmb-muted break-all">{sub.name}</p>
			</div>
			<span class="nmb-status"
				>{sub.disabled ? 'Отключено' : sub.status || 'Статус неизвестен'}</span
			>
		</div>
		{#if sub.windows.length}
			<div class="nmb-table">
				<table aria-label={'Лимиты ' + sub.name}>
					<thead
						><tr><th>Окно</th><th>Осталось</th><th>Сброс, UTC</th><th>Обновлено, UTC</th></tr
						></thead
					>
					<tbody
						>{#each sub.windows as w}
							<tr
								><td>{w.label}</td><td class="font-medium tabular-nums"
									>{w.remaining == null
										? 'Нет данных'
										: w.remaining.toLocaleString('ru-RU') + '%'}</td
								><td>{formatTime(w.reset)}</td><td>{formatTime(w.observed)}</td></tr
							>
						{/each}</tbody
					>
				</table>
			</div>
		{:else}
			<p class="nmb-muted mt-3">Провайдер пока не передал лимиты.</p>
		{/if}
		<slot {sub} />
	</article>
{:else}
	{#if !notice}<p class="nmb-muted">Подписки ещё не подключены.</p>{/if}
{/each}
