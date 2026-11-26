<script lang="ts">
	import type { PortalView, Post } from './portal';
	export let view: Exclude<PortalView, { section: 'subscriptions' }>;
	export let post: Post;
	export let busy: boolean;
	export let deviceMessage: string;
	export let returnHome: () => void;
	export let returnModels: (() => void) | null;
	let redirect = '';
	$: if (view.section !== 'oauth') redirect = '';

	function submitCallback() {
		if (view.section === 'oauth' && redirect.trim()) {
			post('/subscriptions/callback', { state: view.state, redirect_url: redirect.trim() });
		}
	}
</script>

{#if view.section === 'issued'}
	<section>
		<h2>Ваш новый API-ключ</h2>
		<p>Скопируйте и сохраните ключ. После выхода из этого раздела он будет скрыт.</p>
		<code class="nmb-secret">{view.new_key}</code>
		<button class="nmb-primary" on:click={returnHome}>Ключ сохранён</button>
	</section>
{:else if view.section === 'device' || view.section === 'oauth' || view.section === 'pending'}
	<section>
		{#if view.section === 'device'}
			<h2>Подключить ChatGPT</h2>
			<p>
				Введите одноразовый код на сайте OpenAI и подтвердите вход. Codex использует лимит вашей
				подписки ChatGPT.
			</p>
			<code class="nmb-secret text-xl tracking-wider">{view.user_code}</code>
			<a class="nmb-primary" href={view.url} target="_blank" rel="noopener noreferrer"
				>Войти в OpenAI ↗</a
			>
			<p class="nmb-muted mt-3">
				Если OpenAI запросит разрешение, включите вход по коду устройства в настройках безопасности
				ChatGPT.
			</p>
			<p class="mt-3" role="status">
				{deviceMessage || 'Ожидаем подтверждения. Статус обновляется автоматически.'}
			</p>
		{:else if view.section === 'oauth'}
			<h2>Войти в {view.providers[view.provider] ?? view.provider}</h2>
			<p>
				Подтвердите вход у провайдера, затем скопируйте полный адрес возврата из адресной строки,
				даже если страница не открылась.
			</p>
			<a class="nmb-primary mt-3" href={view.url} target="_blank" rel="noopener noreferrer"
				>Открыть вход у провайдера ↗</a
			>
			<form class="mt-5" autocomplete="off" on:submit|preventDefault={submitCallback}>
				<label class="block font-medium" for="nmb-redirect">Полный адрес возврата</label>
				<input
					class="nmb-input"
					id="nmb-redirect"
					type="url"
					required
					autocomplete="off"
					spellcheck="false"
					bind:value={redirect}
				/>
				<button class="nmb-primary" disabled={busy || !redirect.trim()}>Завершить вход</button>
			</form>
			{#if deviceMessage}<p role="status" class="mt-3">{deviceMessage}</p>{/if}
		{:else}
			<h2>Статус подключения</h2>
			<p role="status">{view.notice}</p>
		{/if}
		<div class="nmb-actions">
			<button
				class="nmb-button"
				disabled={busy}
				on:click={() => post('/subscriptions/status', { state: view.state })}
				>Проверить статус</button
			>
			<button
				class="nmb-button"
				disabled={busy}
				on:click={() => post('/subscriptions/cancel', { state: view.state })}>Отменить вход</button
			>
		</div>
	</section>
{:else if view.section === 'models'}
	<section>
		<h2>Модели подключения</h2>
		<p class="nmb-muted mb-4 break-all">{view.target}</p>
		{#if view.needs_prefix}
			<div class="nmb-card">
				<p>Закрепите модели за этим аккаунтом, чтобы запросы расходовали его подписку.</p>
				<button
					class="nmb-button mt-3"
					disabled={busy}
					on:click={() => post('/subscriptions/models', { name: view.target, action: 'assign' })}
					>Закрепить модели и опубликовать</button
				>
			</div>
		{/if}
		{#each view.models as model (model)}
			{@const hidden = view.hidden.includes(model)}
			<div class="nmb-card flex items-center justify-between flex-wrap gap-3">
				<div class="min-w-0">
					<h3 class="break-all">{model}</h3>
					<span class="nmb-muted">{hidden ? 'Скрыта' : 'Опубликована'}</span>
				</div>
				<button
					class="nmb-button"
					disabled={busy}
					on:click={() =>
						post('/subscriptions/models', {
							name: view.target,
							model,
							action: hidden ? 'show' : 'hide'
						})}>{hidden ? 'Опубликовать' : 'Скрыть во всех клиентах'}</button
				>
			</div>
		{:else}
			{#if !view.needs_prefix}<p>У подключения пока нет зарегистрированных моделей.</p>{/if}
		{/each}
		<button class="nmb-button mt-4" disabled={busy} on:click={returnHome}>Вернуться к подпискам</button>
	</section>
{:else if view.section === 'confirm'}
	<section>
		<h2>Удалить общее подключение?</h2>
		<p>
			Все участники потеряют доступ к подписке <strong class="break-all">{view.target}</strong>. Для
			восстановления потребуется войти у провайдера заново.
		</p>
		<div class="nmb-actions">
			<button class="nmb-button" disabled={busy} on:click={returnHome}>Отмена</button>
			<button
				class="nmb-button nmb-danger"
				disabled={busy}
				on:click={() =>
					post('/subscriptions/change', {
						name: view.target,
						confirm: view.target,
						action: 'delete'
					})}>Удалить подписку</button
			>
		</div>
	</section>
{:else if view.section === 'notice'}
	<p class="nmb-notice" role="status">{view.notice}</p>
	<div class="nmb-actions">
		{#if returnModels}<button class="nmb-primary" disabled={busy} on:click={returnModels}
				>Вернуться к моделям</button
			>{/if}
		<button class="nmb-button" disabled={busy} on:click={returnHome}>Вернуться к подпискам</button>
	</div>
{/if}
