<script lang="ts">
	import { verify } from '$lib/api';
	import { isLoading, result, error } from '$lib/store';

	// Batas ukuran file
	const LABEL_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
	const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

	// Format yang diterima
	const LABEL_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const DOCUMENT_ACCEPTED_TYPES = ['application/pdf'];

	// State file yang dipilih
	let labelFile: File | null = null;
	let documentFile: File | null = null;

	// Pesan error per-field
	let labelError: string | null = null;
	let documentError: string | null = null;

	// Tombol aktif hanya jika kedua file valid
	$: canSubmit = labelFile !== null && documentFile !== null && !labelError && !documentError;

	/**
	 * Validasi file label: format JPG/PNG/WEBP, maks 10 MB
	 */
	function validateLabel(file: File): string | null {
		if (!LABEL_ACCEPTED_TYPES.includes(file.type)) {
			return 'Format tidak didukung. Gunakan JPG, PNG, atau WEBP.';
		}
		if (file.size > LABEL_MAX_BYTES) {
			return 'Ukuran file melebihi batas 10 MB.';
		}
		return null;
	}

	/**
	 * Validasi file dokumen: format PDF, maks 20 MB
	 */
	function validateDocument(file: File): string | null {
		if (!DOCUMENT_ACCEPTED_TYPES.includes(file.type)) {
			return 'Format tidak didukung. Gunakan PDF.';
		}
		if (file.size > DOCUMENT_MAX_BYTES) {
			return 'Ukuran file melebihi batas 20 MB.';
		}
		return null;
	}

	/**
	 * Handler saat user memilih file label
	 */
	function handleLabelChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		labelFile = null;
		labelError = null;

		if (!file) return;

		const validationError = validateLabel(file);
		if (validationError) {
			labelError = validationError;
		} else {
			labelFile = file;
		}
	}

	/**
	 * Handler saat user memilih file dokumen
	 */
	function handleDocumentChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		documentFile = null;
		documentError = null;

		if (!file) return;

		const validationError = validateDocument(file);
		if (validationError) {
			documentError = validationError;
		} else {
			documentFile = file;
		}
	}

	/**
	 * Submit form: panggil API verify dan update store
	 */
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!labelFile || !documentFile) return;

		// Reset state sebelumnya
		error.set(null);
		result.set(null);
		isLoading.set(true);

		try {
			const verificationResult = await verify(labelFile, documentFile);
			result.set(verificationResult);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
			error.set(message);
		} finally {
			isLoading.set(false);
		}
	}
</script>

<form on:submit={handleSubmit} novalidate>
	<!-- Input Label -->
	<div class="field">
		<label for="label-input">
			<span class="field-label">Label Kemasan</span>
			<span class="field-hint">Format: JPG, PNG, WEBP — Maks. 10 MB</span>
		</label>
		<input
			id="label-input"
			type="file"
			accept="image/jpeg,image/png,image/webp"
			on:change={handleLabelChange}
			disabled={$isLoading}
			aria-describedby={labelError ? 'label-error' : undefined}
			aria-invalid={labelError ? 'true' : undefined}
		/>
		{#if labelError}
			<p id="label-error" class="error-message" role="alert">{labelError}</p>
		{/if}
	</div>

	<!-- Input Dokumen Pendukung -->
	<div class="field">
		<label for="document-input">
			<span class="field-label">Dokumen Pendukung</span>
			<span class="field-hint">Format: PDF — Maks. 20 MB</span>
		</label>
		<input
			id="document-input"
			type="file"
			accept="application/pdf"
			on:change={handleDocumentChange}
			disabled={$isLoading}
			aria-describedby={documentError ? 'document-error' : undefined}
			aria-invalid={documentError ? 'true' : undefined}
		/>
		{#if documentError}
			<p id="document-error" class="error-message" role="alert">{documentError}</p>
		{/if}
	</div>

	<!-- Tombol Verifikasi -->
	<button
		type="submit"
		disabled={!canSubmit || $isLoading}
		aria-busy={$isLoading}
	>
		{#if $isLoading}
			<span class="spinner" aria-hidden="true"></span>
			Memverifikasi...
		{:else}
			Verifikasi
		{/if}
	</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.field-label {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.field-hint {
		font-size: 0.8125rem;
		color: #6b7280;
	}

	input[type='file'] {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	input[type='file']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input[aria-invalid='true'] {
		border-color: #ef4444;
	}

	.error-message {
		margin: 0;
		font-size: 0.8125rem;
		color: #ef4444;
	}

	button[type='submit'] {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1.5rem;
		background-color: #2563eb;
		color: #ffffff;
		font-size: 0.9375rem;
		font-weight: 600;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	button[type='submit']:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
