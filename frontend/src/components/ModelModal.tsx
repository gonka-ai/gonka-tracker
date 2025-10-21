import { ModelInfo, ModelStats } from '../types/inference'

interface ModelModalProps {
  model: ModelInfo | null
  stats: ModelStats | null
  onClose: () => void
}

export function ModelModal({ model, stats, onClose }: ModelModalProps) {
  if (!model) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Model Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Model ID
            </h3>
            <p className="text-base font-mono text-gray-900 break-all">{model.id}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Total Weight
              </h3>
              <p className="text-base text-gray-900">{model.total_weight.toLocaleString()}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Participant Count
              </h3>
              <p className="text-base text-gray-900">{model.participant_count}</p>
            </div>
          </div>

          {stats && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Total Inferences
                  </h3>
                  <p className="text-base text-gray-900">{stats.inferences.toLocaleString()}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    AI Tokens
                  </h3>
                  <p className="text-base text-gray-900">{parseInt(stats.ai_tokens).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Details</h3>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Proposed By
                </h3>
                <p className="text-base font-mono text-gray-900 break-all">{model.proposed_by}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    VRAM
                  </h3>
                  <p className="text-base text-gray-900">{model.v_ram} GB</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Throughput
                  </h3>
                  <p className="text-base text-gray-900">{model.throughput_per_nonce}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Compute Units
                  </h3>
                  <p className="text-base text-gray-900">{model.units_of_compute_per_token}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  HuggingFace Repository
                </h3>
                <a
                  href={`https://huggingface.co/${model.hf_repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-blue-600 hover:text-blue-800 hover:underline break-all"
                >
                  {model.hf_repo}
                </a>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  HuggingFace Commit
                </h3>
                <p className="text-base font-mono text-gray-900 break-all">{model.hf_commit}</p>
              </div>

              {model.model_args.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Model Arguments
                  </h3>
                  <div className="bg-gray-50 rounded-md p-3 font-mono text-sm text-gray-900 break-all">
                    {model.model_args.join(' ')}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Validation Threshold
                </h3>
                <p className="text-base font-mono text-gray-900">
                  {model.validation_threshold.value} × 10^{model.validation_threshold.exponent}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

