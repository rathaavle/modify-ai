<script lang="ts">
	import type { VerificationResponse } from '$lib/types';

	export let result: VerificationResponse;

	// Label teks untuk status
	const STATUS_LABEL: Record<string, string> = {
		VALID: 'VALID',
		MISMATCH: 'TIDAK SESUAI',
		SUSPICIOUS: 'MENCURIGAKAN'
	};

	// Label teks untuk risk level
	const RISK_LABEL: Record<string, string> = {
		HIGH: 'RISIKO TINGGI',
		MEDIUM: 'RISIKO SEDANG',
		LOW: 'RISIKO RENDAH'
	};
</script>

<div class="result-card" aria-label="Hasil Verifikasi">
	<!-- Baris badge status dan risk level -->
	<div class="badges">
		<span class="badge status-badge status-{result.status.toLowerCase()}" role="status">
			{STATUS_LABEL[result.status] ?? result.status}
		</span>
		<span class="badge risk-badge risk-{result.riskLevel.toLowerCase()}">
			{RISK_LABEL[result.riskLevel] ?? result.riskLevel}
		</span>
	</div>

	<!-- Penjelasan AI -->
	<div class="explanation">
		<h3 class="explanation-title">Penjelasan AI</h3>
		<p class="explanation-text">{result.explanation}</p>
	</div>
</div>

<style>
	.result-card {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		background-color: #ffffff;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.3125rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	/* Status badges */
	.status-valid {
		background-color: #dcfce7;
		color: #15803d;
		border: 1px solid #86efac;
	}

	.status-mismatch {
		background-color: #fee2e2;
		color: #b91c1c;
		border: 1px solid #fca5a5;
	}

	.status-suspicious {
		background-color: #fef9c3;
		color: #a16207;
		border: 1px solid #fde047;
	}

	/* Risk level badges */
	.risk-high {
		background-color: #fee2e2;
		color: #b91c1c;
		border: 1px solid #fca5a5;
	}

	.risk-medium {
		background-color: #ffedd5;
		color: #c2410c;
		border: 1px solid #fdba74;
	}

	.risk-low {
		background-color: #dcfce7;
		color: #15803d;
		border: 1px solid #86efac;
	}

	/* Penjelasan */
	.explanation {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.explanation-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #374151;
	}

	.explanation-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: #4b5563;
		white-space: pre-wrap;
	}
</style>
