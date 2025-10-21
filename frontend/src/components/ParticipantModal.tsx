import { useEffect, useState } from 'react'
import { Participant, ParticipantDetailsResponse } from '../types/inference'

interface ParticipantModalProps {
  participant: Participant | null
  epochId: number
  onClose: () => void
}

export function ParticipantModal({ participant, epochId, onClose }: ParticipantModalProps) {
  const [details, setDetails] = useState<ParticipantDetailsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])
  
  useEffect(() => {
    if (!participant) {
      return
    }
    
    setLoading(true)
    fetch(`/api/v1/participants/${participant.index}?epoch_id=${epochId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        setDetails(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch participant details:', err)
        setLoading(false)
      })
  }, [participant?.index, epochId])

  if (!participant) {
    return null
  }

  const totalInferenced = parseInt(participant.current_epoch_stats.inference_count) + 
                         parseInt(participant.current_epoch_stats.missed_requests)

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Participant Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Participant Address</label>
              <div className="mt-1 text-sm font-mono text-gray-900 break-all">{participant.index}</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Consensus Key</label>
              {participant.consensus_key_mismatch ? (
                <div className="mt-1 space-y-1">
                  <div className="text-sm font-mono text-red-600 break-all">
                    <span className="font-semibold">Participant Key:</span> {participant.validator_key || '-'}
                  </div>
                  <div className="text-sm font-mono text-red-600 break-all">
                    <span className="font-semibold">Validator Key:</span> {participant.validator_consensus_key || '-'}
                  </div>
                  <div className="text-xs text-red-600 font-semibold">
                    Key mismatch detected - potential configuration error
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm font-mono text-gray-900 break-all">
                  {participant.validator_key || <span className="text-gray-400">Not available</span>}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">URL</label>
              <div className="mt-1 text-sm text-gray-900 break-all">
                {participant.inference_url ? (
                  <a href={participant.inference_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {participant.inference_url}
                  </a>
                ) : (
                  <span className="text-gray-400">Not available</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
              <div className="mt-1">
                {participant.keybase_picture_url ? (
                  <div className="flex items-center gap-2">
                    <img 
                      src={participant.keybase_picture_url} 
                      alt={participant.keybase_username || 'Keybase avatar'} 
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm text-gray-900">
                      {participant.keybase_username || participant.moniker || '-'}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-900">
                    {participant.moniker || '-'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Website</label>
              <div className="mt-1 text-sm text-gray-900 break-all">
                {participant.website ? (
                  <a href={participant.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {participant.website}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Warm Keys</label>
              {loading ? (
                <div className="mt-1 text-sm text-gray-400">Loading...</div>
              ) : details && details.warm_keys && details.warm_keys.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {details.warm_keys.map((warmKey, idx) => (
                    <div key={idx} className="text-sm">
                      <div className="font-mono text-gray-900 break-all">{warmKey.grantee_address}</div>
                      <div className="text-xs text-gray-500">
                        Granted: {new Date(warmKey.granted_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-sm text-gray-400">No warm keys configured</div>
              )}
            </div>

            <div className="flex gap-8">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Weight</label>
                <div className="mt-1 text-sm font-semibold text-gray-900">{participant.weight.toLocaleString()}</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Jail Status</label>
                <div className="mt-1">
                  {participant.is_jailed === true ? (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 border border-red-300 rounded">
                      JAILED
                    </span>
                  ) : participant.is_jailed === false ? (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 border border-green-300 rounded">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Unknown</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Health Status</label>
                <div className="mt-1 flex items-center gap-2">
                  {participant.node_healthy === true ? (
                    <>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-900">Healthy</span>
                    </>
                  ) : participant.node_healthy === false ? (
                    <>
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-gray-900">Unhealthy</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                      <span className="text-sm text-gray-400">Unknown</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Models</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {participant.models.length > 0 ? (
                  participant.models.map((model, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded"
                    >
                      {model}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm">No models</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Inference Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Total Inferenced</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{totalInferenced.toLocaleString()}</div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Missed Requests</div>
                <div className={`mt-1 text-2xl font-semibold ${parseInt(participant.current_epoch_stats.missed_requests) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {parseInt(participant.current_epoch_stats.missed_requests).toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Validated Inferences</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {parseInt(participant.current_epoch_stats.validated_inferences).toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Invalidated Inferences</div>
                <div className={`mt-1 text-2xl font-semibold ${parseInt(participant.current_epoch_stats.invalidated_inferences) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {parseInt(participant.current_epoch_stats.invalidated_inferences).toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Missed Rate</div>
                <div className={`mt-1 text-2xl font-semibold ${participant.missed_rate > 0.10 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(participant.missed_rate * 100).toFixed(2)}%
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Invalidation Rate</div>
                <div className={`mt-1 text-2xl font-semibold ${participant.invalidation_rate > 0.10 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(participant.invalidation_rate * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Rewards</h3>
            
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Seed</label>
              <div className="mt-1 text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded">
                {loading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : details?.seed ? (
                  details.seed.signature
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
            
            {loading ? (
              <div className="text-gray-400 text-sm">Loading rewards...</div>
            ) : details && details.rewards && details.rewards.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Epoch</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Reward</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Claimed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.rewards.map((reward) => (
                      <tr key={reward.epoch_id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{reward.epoch_id}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {reward.assigned_reward_gnk > 0 ? `${reward.assigned_reward_gnk} GNK` : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {reward.claimed ? (
                            <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 border border-green-300 rounded">
                              YES
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 border border-red-300 rounded">
                              NO
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-600 text-sm bg-gray-50 p-4 rounded border border-gray-200">
                Rewards not available for current epoch. Check back after epoch ends.
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">MLNodes</h3>
            
            {loading ? (
              <div className="text-gray-400 text-sm">Loading MLNodes...</div>
            ) : details && details.ml_nodes && details.ml_nodes.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {details.ml_nodes.map((node, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-gray-900">{node.local_id}</div>
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                        node.status === 'FAILED' 
                          ? 'bg-red-100 text-red-700 border border-red-300' 
                          : 'bg-blue-100 text-blue-700 border border-blue-300'
                      }`}>
                        {node.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {node.poc_weight !== undefined && node.poc_weight !== null && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Weight</div>
                          <div className="mt-1 text-xs text-gray-700">
                            {node.poc_weight.toLocaleString()}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Models</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {node.models.length > 0 ? (
                            node.models.map((model, modelIdx) => (
                              <span
                                key={modelIdx}
                                className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded"
                              >
                                {model}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">No models</span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hardware</div>
                        <div className="mt-1">
                          {node.hardware.length > 0 ? (
                            <div className="space-y-1">
                              {node.hardware.map((hw, hwIdx) => (
                                <div key={hwIdx} className="text-xs text-gray-700">
                                  {hw.count}x {hw.type}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Hardware not reported</span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Network</div>
                        <div className="mt-1 text-xs font-mono text-gray-700">
                          {node.host}:{node.port}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No MLNodes configured</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

