'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Check, Save, ArrowLeft, Plus, Trash2, AlertCircle, Shield
} from 'lucide-react';
import Link from 'next/link';
import { CHAIN_NAMES } from '@/config/chains';

const categories = [
  'DeFi', 'Gaming', 'AI', 'NFT', 'Social', 'Infrastructure',
  'DAO', 'Metaverse', 'Privacy', 'Storage', 'Identity',
  'Oracle', 'Bridge', 'DEX', 'Lending', 'Yield', 'Other'
];

const blockchains = CHAIN_NAMES;

const projectStages = [
  { value: 'concept', label: 'Concept / Idea' },
  { value: 'development', label: 'In Development' },
  { value: 'testnet', label: 'Testnet Live' },
  { value: 'mainnet_beta', label: 'Mainnet Beta' },
  { value: 'mainnet', label: 'Mainnet Live' },
  { value: 'launched', label: 'Fully Launched' },
  { value: 'discontinued', label: 'Discontinued' },
];

interface ContractAddress {
  chain: string;
  address: string;
}

// Mock project data (would come from API/contract in production)
const mockProjectData = {
  id: 1,
  ownerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  projectName: 'DeFi Protocol X',
  tokenSymbol: 'DPX',
  category: 'DeFi',
  description: 'Revolutionary decentralized exchange with zero-slippage trades and MEV protection built on Base.',
  blockchain: 'Base',
  projectStage: 'mainnet',
  websiteUrl: 'https://example.com',
  whitepaperUrl: 'https://example.com/whitepaper.pdf',
  twitterUrl: 'https://twitter.com/defi_x',
  telegramUrl: 'https://t.me/defi_x',
  discordUrl: 'https://discord.gg/defi_x',
  githubUrl: 'https://github.com/defi_x',
  contractAddresses: [
    { chain: 'Base', address: '0x1234567890abcdef1234567890abcdef12345678' }
  ],
};

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Check if user is owner
  const isOwner = address?.toLowerCase() === mockProjectData.ownerAddress?.toLowerCase();

  const [formData, setFormData] = useState({
    projectName: mockProjectData.projectName,
    tokenSymbol: mockProjectData.tokenSymbol,
    category: mockProjectData.category,
    description: mockProjectData.description,
    blockchain: mockProjectData.blockchain,
    projectStage: mockProjectData.projectStage,
    websiteUrl: mockProjectData.websiteUrl || '',
    whitepaperUrl: mockProjectData.whitepaperUrl || '',
    twitterUrl: mockProjectData.twitterUrl || '',
    telegramUrl: mockProjectData.telegramUrl || '',
    discordUrl: mockProjectData.discordUrl || '',
    githubUrl: mockProjectData.githubUrl || '',
  });

  const [contractAddresses, setContractAddresses] = useState<ContractAddress[]>(
    mockProjectData.contractAddresses || [{ chain: '', address: '' }]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addContractAddress = () => {
    setContractAddresses([...contractAddresses, { chain: '', address: '' }]);
  };

  const removeContractAddress = (index: number) => {
    if (contractAddresses.length > 1) {
      setContractAddresses(contractAddresses.filter((_, i) => i !== index));
    }
  };

  const updateContractAddress = (index: number, field: 'chain' | 'address', value: string) => {
    const updated = [...contractAddresses];
    updated[index][field] = value;
    setContractAddresses(updated);
  };

  const verifyOwnership = async () => {
    if (!address) return;
    setVerifying(true);
    try {
      const message = `I verify ownership of ${formData.projectName} (${formData.tokenSymbol}) on DappScore.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      if (signature) {
        setVerified(true);
      }
    } catch (error) {
      console.error('Signature failed:', error);
    }
    setVerifying(false);
  };

  const handleSave = async () => {
    if (!verified) return;
    setSaving(true);
    // Would call contract/API here
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      router.push(`/projects/${params.id}`);
    }, 1500);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <Shield className="h-16 w-16 text-yellow-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-gray-400 mb-8">
            You need to connect your wallet to edit this project.
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-8">
            Only the project owner can edit this listing.
          </p>
          <Link
            href={`/projects/${params.id}`}
            className="inline-flex items-center px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/projects/${params.id}`}
              className="text-gray-400 hover:text-white flex items-center mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project
            </Link>
            <h1 className="text-3xl font-bold">Edit Project</h1>
            <p className="text-gray-400 mt-1">Update your project listing</p>
          </div>
          {!verified ? (
            <button
              onClick={verifyOwnership}
              disabled={verifying}
              className="px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center space-x-2"
            >
              {verifying ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>Verify Ownership</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center space-x-2 text-green-400">
              <Check className="h-5 w-5" />
              <span>Verified</span>
            </div>
          )}
        </div>

        {!verified && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-8">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-yellow-500 font-medium">Verify ownership to edit</p>
                <p className="text-gray-400 text-sm mt-1">
                  Sign a message with your wallet to confirm you are the project owner.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-8">
          {/* General Info */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">General Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name *</label>
                <input
                  type="text"
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleInputChange}
                  disabled={!verified}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Token Symbol *</label>
                <input
                  type="text"
                  name="tokenSymbol"
                  value={formData.tokenSymbol}
                  onChange={handleInputChange}
                  disabled={!verified}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  disabled={!verified}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Blockchain</label>
                <select
                  name="blockchain"
                  value={formData.blockchain}
                  onChange={handleInputChange}
                  disabled={!verified}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select blockchain</option>
                  {blockchains.map(chain => (
                    <option key={chain} value={chain}>{chain}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Project Stage</label>
                <select
                  name="projectStage"
                  value={formData.projectStage}
                  onChange={handleInputChange}
                  disabled={!verified}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select stage</option>
                  {projectStages.map(stage => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                disabled={!verified}
                rows={4}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          {/* Contract Addresses */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Contract Addresses</h2>
            <div className="space-y-4">
              {contractAddresses.map((contract, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <select
                    value={contract.chain}
                    onChange={(e) => updateContractAddress(index, 'chain', e.target.value)}
                    disabled={!verified}
                    className="w-40 bg-gray-700 border border-gray-600 rounded-lg px-3 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Chain</option>
                    {blockchains.map(chain => (
                      <option key={chain} value={chain}>{chain}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={contract.address}
                    onChange={(e) => updateContractAddress(index, 'address', e.target.value)}
                    disabled={!verified}
                    placeholder="0x..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 font-mono text-sm focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                  />
                  {contractAddresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContractAddress(index)}
                      disabled={!verified}
                      className="p-2 text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addContractAddress}
                disabled={!verified}
                className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
                <span>Add another contract</span>
              </button>
            </div>
          </div>

          {/* Links */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Links</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Website</label>
                <input
                  type="url"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleInputChange}
                  disabled={!verified}
                  placeholder="https://"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Whitepaper</label>
                <input
                  type="url"
                  name="whitepaperUrl"
                  value={formData.whitepaperUrl}
                  onChange={handleInputChange}
                  disabled={!verified}
                  placeholder="https://"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Twitter / X</label>
                <input
                  type="url"
                  name="twitterUrl"
                  value={formData.twitterUrl}
                  onChange={handleInputChange}
                  disabled={!verified}
                  placeholder="https://twitter.com/..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Telegram</label>
                <input
                  type="url"
                  name="telegramUrl"
                  value={formData.telegramUrl}
                  onChange={handleInputChange}
                  disabled={!verified}
                  placeholder="https://t.me/..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Discord</label>
                <input
                  type="url"
                  name="discordUrl"
                  value={formData.discordUrl}
                  onChange={handleInputChange}
                  disabled={!verified}
                  placeholder="https://discord.gg/..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">GitHub</label>
                <input
                  type="url"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleInputChange}
                  disabled={!verified}
                  placeholder="https://github.com/..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-2">
                  A public GitHub repository positively impacts your trust score. Private repos or alternative source control systems are accepted but will contribute less until independently verified.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!verified || saving}
              className="px-8 py-4 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                  <span>Saving...</span>
                </>
              ) : saved ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
