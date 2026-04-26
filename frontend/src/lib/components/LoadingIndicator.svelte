<script lang="ts">
	import { isLoading } from '$lib/store';
</script>

{#if $isLoading}
	<div class="loading-overlay" role="status" aria-live="polite" aria-label="Sedang memproses verifikasi">
		<div class="loading-content">
			<div class="spinner" aria-hidden="true"></div>
			<p class="loading-text">Sedang memverifikasi...</p>
			<p class="loading-hint">Proses ini mungkin memerlukan beberapa saat</p>
		</div>
	</div>
{/if}

<style>
	.loading-overlay {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 2.5rem 1rem;
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.spinner {
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid #e5e7eb;
		border-top-color: #2563eb;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.loading-hint {
		margin: 0;
		font-size: 0.8125rem;
		color: #6b7280;
	}
</style>
