<script lang="ts">
	import type { FieldComparison as FieldComparisonType } from '$lib/types';

	export let fields: FieldComparisonType[];

	// Label nama field dalam Bahasa Indonesia
	const FIELD_NAME_LABEL: Record<string, string> = {
		materialName: 'Nama Material',
		batchNumber: 'Nomor Batch',
		expiryDate: 'Tanggal Kedaluwarsa'
	};

	// Label tipe mismatch dalam Bahasa Indonesia
	const MISMATCH_TYPE_LABEL: Record<string, string> = {
		value_mismatch: 'Nilai Berbeda',
		format_mismatch: 'Format Berbeda',
		missing_data: 'Data Tidak Lengkap'
	};

	function getMismatchLabel(mismatchType: string | null): string {
		if (!mismatchType) return '—';
		return MISMATCH_TYPE_LABEL[mismatchType] ?? mismatchType;
	}

	function getValueDisplay(value: string | null): string {
		return value ?? '(tidak tersedia)';
	}
</script>

<div class="field-comparison">
	<h3 class="table-title">Perbandingan Field</h3>
	<div class="table-wrapper" role="region" aria-label="Tabel perbandingan field">
		<table>
			<thead>
				<tr>
					<th scope="col">Nama Field</th>
					<th scope="col">Nilai Label</th>
					<th scope="col">Nilai Dokumen</th>
					<th scope="col">Tipe Perbedaan</th>
				</tr>
			</thead>
			<tbody>
				{#each fields as field (field.fieldName)}
					<tr class:mismatch-row={field.isMismatch} aria-label="{FIELD_NAME_LABEL[field.fieldName] ?? field.fieldName}{field.isMismatch ? ' — terdapat perbedaan' : ''}">
						<td class="field-name">
							{FIELD_NAME_LABEL[field.fieldName] ?? field.fieldName}
							{#if field.isMismatch}
								<span class="mismatch-icon" aria-hidden="true" title="Terdapat perbedaan">⚠</span>
							{/if}
						</td>
						<td class:value-missing={field.labelValue === null}>
							{getValueDisplay(field.labelValue)}
						</td>
						<td class:value-missing={field.documentValue === null}>
							{getValueDisplay(field.documentValue)}
						</td>
						<td class="mismatch-type">
							{getMismatchLabel(field.mismatchType)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.field-comparison {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.table-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #374151;
	}

	.table-wrapper {
		overflow-x: auto;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		background-color: #f9fafb;
	}

	th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
		white-space: nowrap;
	}

	td {
		padding: 0.75rem 1rem;
		color: #4b5563;
		border-bottom: 1px solid #f3f4f6;
		vertical-align: middle;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tbody tr:hover {
		background-color: #f9fafb;
	}

	/* Highlight baris yang memiliki mismatch */
	.mismatch-row {
		background-color: #fff1f2 !important;
	}

	.mismatch-row:hover {
		background-color: #ffe4e6 !important;
	}

	.mismatch-row td {
		color: #374151;
	}

	.field-name {
		font-weight: 500;
		white-space: nowrap;
	}

	.mismatch-icon {
		margin-left: 0.375rem;
		color: #dc2626;
		font-size: 0.875rem;
	}

	.value-missing {
		color: #9ca3af;
		font-style: italic;
	}

	.mismatch-type {
		white-space: nowrap;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.mismatch-row .mismatch-type {
		color: #b91c1c;
		font-weight: 500;
	}
</style>
