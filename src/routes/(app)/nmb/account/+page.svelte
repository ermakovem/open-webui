<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		const section = window.location.hash === '#limits' ? '#limits' : '#api';
		void goto('/nmb/subscriptions' + section, { replaceState: true });
	});
</script>
