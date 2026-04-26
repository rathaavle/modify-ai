<script lang="ts">
	import UploadForm from '$lib/components/UploadForm.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import FieldComparison from '$lib/components/FieldComparison.svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import ErrorDisplay from '$lib/components/ErrorDisplay.svelte';
	import { isLoading, result, error } from '$lib/store';
</script>

<svelte:head>
	<title>Medify AI — Verifikasi Material Farmasi</title>
</svelte:head>

<div class="page">
	<!-- Header -->
	<header class="header">
		<div class="header-inner">
			<h1 class="app-title">Medify AI</h1>
			<p class="app-subtitle">Verifikasi kesesuaian data material farmasi secara otomatis</p>
		</div>
	</header>

	<!-- Main content -->
	<main class="main">
		<!-- Upload form — always visible -->
		<section class="card upload-section" aria-label="Unggah File">
			<h2 class="section-title">Unggah File</h2>
			<UploadForm />
		</section>

		<!-- Loading indicator — shown while processing -->
		<LoadingIndicator />

		<!-- Error display — shown when there is an error -->
		<ErrorDisplay />

		<!-- Results — shown when verification is complete -->
		{#if $result && !$isLoading && !$error}
			<section class="results-section" aria-label="Hasil Verifikasi">
				<!-- Status & AI explanation card -->
				<ResultCard result={$result} />

				<!-- Field comparison table -->
				<div class="card comparison-card">
					<FieldComparison fields={$result.fields} />
				</div>
			</section>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="footer">
		<p>Medify AI &mdash; Alat bantu verifikasi material farmasi</p>
	</footer>
</div>

<style>
	/* ── Layout ── */
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: #f3f4f6;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		color: #111827;
	}

	/* ── Header ── */
	.header {
		background-color: #1e40af;
		color: #ffffff;
		padding: 1.5rem 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.header-inner {
		max-width: 48rem;
		margin: 0 auto;
	}

	.app-title {
		margin: 0 0 0.25rem;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.app-subtitle {
		margin: 0;
		font-size: 0.9375rem;
		color: #bfdbfe;
	}

	/* ── Main ── */
	.main {
		flex: 1;
		max-width: 48rem;
		width: 100%;
		margin: 0 auto;
		padding: 2rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* ── Card ── */
	.card {
		background-color: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	/* ── Upload section ── */
	.upload-section {
		/* inherits .card */
	}

	.section-title {
		margin: 0 0 1.25rem;
		font-size: 1.0625rem;
		font-weight: 600;
		color: #111827;
	}

	/* ── Results section ── */
	.results-section {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.comparison-card {
		/* inherits .card */
	}

	/* ── Footer ── */
	.footer {
		padding: 1rem;
		text-align: center;
		font-size: 0.8125rem;
		color: #9ca3af;
		border-top: 1px solid #e5e7eb;
		background-color: #ffffff;
	}

	.footer p {
		margin: 0;
	}
</style>
