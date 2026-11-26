<script lang="ts">
	import QuotaList from './QuotaList.svelte';
	import type { Account, Post } from './portal';
	export let view: Account;
	export let post: Post;
	export let busy: boolean;
	let keyAction: 'issue' | 'revoke' | null = null;
	const example = `from openai import OpenAI
from anthropic import Anthropic

openai = OpenAI()
anthropic = Anthropic()
messages = [{"role": "user", "content": "Привет!"}]

openai_model = next((m.id for m in openai.models.list()), None)
if openai_model:
    print(openai.chat.completions.create(model=openai_model, messages=messages))

anthropic_model = next((m.id for m in anthropic.models.list()), None)
if anthropic_model:
    print(anthropic.messages.create(model=anthropic_model, max_tokens=64, messages=messages))`;
</script>

<section id="api">
	<h2>Ваш API-ключ</h2>
	<div class="nmb-card">
		<p>
			{view.key_exists
				? 'Ключ активен и подходит для обоих SDK в вашем VPN-профиле.'
				: 'Создайте ключ для запросов через OpenAI SDK и Anthropic SDK.'}
		</p>
		{#if keyAction}
			<div class="nmb-notice mt-3">
				<h3>
					{keyAction === 'revoke'
						? 'Отозвать ключ?'
						: view.key_exists
							? 'Заменить действующий ключ?'
							: 'Создать новый ключ?'}
				</h3>
				<p>
					{keyAction === 'revoke'
						? 'Приложения с этим ключом потеряют доступ к API.'
						: view.key_exists
							? 'Предыдущий ключ сразу перестанет работать. Новый можно скопировать один раз.'
							: 'Новый ключ появится один раз. Сохраните его перед выходом из кабинета.'}
				</p>
				<div class="nmb-actions">
					<button class="nmb-button" disabled={busy} on:click={() => (keyAction = null)}
						>Отмена</button
					>
					<button
						class="nmb-button"
						class:nmb-danger={view.key_exists}
						disabled={busy}
						on:click={() => {
							const path = keyAction === 'revoke' ? '/account/keys/revoke' : '/account/keys';
							keyAction = null;
							post(path);
						}}
					>
						{keyAction === 'revoke' ? 'Подтвердить отзыв' : 'Выпустить ключ'}</button
					>
				</div>
			</div>
		{:else}
			<div class="nmb-actions">
				<button class="nmb-primary" disabled={busy} on:click={() => (keyAction = 'issue')}
					>{view.key_exists ? 'Заменить ключ' : 'Создать ключ'}</button
				>
				{#if view.key_exists}<button
						class="nmb-button nmb-danger"
						disabled={busy}
						on:click={() => (keyAction = 'revoke')}>Отозвать ключ</button
					>{/if}
			</div>
		{/if}
	</div>
</section>

<section>
	<h2>Подключение SDK</h2>
	<p>Задайте выданный ключ в <code>OPENAI_API_KEY</code> и <code>ANTHROPIC_API_KEY</code>.</p>
	<pre
		class="nmb-code">{`OPENAI_BASE_URL=${window.location.origin}/openai/v1\nANTHROPIC_BASE_URL=${window.location.origin}/anthropic`}</pre>
	<details>
		<summary class="cursor-pointer py-1 font-medium">Пример на Python</summary>
		<pre class="nmb-code">{example}</pre>
	</details>
</section>

<section id="limits">
	<h2>Лимиты подписок</h2>
	<QuotaList subscriptions={view.subscriptions} providers={view.providers} notice={view.notice} />
</section>

<section>
	<h2>Ваша активность за 7 дней</h2>
	{#if view.activity.length}
		<div class="nmb-table">
			<table>
				<thead><tr><th>Дата UTC</th><th>Модель</th><th>Результат</th><th>Запросы</th></tr></thead>
				<tbody
					>{#each view.activity as row}<tr
							><td>{row.day}</td><td>{row.model}</td><td>{row.outcome}</td><td>{row.total}</td></tr
						>{/each}</tbody
				>
			</table>
		</div>
	{:else}<p class="nmb-muted">Запросов пока нет.</p>{/if}
</section>
