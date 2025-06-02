import React, { useState, useEffect } from 'react';
import { PrivacySystemService } from './services/blockchain-v4';
import { PrivateDepositEVM } from './components/PrivateDepositEVM';
import { PrivateWithdraw } from './components/PrivateWithdraw';
import { PrivateTrade } from './components/PrivateTrade';
import { PrivateBalances } from './components/PrivateBalances';
import { PrivatePortfolio } from './components/PrivatePortfolio';
import { switchToHyperliquidTestnet, switchToHyperliquidMainnet } from './utils/metamask-config';
import './App.css';

// Contract address from environment
const PRIVACY_SYSTEM_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x669E4933eE72a35eBC0c00f9C3084ce46e4424c4';

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [privacySystem] = useState(() => new PrivacySystemService(PRIVACY_SYSTEM_ADDRESS));
  const [connected, setConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'deposit' | 'trade' | 'withdraw' | 'balances' | 'portfolio'>('deposit');

  useEffect(() => {
    checkConnection();
    
    // Set up listeners only if ethereum exists
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setConnected(true);
        } else {
          handleDisconnect();
        }
      };
      
      const handleChainChanged = () => {
        // Reload the page to reset the app state
        window.location.reload();
      };
      
      // Add listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      // Cleanup listeners properly
      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
        // Also cleanup the privacy system service
        privacySystem.cleanup();
      };
    }
    
    return () => {
      // Cleanup for non-ethereum case
      privacySystem.cleanup();
    };
  }, [privacySystem]);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setConnected(true);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleConnect = async () => {
    try {
      // First ensure we're on the correct network
      // Switch to mainnet or testnet based on environment
      if (process.env.REACT_APP_NETWORK === 'mainnet') {
        await switchToHyperliquidMainnet();
      } else {
        await switchToHyperliquidTestnet();
      }
      
      const address = await privacySystem.connect();
      setUserAddress(address);
      setConnected(true);
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect wallet');
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setUserAddress(null);
    // Reset to deposit tab when disconnecting
    setActiveTab('deposit');
  };

  const handleSwitchAccount = async () => {
    try {
      // Request account change in MetaMask
      if (window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
        
        // Re-connect with new account
        const address = await privacySystem.connect();
        setUserAddress(address);
      }
    } catch (error) {
      console.error('Error switching accounts:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>Hyperliquid Privacy System</h1>
          <div className="wallet-info">
            {connected ? (
              <div className="wallet-connected">
                <div className="connected">
                  <span className="address">{userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}</span>
                  <span className="status-dot"></span>
                </div>
                <div className="wallet-actions">
                  <button className="wallet-btn switch" onClick={handleSwitchAccount}>
                    Switch Account
                  </button>
                  <button className="wallet-btn disconnect" onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <button className="connect-btn" onClick={handleConnect}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="App-main">
        {connected ? (
          <>
            <nav className="tab-nav">
              <button 
                className={activeTab === 'deposit' ? 'active' : ''}
                onClick={() => setActiveTab('deposit')}
              >
                Deposit
              </button>
              <button 
                className={activeTab === 'trade' ? 'active' : ''}
                onClick={() => setActiveTab('trade')}
              >
                Trade
              </button>
              <button 
                className={activeTab === 'withdraw' ? 'active' : ''}
                onClick={() => setActiveTab('withdraw')}
              >
                Withdraw
              </button>
              <button 
                className={activeTab === 'balances' ? 'active' : ''}
                onClick={() => setActiveTab('balances')}
              >
                Balances
              </button>
              <button 
                className={activeTab === 'portfolio' ? 'active' : ''}
                onClick={() => setActiveTab('portfolio')}
              >
                Portfolio
              </button>
            </nav>

            <div className="tab-content">
              {activeTab === 'deposit' && (
                <PrivateDepositEVM 
                  privacySystem={privacySystem}
                  userAddress={userAddress!}
                />
              )}
              {activeTab === 'trade' && (
                <PrivateTrade 
                  privacySystem={privacySystem}
                  userAddress={userAddress!}
                />
              )}
              {activeTab === 'withdraw' && (
                <PrivateWithdraw 
                  privacySystem={privacySystem}
                  userAddress={userAddress!}
                />
              )}
              {activeTab === 'balances' && (
                <PrivateBalances 
                  privacySystem={privacySystem}
                  userAddress={userAddress!}
                />
              )}
              {activeTab === 'portfolio' && (
                <PrivatePortfolio 
                  privacySystem={privacySystem}
                  userAddress={userAddress!}
                />
              )}
            </div>
          </>
        ) : (
          <div className="connect-prompt">
            <h2>Welcome to Hyperliquid Privacy System</h2>
            <p>Connect your wallet to start using private DeFi on HyperCore</p>
            <button className="connect-btn-large" onClick={handleConnect}>
              Connect Wallet
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
