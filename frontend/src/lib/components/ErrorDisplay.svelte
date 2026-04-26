<script lang="ts">
	import { error, resetState } from '$lib/store';

	/**
	 * Reset semua state agar user bisa mencoba lagi dari awal
	 */
	function handleRetry() {
		resetState();
	}
</script>

{#if $error}
	<div class="error-display" role="alert" aria-live="assertive">
		<div class="error-icon" aria-hidden="true">⚠</div>
		<div class="error-body">
			<p class="error-title">Terjadi Kesalahan</p>
			<p class="error-message">{$error}</p>
		</div>
		<button class="retry-button" type="button" on:click={handleRetry}>
			Coba Lagi
		</button>
	</div>
{/if}

<style>
	.error-display {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		background-color: #fff1f2;
		border: 1px solid #fca5a5;
		border-radius: 0.5rem;
		color: #991b1b;
	}

	.error-icon {
		flex-shrink: 0;
		font-size: 1.25rem;
		line-height: 1.4;
		color: #dc2626;
	}

	.error-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.error-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #991b1b;
	}

	.error-message {
		margin: 0;
		font-size: 0.875rem;
		color: #b91c1c;
		line-height: 1.5;
	}

	.retry-button {
		flex-shrink: 0;
		align-self: center;
		padding: 0.5rem 1.25rem;
		background-color: #dc2626;
		color: #ffffff;
		font-size: 0.875rem;
		font-weight: 600;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
		white-space: nowrap;
	}

	.retry-button:hover {
		background-color: #b91c1c;
	}

	.retry-button:focus-visible {
		outline: 2px solid #dc2626;
		outline-offset: 2px;
	}
</style>
