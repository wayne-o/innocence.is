import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import proofService from '../services/proofService';
import './InnocenceProof.css';

interface InnocenceProofProps {
  userAddress: string;
  onInnocenceProven: () => void;
}

const InnocenceProof: React.FC<InnocenceProofProps> = ({ userAddress, onInnocenceProven }) => {
  const [status, setStatus] = useState<'checking' | 'innocent' | 'sanctioned' | 'expired' | 'error'>('checking');
  const [expiryTime, setExpiryTime] = useState<number>(0);
  const [isProving, setIsProving] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkInnocenceStatus();
  }, [userAddress]);

  const checkInnocenceStatus = async () => {
    try {
      // Check if address is sanctioned
      const sanctionsStatus = await proofService.checkSanctionsStatus(userAddress);
      
      if (sanctionsStatus.isSanctioned) {
        setStatus('sanctioned');
        return;
      }

      // Check if innocence proof exists on-chain
      // This would check the smart contract, for now we'll assume it needs proving
      setStatus('expired');
      
    } catch (error) {
      console.error('Error checking innocence status:', error);
      setStatus('error');
    }
  };

  const proveInnocence = async () => {
    setIsProving(true);
    setError('');
    
    try {
      // Generate innocence proof
      const proofData = await proofService.generateInnocenceProof(userAddress);
      
      // Submit to smart contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Get contract address from environment
      const contractAddress = process.env.REACT_APP_PRIVACY_SYSTEM_ADDRESS;
      const contractABI = [
        'function proveInnocence(bytes calldata innocenceProof, bytes calldata publicValues) external',
        'function isInnocent(address user) external view returns (bool)',
        'function innocenceProofExpiry(address user) external view returns (uint256)'
      ];
      
      const contract = new ethers.Contract(contractAddress!, contractABI, signer);
      
      // Submit proof
      const tx = await contract.proveInnocence(
        proofData.proofBytes,
        proofData.publicValues
      );
      
      await tx.wait();
      
      // Update status
      setStatus('innocent');
      setExpiryTime(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      onInnocenceProven();
      
    } catch (error: any) {
      console.error('Error proving innocence:', error);
      setError(error.message || 'Failed to prove innocence');
    } finally {
      setIsProving(false);
    }
  };

  const formatExpiryTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const renderStatus = () => {
    switch (status) {
      case 'checking':
        return <div className="status-checking">Checking innocence status...</div>;
      
      case 'innocent':
        return (
          <div className="status-innocent">
            <span className="status-icon">✅</span>
            <div>
              <h3>Innocence Verified</h3>
              <p>Valid until: {formatExpiryTime(expiryTime)}</p>
            </div>
          </div>
        );
      
      case 'sanctioned':
        return (
          <div className="status-sanctioned">
            <span className="status-icon">🚫</span>
            <div>
              <h3>Address Sanctioned</h3>
              <p>This address cannot use the privacy pool.</p>
            </div>
          </div>
        );
      
      case 'expired':
        return (
          <div className="status-expired">
            <span className="status-icon">⏰</span>
            <div>
              <h3>Proof Required</h3>
              <p>Prove you're not on the sanctions list to use the privacy pool.</p>
              <button 
                onClick={proveInnocence} 
                disabled={isProving}
                className="prove-button"
              >
                {isProving ? 'Generating Proof...' : 'Prove Innocence'}
              </button>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div className="status-error">
            <span className="status-icon">❌</span>
            <div>
              <h3>Error</h3>
              <p>Failed to check innocence status.</p>
              <button onClick={checkInnocenceStatus}>Retry</button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="innocence-proof-container">
      <h2>Innocence Verification</h2>
      <p className="description">
        To protect the privacy pool, we verify that addresses are not on sanctions lists.
        This is a simple check - no KYC or identity verification required.
      </p>
      
      {renderStatus()}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="info-box">
        <h4>ℹ️ About Innocence Proofs</h4>
        <ul>
          <li>Proves your address is NOT sanctioned</li>
          <li>Valid for 30 days</li>
          <li>No personal information required</li>
          <li>Transparent sanctions list</li>
        </ul>
      </div>
    </div>
  );
};

export default InnocenceProof;